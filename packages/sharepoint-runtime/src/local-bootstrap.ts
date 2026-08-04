/**
 * Local preview bootstrap — the browser entry for `rspfx dev` (local mode).
 * This bundle is compiled by the rspfx dev server and loaded by the local
 * page at `/`. It provides the tiny AMD loader the web part/extension bundles
 * `define(...)` into, discovers the page's components from
 * `window.__RSPFX_COMPONENTS__` (injected by the dev server), loads each
 * bundle and instantiates the component with an emulated SPFx context.
 *
 * Components are dispatched by `componentType`:
 * - WebPart → emulated WebPartContext (like before)
 * - Extension → real ApplicationCustomizer / FieldCustomizer /
 *   ListViewCommandSet context (see `createLocalExtensionContext`) with the
 *   lifecycle the real sp-loader uses (`_init` → onInit → render).
 *
 * Locale: `?locale=<tag>` (alias `?market=`) switches the emulated
 * CultureInfo; each component's localized resource files are loaded from
 * `/dist/<name>_<locale>.js` with an `en-us` fallback.
 *
 * Because local-mode bundles compile WITHOUT sp-* externals, the real
 * `@microsoft/sp-*` packages are bundled in and run in the browser — only the
 * data layer (lists/users/theme/Graph) is emulated.
 */
import { Environment, DisplayMode, EnvironmentType } from '@microsoft/sp-core-library';
import type { WebPartContextLike } from '@mbsks/rspfx-core';
import { createLocalWebPartContext } from './context.js';
import { createLocalExtensionContext } from './extension-contexts.js';
import { DEFAULT_LOCALE, resolveLocale, type ResolvedLocale } from './locales.js';
import { isPlatformOnlyModule } from './platform-modules.js';

interface RspfxLocalComponent {
  id: string;
  alias: string;
  bundleName: string;
  amdId: string;
  componentType?: 'WebPart' | 'Extension';
  extensionType?: string;
  localizedResources?: string[];
  items?: Record<string, { title?: { default?: string }; type?: string }>;
  preconfiguredEntries?: {
    properties?: Record<string, unknown>;
    title?: string | { default?: string };
  }[];
}

declare global {
  interface Window {
    __RSPFX_COMPONENTS__?: RspfxLocalComponent[];
  }
}

/** Test seam: swap the context creators without touching real `@microsoft/sp-*` packages. */
export interface LocalMountSeams {
  createWebPartContext?: typeof createLocalWebPartContext;
  createExtensionContext?: typeof createLocalExtensionContext;
}

interface AmdModule {
  exports: unknown;
}

// The component bundles call define/require in AMD form. The global define/require
// declarations shipped by @types/requirejs describe the full RequireJS API, which
// this minimal loader does not implement, so install the hooks via a cast.
const amdWindow = window as unknown as {
  define(id: string, deps: string[], factory: (...args: unknown[]) => unknown): void;
  require(id: string): unknown;
};

const registry = new Map<string, AmdModule>();

/**
 * No-op stand-in for the internal `@msinternal/*` modules the bundled sp-*
 * packages import (telemetry, feature flags, safe-html). They are never
 * published to npm; sp-loader provides them on real tenants, so in the local
 * preview any property access, call or `new` on them yields another no-op.
 * Self-referential so `new X().method().prop` chains keep working.
 */
export const MSINTERNAL_PROXY: unknown = new Proxy(function () {}, {
  get(_target, prop) {
    if (prop === '__esModule' || prop === Symbol.toStringTag) {
      return undefined;
    }
    return MSINTERNAL_PROXY;
  },
  set() {
    return true;
  },
  apply() {
    return MSINTERNAL_PROXY;
  },
  construct() {
    return MSINTERNAL_PROXY as object;
  }
});

const MSINTERNAL_PREFIX = '@msinternal';

// Locale files are ANONYMOUS defines (`define([], () => ({...}))`); the module
// is stashed here until loadScript() claims it under the resource name.
let pendingDefine: AmdModule | undefined;

// A bundle whose localized-resource deps were not registered yet (the page
// payload may not carry the resource names) defers its define until the
// loader has loaded the locale modules — see loadComponentBundle().
interface DeferredDefine {
  id: string | undefined;
  deps: string[];
  factory: (...args: unknown[]) => unknown;
}
const deferredDefines: DeferredDefine[] = [];
const SPECIAL_DEP_NAMES = new Set(['require', 'exports', 'module']);

