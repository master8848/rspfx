/**
 * Local preview extension contexts: real `ApplicationCustomizerContext` /
 * `FieldCustomizerContext` / `ListViewCommandSetContext` instances built with
 * the bundled `@microsoft/sp-*` packages (browser) — same lazy-import + seam
 * pattern as `createLocalWebPartContext`, so Node tests never import the real
 * sp-* extension packages.
 *
 * Lifecycle mirror of the real sp-loader (discovered in the 1.23.2 dists):
 * `new (bundle default export)()` → `instance._init(context, propsJson, seq)`
 * (BaseExtension._init → _initializeContext → _deserializeProperties →
 * _initializeExtensionType → onInit).
 */
import { createMockThemeProvider, type LocalThemeProvider } from './theme.js';
import { createMockMSGraphClientFactory, createMockAadHttpClientFactory } from './http.js';
import {
  createMockPageContextData,
  type LocalContextServices,
  type LocalPageContextInput,
  type ScopeLike
} from './context.js';

export type LocalExtensionType = 'ApplicationCustomizer' | 'FieldCustomizer' | 'ListViewCommandSet';

export interface LocalExtensionContextOptions {
  /** Service instances to provide under the real service keys (defaults: mocks). */
  services?: Partial<LocalContextServices>;
  /** Test seam: build the parent ServiceScope (default: `ServiceScope.startNewRoot()`). */
  createScope?: () => ScopeLike;
  /** Test seam: build the extension context (default: the real context class). */
  createContext?: (
    scope: ScopeLike,
    domElement: HTMLElement,
    manifest: unknown,
    instanceId: string
  ) => unknown;
  /** DOM element hosting the extension (default: a fresh `document.createElement('div')`). */
  domElement?: HTMLElement;
  /** Page context data (defaults to `createMockPageContextData()`). */
  pageContextData?: LocalPageContextInput;
  /**
   * ApplicationCustomizer only: host DOM elements for placeholders (name →
   * element, e.g. `Top` / `Bottom`). Elements are attached to the placeholder
   * manager so `tryCreateContent(name)` renders inside them.
   */
  placeholderHosts?: { name: string; domElement: HTMLElement }[];
  /** ListViewCommandSet / FieldCustomizer: the list view accessor (default: a fresh one). */
  listView?: unknown;
  /** FieldCustomizer only: the field info exposed as `context.field`. */
  field?: unknown;
}

/**
 * Mock placeholder provider for tests and seam-injected contexts: the minimal
 * surface the real `ApplicationCustomizerContext.placeholderProvider` exposes
 * (`tryCreateContent`, `containsPlaceholder`, `placeholders`, `changedEvent`).
 */
export interface MockPlaceholderContent {
  name: string;
  domElement: HTMLElement;
}

export interface MockPlaceholderProvider {
  tryCreateContent(name: string): MockPlaceholderContent | undefined;
  containsPlaceholder(name: string): boolean;
  placeholders: Map<string, { domElement: HTMLElement }>;
  changedEvent: {
    add(target: unknown, callback: () => void): void;
    remove(target: unknown, callback: () => void): void;
  };
}

export function createMockPlaceholderProvider(names: string[] = ['Top', 'Bottom']): MockPlaceholderProvider {
  const hosts = new Map<string, { domElement: HTMLElement }>();
  for (const name of names) {
    hosts.set(name, { domElement: document.createElement('div') });
  }
  const listeners = new Map<unknown, () => void>();
  return {
    tryCreateContent(name: string): MockPlaceholderContent | undefined {
      const host = hosts.get(name);
      if (!host) {
        return undefined;
      }
      const content = document.createElement('div');
      host.domElement.appendChild(content);
      return { name, domElement: content };
    },
    containsPlaceholder(name: string): boolean {
      return hosts.has(name);
    },
    placeholders: hosts,
    changedEvent: {
      add(target: unknown, callback: () => void): void {
        listeners.set(target, callback);
      },
      remove(target: unknown): void {
        listeners.delete(target);
      }
    }
  };
}

