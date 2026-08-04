import type { WebPartContextLike } from '@mbsks/rspfx-core';
import { createMockThemeProvider, type LocalThemeProvider } from './theme.js';
import { createMockMSGraphClientFactory, createMockAadHttpClientFactory } from './http.js';
import { resolveLocale, type ResolvedLocale } from './locales.js';

/**
 * Local preview context: a real `WebPartContext` (constructed with
 * `new WebPartContext(parameters)` from the bundled `@microsoft/sp-webpart-base`)
 * whose service scope is wired with emulated services under the *real* service keys
 * (`PageContext.serviceKey`, `ThemeProvider.serviceKey`, ...). Because the scope
 * finishes, every framework (React/Fluent included) sees a context that behaves
 * like the workbench one — only the data behind it is local.
 *
 * The `@microsoft/sp-*` modules are loaded lazily (static-string dynamic
 * imports) so this module stays importable in Node tests without the real
 * packages — tests inject `createScope`/`createContext` instead.
 */

export interface LocalPageContextData {
  web: Record<string, unknown>;
  site: Record<string, unknown>;
  user: Record<string, unknown>;
  list?: Record<string, unknown>;
  listItem?: Record<string, unknown>;
  cultureInfo: { currentCultureName: string; currentUICultureName: string; isRightToLeft?: boolean };
}

/** `createMockPageContextData` input: page context overrides plus an optional locale tag (`fr-fr`, `ar-sa`, …). */
export type LocalPageContextInput = Partial<LocalPageContextData> & { locale?: string };

export const LOCAL_CURRENT_USER = {
  id: 1,
  loginName: 'i:0#.f|membership|dev@contoso.onmicrosoft.com',
  title: 'Dev User',
  displayName: 'Dev User',
  email: 'dev@contoso.onmicrosoft.com',
  userPrincipalName: 'dev@contoso.onmicrosoft.com',
  isSiteAdmin: true,
  isAnonymousGuestUser: false,
  isExternalGuestUser: false,
  preferUserTimeZone: false
};

export function createMockPageContextData(
  overrides: LocalPageContextInput = {}
): LocalPageContextData {
  const resolved: ResolvedLocale = resolveLocale(overrides.locale);
  return {
    web: {
      id: '3d81f5a1-0000-0000-0000-000000000001',
      title: 'Local Workbench',
      description: '',
      absoluteUrl: 'http://localhost:4321',
      serverRelativeUrl: '/',
      isAppWeb: false,
      language: resolved.language,
      languageName: resolved.languageName,
      logoUrl: null,
      permissions: { viewListItems: true },
      templateName: 'Team site',
      created: '2024-01-01T00:00:00Z',
      lastItemModifiedDate: '2024-01-01T00:00:00Z',
      currentUser: LOCAL_CURRENT_USER
    },
    site: {
      id: '3d81f5a1-0000-0000-0000-000000000002',
      title: 'Local Workbench',
      absoluteUrl: 'http://localhost:4321',
      serverRelativeUrl: '/',
      classification: '',
      group: null,
      cdnPrefix: '',
      correlationId: '00000000-0000-0000-0000-000000000000',
      isNoScriptEnabled: false,
      recycleBinItemCount: 0,
      serverRequestPath: '/',
      sitePagesEnabled: true,
      sitePagesFeatureVersion: 0
    },
    user: LOCAL_CURRENT_USER,
    list: {
      id: '3d81f5a1-0000-0000-0000-000000000010',
      title: 'Announcements',
      serverRelativeUrl: '/Lists/Announcements',
      itemCount: 3,
      permissions: { viewListItems: true }
    },
    listItem: { id: 1, uniqueId: '3d81f5a1-0000-0000-0000-000000000011' },
    cultureInfo: {
      currentCultureName: resolved.cultureInfo.currentCultureName,
      currentUICultureName: resolved.cultureInfo.currentUICultureName,
      isRightToLeft: resolved.cultureInfo.isRightToLeft
    },
    ...overrides
  };
}