function isMissingDep(dep: string): boolean {
  return !SPECIAL_DEP_NAMES.has(dep) && !registry.has(dep) && !isPlatformOnlyModule(dep);
}

function resolveDep(dep: string, mod: AmdModule): unknown {
  if (dep === 'require') {
    return (requestedId: string): unknown => registry.get(requestedId)?.exports;
  }
  if (dep === 'exports') {
    return mod.exports;
  }
  if (dep === 'module') {
    return mod;
  }
  return registry.get(dep)?.exports ?? (isPlatformOnlyModule(dep) ? MSINTERNAL_PROXY : undefined);
}

function registerDefine(id: string | undefined, deps: string[], factory: (...args: unknown[]) => unknown): void {
  const mod: AmdModule = { exports: {} };
  const resolved = deps.map((dep) => resolveDep(dep, mod));
  const result = factory(...resolved);
  if (result !== undefined) {
    mod.exports = result;
  }
  if (typeof id === 'string') {
    registry.set(id, mod);
  } else {
    pendingDefine = mod;
  }
}

amdWindow.define = (id, deps, factory) => {
  const missing = deps.filter(isMissingDep);
  if (missing.length > 0) {
    // In local mode the only AMD externals are localized-resource names, so a
    // missing dep is a resource module we still have to load.
    deferredDefines.push({ id, deps, factory });
    return;
  }
  registerDefine(id, deps, factory);
};

amdWindow.require = (id) => registry.get(id)?.exports;

const EnvironmentInitializer = Environment as unknown as {
  _initialize(data: { type: EnvironmentType }): void;
};

// The root vitest stub for sp-core-library omits DisplayMode; fall back to the
// real enum's Read value (1) so tests never touch the real package.
const LOCAL_DISPLAY_MODE_READ = (DisplayMode as unknown as { Read?: number } | undefined)?.Read ?? 1;

function boot(): void {
  try {
    EnvironmentInitializer._initialize({ type: EnvironmentType.Local });
  } catch {
    // Environment type is informational; the emulated context is Local anyway.
  }

  const components = window.__RSPFX_COMPONENTS__ ?? [];
  const host = document.getElementById('__rspfx_host');
  if (!host) {
    showFatal('Local preview host element (#__rspfx_host) not found.');
    return;
  }
  for (const component of components) {
    host.appendChild(createCard(component));
  }
  mountAll(components).catch((error) => showFatal(error));
}

function createCard(component: RspfxLocalComponent): HTMLElement {
  const card = document.createElement('article');
  card.className = 'rspfx-wp-card';
  card.id = `rspfx-wp-${component.id}`;

  const header = document.createElement('header');
  const title = document.createElement('h2');
  const entry = component.preconfiguredEntries?.[0];
  const entryTitle = entry?.title;
  title.textContent = (typeof entryTitle === 'string' ? entryTitle : entryTitle?.default) ?? component.alias;
  header.appendChild(title);

  if (component.componentType === 'Extension') {
    const tag = document.createElement('span');
    tag.className = 'rspfx-wp-type';
    tag.textContent = component.extensionType ?? 'Extension';
    header.appendChild(tag);
  }

  const status = document.createElement('span');
  status.className = 'rspfx-wp-status';
  status.dataset.component = component.id;
  header.appendChild(status);
  card.appendChild(header);

  const root = document.createElement('div');
  root.className = 'rspfx-wp-root';
  card.appendChild(root);
  return card;
}

async function mountAll(components: RspfxLocalComponent[], seams: LocalMountSeams = {}): Promise<void> {
  const locale = resolveLocale(readLocaleQuery());
  for (const component of components) {
    await mountOne(component, locale, seams);
  }
}

function readLocaleQuery(): string | undefined {
  const params = new URLSearchParams(window.location.search);
  return params.get('locale') ?? params.get('market') ?? undefined;
}