export async function createLocalExtensionContext(
  manifest: unknown,
  extensionType: LocalExtensionType,
  options: LocalExtensionContextOptions = {}
): Promise<unknown> {
  const services: LocalContextServices = {
    msGraphClientFactory: createMockMSGraphClientFactory(),
    aadHttpClientFactory: createMockAadHttpClientFactory(),
    pageContext: createMockPageContextData(options.pageContextData),
    themeProvider: createMockThemeProvider(),
    ...options.services
  };

  const instanceId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `ext-${Date.now()}`;
  const domElement = options.domElement ?? createDomElement();
  const normalizedManifest = normalizeExtensionManifest(manifest, extensionType);

  if (options.createScope && options.createContext) {
    const scope = options.createScope();
    const context = options.createContext(scope, domElement, normalizedManifest, instanceId);
    scope.finish?.();
    return context;
  }

  const real = await loadRealExtensionModules();
  const parentScope = real.ServiceScope.startNewRoot() as unknown as ScopeLike;
  parentScope.provide(real.PageContext.serviceKey, services.pageContext);
  parentScope.provide(real.ThemeProvider.serviceKey, services.themeProvider);

  if (extensionType === 'ApplicationCustomizer') {
    // The real ApplicationCustomizerContext consumes the PlaceholderManager
    // from its parent scope and finishes its own scope in the constructor, so
    // the parent must be provided and finished first.
    const manager = new real.PlaceholderManager(parentScope);
    parentScope.provide(real.PlaceholderManagerServiceKey, manager);
    parentScope.finish?.();
    const context = new real.ApplicationCustomizerContext(
      {
        manifest: normalizedManifest,
        parentServiceScope: parentScope,
        instanceId,
        loggingTag: `Extension.${getManifestId(normalizedManifest)}.${instanceId}`
      },
      {
        sequence: 65535,
        preAllocatedApplicationCustomizerTopHeight: 0,
        preAllocatedApplicationCustomizerBottomHeight: 0
      }
    );
    attachPlaceholderHosts(manager, real.placeholderNameValues, options.placeholderHosts);
    return context;
  }

  // The ListViewCommandSetContext localizes command titles in a whenFinished
  // callback that consumes the PageContext, so the parent must be finished
  // before the context's own scope is finished during `_init`.
  parentScope.finish?.();
  const contextParameters = {
    manifest: normalizedManifest,
    parentServiceScope: parentScope,
    instanceId,
    loggingTag: `Extension.${getManifestId(normalizedManifest)}.${instanceId}`
  };
  if (extensionType === 'FieldCustomizer') {
    return new real.FieldCustomizerContext(
      contextParameters,
      { listView: options.listView ?? new real.ListViewAccessor(instanceId), field: options.field }
    );
  }
  return new real.ListViewCommandSetContext(
    contextParameters,
    { listView: options.listView ?? new real.ListViewAccessor(instanceId) }
  );
}

function attachPlaceholderHosts(
  manager: PlaceholderManagerLike,
  placeholderNameValues: Record<string, number>,
  hosts: { name: string; domElement: HTMLElement }[] | undefined
): void {
  const definitions: { name: number; domElement: HTMLElement }[] = [];
  for (const host of hosts ?? []) {
    const name = placeholderNameValues[host.name];
    if (name === undefined) {
      console.warn(`[rspfx] local preview: no placeholder named '${host.name}' in this SPFx version`);
      continue;
    }
    definitions.push({ name, domElement: host.domElement });
  }
  if (definitions.length > 0) {
    manager.initializePlaceholders(definitions);
  }
  // tryCreateContent refuses to create content until the manager is enabled.
  manager._enable();
}

function createDomElement(): HTMLElement {
  return typeof document !== 'undefined'
    ? document.createElement('div')
    : (undefined as unknown as HTMLElement);
}

function getManifestId(manifest: Record<string, unknown>): string {
  return typeof manifest.id === 'string' ? manifest.id : '00000000-0000-0000-0000-000000000000';
}