export interface ScopeLike {
  provide(key: unknown, instance: unknown): unknown;
  consume(key: unknown): unknown;
  whenFinished(callback: () => void): void;
  finish?(): void;
}

export interface LocalContextServices {
  /** SPHttpClient override; when omitted the REAL SPHttpClient (the child-scope default created by BaseComponentContext) is kept — it works against the dev server. */
  spHttpClient?: unknown;
  msGraphClientFactory: unknown;
  aadHttpClientFactory: unknown;
  pageContext: unknown;
  themeProvider: LocalThemeProvider;
}

export interface CreateLocalContextOptions {
  /** Service instances to provide under the real service keys (defaults: mocks). */
  services?: Partial<LocalContextServices>;
  /** Test seam: build the parent ServiceScope (default: `ServiceScope.startNewRoot()`). */
  createScope?: () => ScopeLike;
  /** Test seam: build the WebPartContext (default: `new WebPartContext(parameters)`). */
  createContext?: (
    scope: ScopeLike,
    domElement: HTMLElement,
    manifest: unknown,
    instanceId: string
  ) => WebPartContextLike;
  /** DOM element hosting the web part (default: a fresh `document.createElement('div')`). */
  domElement?: HTMLElement;
  /** Page context data (defaults to `createMockPageContextData()`). */
  pageContextData?: LocalPageContextInput;
}

export async function createLocalWebPartContext(
  manifest: unknown,
  overrides: Record<string, unknown> = {},
  options: CreateLocalContextOptions = {}
): Promise<WebPartContextLike> {
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
      : `wp-${Date.now()}`;
  const webPartTag = `LocalWebPart.${instanceId}`;
  const domElement = options.domElement ?? createDomElement();
  const webPartManifest = normalizeManifest(manifest);

  if (options.createScope && options.createContext) {
    const scope = options.createScope();
    const context = options.createContext(scope, domElement, webPartManifest, instanceId);
    scope.finish?.();
    return withOverrides(context, overrides);
  }

  const real = await loadRealContextModules();
  const parentScope = real.ServiceScope.startNewRoot() as unknown as ScopeLike;
  parentScope.provide(real.PageContext.serviceKey, services.pageContext);
  parentScope.provide(real.ThemeProvider.serviceKey, services.themeProvider);

  const context = new real.WebPartContext({
    parentServiceScope: parentScope,
    manifest: webPartManifest,
    instanceId,
    webPartTag,
    loggingTag: webPartTag,
    domElement,
    statusRenderer: LOCAL_STATUS_RENDERER,
    host: { serviceScope: parentScope },
    isPropertyPaneRenderedByWebPart: () => false,
    isPropertyPaneOpen: () => false,
    isContentPanelOpen: () => false,
    requestPropertyPaneAction: () => undefined,
    formFactor: real.WebPartFormFactor.Standard,
    sdks: {},
    microsoftTeams: undefined,
    sdksAsync: Promise.resolve({}),
    widthCacheKey: undefined,
    pageLayoutType: undefined,
    getPositionOnPage: undefined,
    _dataUpdatedEvent: new real.SPEvent(`WebPart_${instanceId}_dataUpdated`)
  });

  // BaseComponentContext's constructor createDefaultAndProvide'd the real SPHttpClient,
  // HttpClient, MSGraphClientFactory, AadHttpClientFactory and AadTokenProviderFactory
  // in the CHILD scope, so those keys cannot be re-provided (provide() throws on a
  // duplicate in the same scope) and a parent-provided mock would be shadowed by the
  // child registration. The mock factories replace the child registrations in place.
  const childScope = context.serviceScope as unknown as ScopeRegistrations;
  replaceChildService(childScope, real.MSGraphClientFactory.serviceKey, services.msGraphClientFactory);
  replaceChildService(childScope, real.AadHttpClientFactory.serviceKey, services.aadHttpClientFactory);
  replaceChildService(childScope, real.AadTokenProviderFactory.serviceKey, LOCAL_AAD_TOKEN_PROVIDER_FACTORY);
  if (services.spHttpClient !== undefined) {
    replaceChildService(childScope, real.SPHttpClient.serviceKey, services.spHttpClient);
  }

  // The child scope's whenFinished consumers (PageContext, theme, http clients) walk up
  // the scope chain, so the parent must be finished before the framework finishes the child.
  parentScope.finish?.();
  return withOverrides(context as unknown as WebPartContextLike, overrides);
}