export async function mountOne(
  component: RspfxLocalComponent,
  locale: ResolvedLocale = resolveLocale(readLocaleQuery()),
  seams: LocalMountSeams = {}
): Promise<void> {
  const root = document.querySelector<HTMLElement>(
    `#rspfx-wp-${CSS.escape(component.id)} .rspfx-wp-root`
  );
  const status = document.querySelector<HTMLElement>(
    `#rspfx-wp-${CSS.escape(component.id)} .rspfx-wp-status`
  );
  if (!root || !status) {
    throw new Error(`Local preview: mount target missing for ${component.id}`);
  }
  status.textContent = 'loading…';
  await loadLocalizedResources(component, locale.locale);
  await loadComponentBundle(component, locale.locale);
  const moduleExports = amdWindow.require(component.amdId);
  if (moduleExports === undefined) {
    throw new Error(
      `Local preview: bundle ${component.bundleName} did not register AMD module '${component.amdId}'`
    );
  }
  const ComponentClass = (moduleExports as { default?: unknown }).default ?? moduleExports;
  if (typeof ComponentClass !== 'function') {
    throw new Error(
      `Local preview: bundle ${component.bundleName} does not export a component class ` +
        `(expected default export, found ${moduleExports === undefined ? 'no module' : 'module without default'})`
    );
  }
  try {
    if (component.componentType === 'Extension') {
      await mountExtension(component, ComponentClass as new () => unknown, locale, root, status, seams);
      return;
    }
    await mountWebPart(component, ComponentClass as new () => { render(): void }, locale, status, seams);
  } catch (error) {
    status.textContent = 'error';
    const message = error instanceof Error ? error.message : String(error);
    const detail = document.createElement('pre');
    detail.className = 'rspfx-wp-error';
    detail.textContent = message;
    root.appendChild(detail);
    throw error;
  }
}

async function mountWebPart(
  component: RspfxLocalComponent,
  WebPartClass: new () => { render(): void },
  locale: ResolvedLocale,
  status: HTMLElement,
  seams: LocalMountSeams
): Promise<void> {
  const createContext = seams.createWebPartContext ?? createLocalWebPartContext;
  const context = await createContext(
    {
      id: component.id,
      alias: component.alias,
      preconfiguredEntries: component.preconfiguredEntries,
      componentType: 'WebPart'
    },
    {
      webPartTag: `${component.alias}.${crypto.randomUUID()}`
    },
    {
      pageContextData: { locale: locale.locale }
    }
  );
  const webPart = new WebPartClass();
  const internal = webPart as unknown as {
    _internalInitialize(
      context: WebPartContextLike,
      addedFromPersistedData: boolean,
      mode: DisplayMode
    ): void;
    _internalDeserialize(data: { properties: Record<string, unknown>; dataVersion: string }): void;
    onInit(): Promise<void> | void;
    render(): void;
  };
  internal._internalInitialize(context, false, LOCAL_DISPLAY_MODE_READ);
  internal._internalDeserialize({
    properties: component.preconfiguredEntries?.[0]?.properties ?? {},
    dataVersion: '1.0'
  });
  if (typeof internal.onInit === 'function') {
    await internal.onInit();
  }
  internal.render();
  status.textContent = 'ready';
  status.classList.add('rspfx-wp-ready');
}

async function mountExtension(
  component: RspfxLocalComponent,
  ExtensionClass: new () => unknown,
  locale: ResolvedLocale,
  root: HTMLElement,
  status: HTMLElement,
  seams: LocalMountSeams
): Promise<void> {
  const extensionType = component.extensionType;
  if (extensionType !== 'ApplicationCustomizer' && extensionType !== 'FieldCustomizer' && extensionType !== 'ListViewCommandSet') {
    throw new Error(`Local preview: unsupported extensionType '${extensionType}' for ${component.alias}`);
  }
  const manifest = componentManifest(component);
  if (extensionType === 'ApplicationCustomizer') {
    await mountApplicationCustomizer(component, manifest, ExtensionClass, locale, root, seams);
  } else if (extensionType === 'FieldCustomizer') {
    await mountFieldCustomizer(component, manifest, ExtensionClass, locale, root, seams);
  } else {
    await mountListViewCommandSet(component, manifest, ExtensionClass, locale, root, seams);
  }
  status.textContent = 'ready';
  status.classList.add('rspfx-wp-ready');
}

