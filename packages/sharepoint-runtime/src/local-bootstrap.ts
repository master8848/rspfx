/**
 * Local preview bootstrap — the browser entry for `rspfx dev` (local mode).
 * This bundle is compiled by the rspfx dev server and loaded by the local
 * page at `/`. It provides the tiny AMD loader the web part bundles
 * `define(...)` into, discovers the page's web parts from
 * `window.__RSPFX_COMPONENTS__` (injected by the dev server), loads each
 * bundle and instantiates the web part with an emulated SPFx context.
 *
 * Because local-mode bundles compile WITHOUT sp-* externals, the real
 * `@microsoft/sp-*` packages are bundled in and run in the browser — only the
 * data layer (lists/users/theme/Graph) is emulated.
 */
import { Environment, DisplayMode, EnvironmentType } from '@microsoft/sp-core-library';
import type { WebPartContextLike } from '@mbsks/rspfx-core';
import { createLocalWebPartContext } from './context.js';

interface RspfxLocalComponent {
  id: string;
  alias: string;
  bundleName: string;
  amdId: string;
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

interface AmdModule {
  exports: unknown;
}

// The web part bundles call define/require in AMD form. The global define/require
// declarations shipped by @types/requirejs describe the full RequireJS API, which
// this minimal loader does not implement, so install the hooks via a cast.
const amdWindow = window as unknown as {
  define(id: string, deps: string[], factory: (...args: unknown[]) => unknown): void;
  require(id: string): unknown;
};

const registry = new Map<string, AmdModule>();

amdWindow.define = (id, deps, factory) => {
  const mod: AmdModule = { exports: {} };
  const resolved = deps.map((dep) => {
    if (dep === 'require') {
      return (requestedId: string): unknown => registry.get(requestedId)?.exports;
    }
    if (dep === 'exports') {
      return mod.exports;
    }
    if (dep === 'module') {
      return mod;
    }
    return registry.get(dep)?.exports;
  });
  const result = factory(...resolved);
  if (result !== undefined) {
    mod.exports = result;
  }
  registry.set(id, mod);
};

amdWindow.require = (id) => registry.get(id)?.exports;

const EnvironmentInitializer = Environment as unknown as {
  _initialize(data: { type: EnvironmentType }): void;
};

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

async function mountAll(components: RspfxLocalComponent[]): Promise<void> {
  for (const component of components) {
    await mountOne(component);
  }
}

async function mountOne(component: RspfxLocalComponent): Promise<void> {
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
  await loadScript(`/dist/${component.bundleName}.js`);
  const moduleExports = amdWindow.require(component.amdId) as
    | { default?: new () => { render(): void } }
    | undefined;
  const WebPartClass = (moduleExports?.default ?? moduleExports) as
    | (new () => { render(): void })
    | undefined;
  if (typeof WebPartClass !== 'function') {
    throw new Error(
      `Local preview: bundle ${component.bundleName} does not export a web part class ` +
        `(expected default export, found ${moduleExports === undefined ? 'no module' : 'module without default'})`
    );
  }
  try {
    const context = await createLocalWebPartContext(
      {
        id: component.id,
        alias: component.alias,
        preconfiguredEntries: component.preconfiguredEntries,
        componentType: 'WebPart'
      },
      {
        webPartTag: `${component.alias}.${crypto.randomUUID()}`
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
    internal._internalInitialize(context, false, DisplayMode.Read);
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

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
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