function normalizeExtensionManifest(manifest: unknown, extensionType: LocalExtensionType): Record<string, unknown> {
  const data = (manifest ?? {}) as Record<string, unknown>;
  return {
    id: data.id ?? '00000000-0000-0000-0000-000000000000',
    alias: data.alias ?? 'LocalExtension',
    version: data.version ?? '1.0.0',
    manifestVersion: data.manifestVersion ?? 2,
    isInternal: false,
    preconfiguredEntries: data.preconfiguredEntries ?? [],
    items: data.items ?? {},
    loaderConfig: data.loaderConfig ?? { internalModuleBaseUrls: [] },
    ...data,
    componentType: 'Extension',
    extensionType
  };
}

export interface PlaceholderManagerLike {
  initializePlaceholders(definitions: { name: number; domElement: HTMLElement }[]): void;
  _enable(): void;
}

interface RealExtensionModules {
  ServiceScope: { startNewRoot(): unknown };
  PageContext: { serviceKey: { id: string } };
  ThemeProvider: { serviceKey: { id: string } };
  ApplicationCustomizerContext: new (parameters: unknown, options: unknown) => unknown;
  PlaceholderManager: new (scope: unknown) => PlaceholderManagerLike;
  PlaceholderManagerServiceKey: { id: string };
  placeholderNameValues: Record<string, number>;
  FieldCustomizerContext: new (parameters: unknown, options: unknown) => unknown;
  ListViewCommandSetContext: new (parameters: unknown, options: unknown) => unknown;
  ListViewAccessor: new (instanceId: string) => unknown;
  ListItemAccessor: new () => unknown;
  RowAccessor: new () => unknown;
}

async function loadRealExtensionModules(): Promise<RealExtensionModules> {
  const [coreLibrary, pageContext, componentBase, applicationBase, listviewExtensibility] = await Promise.all([
    import('@microsoft/sp-core-library'),
    import('@microsoft/sp-page-context'),
    import('@microsoft/sp-component-base'),
    import('@microsoft/sp-application-base'),
    import('@microsoft/sp-listview-extensibility')
  ]);
  const appBase = applicationBase as unknown as {
    ApplicationCustomizerContext: RealExtensionModules['ApplicationCustomizerContext'];
    _PlaceholderManager: RealExtensionModules['PlaceholderManager'];
  };
  const listview = listviewExtensibility as unknown as {
    FieldCustomizerContext: RealExtensionModules['FieldCustomizerContext'];
    ListViewCommandSetContext: RealExtensionModules['ListViewCommandSetContext'];
    ListViewAccessor: RealExtensionModules['ListViewAccessor'];
    ListItemAccessor: RealExtensionModules['ListItemAccessor'];
    RowAccessor: RealExtensionModules['RowAccessor'];
  };
  const placeholderNameValues: Record<string, number> = {};
  const placeholderNames = applicationBase.PlaceholderName as unknown as Record<string, string | number>;
  for (const key in placeholderNames) {
    const value = placeholderNames[key];
    if (typeof value === 'number') {
      placeholderNameValues[key] = value;
    }
  }
  const placeholderManager = appBase._PlaceholderManager as unknown as RealExtensionModules['PlaceholderManager'];
  return {
    ServiceScope: coreLibrary.ServiceScope,
    PageContext: pageContext.PageContext,
    ThemeProvider: componentBase.ThemeProvider,
    ApplicationCustomizerContext: appBase.ApplicationCustomizerContext,
    PlaceholderManager: placeholderManager,
    PlaceholderManagerServiceKey: (placeholderManager as unknown as { serviceKey: { id: string } }).serviceKey,
    placeholderNameValues,
    FieldCustomizerContext: listview.FieldCustomizerContext,
    ListViewCommandSetContext: listview.ListViewCommandSetContext,
    ListViewAccessor: listview.ListViewAccessor,
    ListItemAccessor: listview.ListItemAccessor,
    RowAccessor: listview.RowAccessor
  };
}