async function mountApplicationCustomizer(
  component: RspfxLocalComponent,
  manifest: Record<string, unknown>,
  ExtensionClass: new () => unknown,
  locale: ResolvedLocale,
  root: HTMLElement,
  seams: LocalMountSeams
): Promise<void> {
  const topHost = document.createElement('div');
  topHost.className = 'rspfx-ac-placeholder';
  const bottomHost = document.createElement('div');
  bottomHost.className = 'rspfx-ac-placeholder';
  root.appendChild(topHost);
  root.appendChild(bottomHost);
  const createContext = seams.createExtensionContext ?? createLocalExtensionContext;
  const context = await createContext(manifest, 'ApplicationCustomizer', {
    pageContextData: { locale: locale.locale },
    placeholderHosts: [
      { name: 'Top', domElement: topHost },
      { name: 'Bottom', domElement: bottomHost }
    ]
  });
  const extension = new ExtensionClass();
  const internal = extension as unknown as {
    _init(context: unknown, propertiesJson: string, sequenceNumber?: number): Promise<unknown>;
    onRender?(): void;
  };
  await internal._init(context, JSON.stringify(component.preconfiguredEntries?.[0]?.properties ?? {}), 65535);
  if (typeof internal.onRender === 'function') {
    internal.onRender();
  }
}

const SAMPLE_LIST = {
  id: '3d81f5a1-0000-0000-0000-000000000020',
  title: 'Sample List',
  internalName: 'SampleList',
  serverRelativeUrl: '/Lists/SampleList'
};

const SAMPLE_FIELD = {
  id: '3d81f5a1-0000-0000-0000-000000000021',
  internalName: 'SampleField',
  title: 'Sample Field',
  typeAsString: 'Text'
};

const SAMPLE_ROWS = [
  { id: 1, title: 'First sample item', value: 'Alpha' },
  { id: 2, title: 'Second sample item', value: 'Beta' },
  { id: 3, title: 'Third sample item', value: 'Gamma' }
];

async function mountFieldCustomizer(
  component: RspfxLocalComponent,
  manifest: Record<string, unknown>,
  ExtensionClass: new () => unknown,
  locale: ResolvedLocale,
  root: HTMLElement,
  seams: LocalMountSeams
): Promise<void> {
  const listView = { rows: SAMPLE_ROWS, selectedRows: [] };
  const createContext = seams.createExtensionContext ?? createLocalExtensionContext;
  const context = await createContext(manifest, 'FieldCustomizer', {
    pageContextData: { locale: locale.locale },
    listView,
    field: SAMPLE_FIELD
  });
  const extension = new ExtensionClass();
  const internal = extension as unknown as {
    _init(context: unknown, propertiesJson: string, sequenceNumber?: number): Promise<unknown>;
    onRenderCell(event: Record<string, unknown>): void;
    onDisposeCell?(event: Record<string, unknown>): void;
  };
  await internal._init(context, JSON.stringify(component.preconfiguredEntries?.[0]?.properties ?? {}), 65535);

  const table = document.createElement('table');
  table.className = 'rspfx-fc-table';
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const headCell = document.createElement('th');
  headCell.textContent = SAMPLE_FIELD.title;
  headRow.appendChild(headCell);
  head.appendChild(headRow);
  table.appendChild(head);
  const body = document.createElement('tbody');
  table.appendChild(body);
  root.appendChild(table);

  for (const row of SAMPLE_ROWS) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    const cell = document.createElement('div');
    cell.className = 'rspfx-fc-cell';
    cell.textContent = row.value;
    td.appendChild(cell);
    tr.appendChild(td);
    body.appendChild(tr);
    const listItem = { id: row.id, itemId: row.id, title: row.title };
    internal.onRenderCell({
      domElement: cell,
      listItem,
      cellValue: row.value,
      fieldValue: row.value,
      list: SAMPLE_LIST,
      field: SAMPLE_FIELD,
      row
    });
  }
}