function withOverrides(context: WebPartContextLike, overrides: Record<string, unknown>): WebPartContextLike {
  return overrides && Object.keys(overrides).length > 0 ? { ...context, ...overrides } : context;
}

function createDomElement(): HTMLElement {
  return typeof document !== 'undefined'
    ? document.createElement('div')
    : (undefined as unknown as HTMLElement);
}

function normalizeManifest(manifest: unknown): Record<string, unknown> {
  const data = (manifest ?? {}) as Record<string, unknown>;
  return {
    id: data.id ?? '00000000-0000-0000-0000-000000000000',
    alias: data.alias ?? 'LocalWebPart',
    version: data.version ?? '1.0.0',
    manifestVersion: data.manifestVersion ?? 2,
    componentType: 'WebPart',
    isInternal: false,
    preconfiguredEntries: data.preconfiguredEntries ?? [],
    ...data
  };
}

const LOCAL_STATUS_RENDERER = {
  displayLoadingIndicator(): void {},
  clearLoadingIndicator(): void {},
  renderError(): void {},
  clearError(): void {},
  _displayLoadingIndicator(): void {}
};

const LOCAL_AAD_TOKEN_PROVIDER_FACTORY = {
  getTokenProvider: async () => ({
    getToken: async () => 'rspfx-local-preview-token'
  })
};

interface ScopeRegistrations {
  _registrations: Record<string, { service: unknown }>;
}

function replaceChildService(scope: ScopeRegistrations, serviceKey: { id: string }, service: unknown): void {
  scope._registrations[serviceKey.id] = { service };
}

interface RealContextModules {
  ServiceScope: { startNewRoot(): unknown };
  WebPartContext: new (parameters: unknown) => { serviceScope: unknown };
  SPEvent: new (name: string) => unknown;
  WebPartFormFactor: { Standard: unknown };
  SPHttpClient: { serviceKey: { id: string } };
  MSGraphClientFactory: { serviceKey: { id: string } };
  AadHttpClientFactory: { serviceKey: { id: string } };
  AadTokenProviderFactory: { serviceKey: { id: string } };
  PageContext: { serviceKey: { id: string } };
  ThemeProvider: { serviceKey: { id: string } };
}

async function loadRealContextModules(): Promise<RealContextModules> {
  const [coreLibrary, webpartBaseModule, spHttp, pageContext, componentBase] = await Promise.all([
    import('@microsoft/sp-core-library'),
    import('@microsoft/sp-webpart-base'),
    import('@microsoft/sp-http'),
    import('@microsoft/sp-page-context'),
    import('@microsoft/sp-component-base')
  ]);
  // WebPartFormFactor is excluded from the public release typings of
  // sp-webpart-base@1.23.2 (it exists at runtime), so cast the module.
  const webpartBase = webpartBaseModule as unknown as {
    WebPartContext: RealContextModules['WebPartContext'];
    WebPartFormFactor: RealContextModules['WebPartFormFactor'];
  };
  return {
    ServiceScope: coreLibrary.ServiceScope,
    WebPartContext: webpartBase.WebPartContext,
    SPEvent: coreLibrary.SPEvent as RealContextModules['SPEvent'],
    WebPartFormFactor: webpartBase.WebPartFormFactor,
    SPHttpClient: spHttp.SPHttpClient as RealContextModules['SPHttpClient'],
    MSGraphClientFactory: spHttp.MSGraphClientFactory,
    AadHttpClientFactory: spHttp.AadHttpClientFactory,
    AadTokenProviderFactory: spHttp.AadTokenProviderFactory,
    PageContext: pageContext.PageContext,
    ThemeProvider: componentBase.ThemeProvider
  };
}