async function mountListViewCommandSet(
  component: RspfxLocalComponent,
  manifest: Record<string, unknown>,
  ExtensionClass: new () => unknown,
  locale: ResolvedLocale,
  root: HTMLElement,
  seams: LocalMountSeams
): Promise<void> {
  const selectedRows: unknown[] = [];
  const createContext = seams.createExtensionContext ?? createLocalExtensionContext;
  const context = await createContext(manifest, 'ListViewCommandSet', {
    pageContextData: { locale: locale.locale },
    listView: { rows: SAMPLE_ROWS, selectedRows }
  });
  const extension = new ExtensionClass();
  const internal = extension as unknown as {
    _init(context: unknown, propertiesJson: string, sequenceNumber?: number): Promise<unknown>;
    tryGetCommand(id: string): { id: string; title: string; visible: boolean; disabled?: boolean } | undefined;
    onListViewUpdated(event: { selectedRows: unknown[] }): void;
    onExecute(event: { itemId: string; selectedRows: unknown[] }): void;
    _raiseOnChange?: () => void;
  };
  await internal._init(context, JSON.stringify(component.preconfiguredEntries?.[0]?.properties ?? {}), 65535);

  const toolbar = document.createElement('div');
  toolbar.className = 'rspfx-lvcs-toolbar';
  root.appendChild(toolbar);
  const listTable = document.createElement('table');
  listTable.className = 'rspfx-fc-table';
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const headCell = document.createElement('th');
  headCell.textContent = 'Title';
  headRow.appendChild(headCell);
  head.appendChild(headRow);
  listTable.appendChild(head);
  const body = document.createElement('tbody');
  for (const row of SAMPLE_ROWS) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.textContent = row.title;
    tr.appendChild(td);
    body.appendChild(tr);
  }
  listTable.appendChild(body);
  root.appendChild(listTable);

  const commandIds = Object.keys(manifest.items ?? {});
  const renderToolbar = (): void => {
    toolbar.replaceChildren();
    for (const commandId of commandIds) {
      const command = internal.tryGetCommand(commandId);
      if (!command || command.visible === false) {
        continue;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rspfx-lvcs-button';
      button.textContent = command.title;
      button.disabled = command.disabled === true;
      button.onclick = () => internal.onExecute({ itemId: commandId, selectedRows });
      toolbar.appendChild(button);
    }
  };

  // The real loader wires `_raiseOnChange` so command.visible/disabled changes
  // made in onExecute propagate back to the toolbar.
  internal._raiseOnChange = () => {
    internal.onListViewUpdated({ selectedRows });
    renderToolbar();
  };
  internal.onListViewUpdated({ selectedRows });
  renderToolbar();
}

function componentManifest(component: RspfxLocalComponent): Record<string, unknown> {
  return {
    id: component.id,
    alias: component.alias,
    version: '1.0.0',
    manifestVersion: 2,
    componentType: component.componentType === 'Extension' ? 'Extension' : 'WebPart',
    extensionType: component.extensionType,
    preconfiguredEntries: component.preconfiguredEntries ?? [],
    items: component.items ?? {},
    loaderConfig: { internalModuleBaseUrls: ['/dist'] }
  };
}

async function loadLocalizedResources(component: RspfxLocalComponent, locale: string): Promise<void> {
  for (const name of component.localizedResources ?? []) {
    await loadLocaleResource(name, locale);
  }
}

async function loadLocaleResource(name: string, locale: string): Promise<void> {
  try {
    await loadScript(`/dist/${name}_${locale}.js`, name);
  } catch (error) {
    if (locale === DEFAULT_LOCALE) {
      throw error;
    }
    try {
      await loadScript(`/dist/${name}_${DEFAULT_LOCALE}.js`, name);
    } catch {
      throw new Error(
        `Local preview: no locale file for ${name} (tried ${locale} and ${DEFAULT_LOCALE})`
      );
    }
  }
}

/**
 * Loads the component bundle, then runs any defines the bundle deferred
 * because their localized-resource deps were not registered yet (the page
 * payload only carries resource names when the manifest exposes them, so the
 * bundle's own dependency list is the fallback source of truth).
 */
async function loadComponentBundle(component: RspfxLocalComponent, locale: string): Promise<void> {
  await loadScript(`/dist/${component.bundleName}.js`);
  while (deferredDefines.length > 0) {
    const batch = deferredDefines.splice(0);
    for (const pending of batch) {
      const missing = pending.deps.filter(isMissingDep);
      for (const name of missing) {
        await loadLocaleResource(name, locale);
      }
      registerDefine(pending.id, pending.deps, pending.factory);
    }
  }
}

function loadScript(src: string, resourceName?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => {
      if (resourceName !== undefined) {
        const pending = pendingDefine;
        pendingDefine = undefined;
        if (pending) {
          registry.set(resourceName, pending);
        }
      }
      resolve();
    };
    script.onerror = () => reject(new Error(`Local preview: failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function showFatal(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[rspfx] local preview failed:', error);
  const banner = document.createElement('div');
  banner.className = 'rspfx-wp-fatal';
  banner.textContent = `Local preview failed: ${message}`;
  document.body.appendChild(banner);
}

boot();
