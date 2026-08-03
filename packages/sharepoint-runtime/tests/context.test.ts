import { describe, expect, it } from 'vitest';
import { EnvironmentType, type WebPartContextLike } from '@mbsks/rspfx-core';
import {
  createLocalWebPartContext,
  createMockPageContextData,
  LOCAL_CURRENT_USER,
  createMockThemeProvider,
  createMockSPHttpClient,
  createMockMSGraphClientFactory,
  createMockAadHttpClientFactory,
  type CreateLocalContextOptions,
  type LocalPageContextData,
  type LocalContextServices,
  type LocalThemeProvider,
  type MockSpHttpClient,
  type ScopeLike
} from '../src/index.js';
import { LOCAL_THEMES } from '../src/index.js';

const pageContextServiceKey = { id: 'sp-page-context:PageContext' };
const themeServiceKey = { id: 'sp-component-base:ThemeProvider' };

/**
 * Minimal ServiceScope mirroring the real semantics: provide() before finish(),
 * consume() after finish(), whenFinished() callbacks run at finish().
 */
class TestScope implements ScopeLike {
  private readonly registrations = new Map<string, unknown>();
  private readonly pendingCallbacks: Array<() => void> = [];
  private finished = false;

  provide(key: unknown, instance: unknown): unknown {
    const id = (key as { id: string }).id;
    if (this.registrations.has(id)) {
      throw new Error(`provide() duplicate key ${id}`);
    }
    this.registrations.set(id, instance);
    return instance;
  }

  consume(key: unknown): unknown {
    const id = (key as { id: string }).id;
    const instance = this.registrations.get(id);
    if (!this.finished || instance === undefined) {
      throw new Error(`consume() before finish() or unknown key ${id}`);
    }
    return instance;
  }

  whenFinished(callback: () => void): void {
    if (this.finished) {
      callback();
    } else {
      this.pendingCallbacks.push(callback);
    }
  }

  finish(): void {
    this.finished = true;
    for (const callback of this.pendingCallbacks.splice(0)) {
      callback();
    }
  }
}

type SpHttpClientDuck = MockSpHttpClient & { configurations: { v1: unknown } };

function buildOptions(
  services: Partial<LocalContextServices> = {},
  overrides: Partial<CreateLocalContextOptions> = {}
): CreateLocalContextOptions {
  const domElement = { tagName: 'DIV' } as unknown as HTMLElement;
  return {
    services,
    domElement,
    ...overrides,
    createScope: () => {
      const scope = new TestScope();
      scope.provide(pageContextServiceKey, services.pageContext ?? createMockPageContextData());
      scope.provide(themeServiceKey, services.themeProvider ?? createMockThemeProvider());
      return scope;
    },
    createContext: (scope, element, manifest, instanceId) => ({
      instanceId,
      webPartTag: `LocalWebPart.${instanceId}`,
      domElement: element,
      properties: {},
      environment: { type: EnvironmentType.Local },
      pageContext: (services.pageContext ?? createMockPageContextData()) as LocalPageContextData,
      themeProvider: services.themeProvider ?? createMockThemeProvider(),
      spHttpClient: services.spHttpClient,
      msGraphClientFactory: services.msGraphClientFactory,
      aadHttpClientFactory: services.aadHttpClientFactory,
      httpClient: undefined,
      serviceScope: scope,
      manifest,
      propertyPane: {}
    }) as unknown as WebPartContextLike
  };
}

const minimalManifest = {
  id: 'a2c1c7f1-0000-0000-0000-000000000001',
  alias: 'HelloWorldWebPart',
  preconfiguredEntries: [{ title: 'Hello World', properties: { title: 'Hello' } }]
};

describe('createLocalWebPartContext', () => {
  it('exposes the mock page context a web part sees', async () => {
    const context = await createLocalWebPartContext(minimalManifest, {}, buildOptions());

    expect(context.instanceId).toBeTruthy();
    const pageContext = context.pageContext as unknown as LocalPageContextData;
    expect(pageContext.web.title).toBe('Local Workbench');
    expect(pageContext.web.absoluteUrl).toBe('http://localhost:4321');
    expect(pageContext.web.serverRelativeUrl).toBe('/');
    expect(pageContext.site.absoluteUrl).toBe('http://localhost:4321');
    expect(pageContext.user.displayName).toBe('Dev User');
    expect(pageContext.user).toEqual(LOCAL_CURRENT_USER);
    expect(pageContext.user.isSiteAdmin).toBe(true);
    expect(pageContext.cultureInfo.currentUICultureName).toBe('en-US');
    expect(pageContext.cultureInfo.isRightToLeft).toBe(false);
  });

  it('exposes the http/graph/theme clients a web part sees', async () => {
    const spHttpClient: SpHttpClientDuck = {
      ...createMockSPHttpClient(async () => new Response('{}', { status: 200 })),
      configurations: { v1: {} }
    };
    const graphClientFactory = createMockMSGraphClientFactory();
    const aadHttpClientFactory = createMockAadHttpClientFactory();
    const themeProvider = createMockThemeProvider();
    const context = await createLocalWebPartContext(
      minimalManifest,
      {},
      buildOptions({ spHttpClient, msGraphClientFactory: graphClientFactory, aadHttpClientFactory, themeProvider })
    );

    const ctxSpHttpClient = context.spHttpClient as SpHttpClientDuck;
    expect(ctxSpHttpClient).toBe(spHttpClient);
    expect(ctxSpHttpClient.configurations.v1).toBeDefined();
    expect(typeof ctxSpHttpClient.get).toBe('function');
    expect(typeof ctxSpHttpClient.post).toBe('function');
    await expect(ctxSpHttpClient.get('v1', '/_api/web')).resolves.toMatchObject({ status: 200 });

    const graphClient = await (context.msGraphClientFactory as typeof graphClientFactory).getClient('1');
    await expect(graphClient.api('/v1.0/me').get()).resolves.toMatchObject({
      displayName: 'Dev User',
      userPrincipalName: 'dev@contoso.onmicrosoft.com'
    });
    expect(graphClient.lastRequestPath).toBe('/v1.0/me');

    const graphClientDefaultVersion = await (context.msGraphClientFactory as typeof graphClientFactory).getClient();
    await expect(graphClientDefaultVersion.api('/v1.0/me').get()).resolves.toMatchObject({
      displayName: 'Dev User'
    });

    const theme = (context.themeProvider as LocalThemeProvider).tryGetTheme();
    expect(theme?.palette.themePrimary).toBe(LOCAL_THEMES.light.palette.themePrimary);
    expect((theme?.semanticColors as Record<string, string>).bodyText).toBe(
      LOCAL_THEMES.light.semanticColors.bodyText
    );
  });

  it('passes the provided domElement and generates a non-empty instanceId', async () => {
    const domElement = { tagName: 'DIV' } as unknown as HTMLElement;
    const context = await createLocalWebPartContext(minimalManifest, {}, buildOptions({}, { domElement }));

    expect(context.domElement).toBe(domElement);
    expect(context.instanceId).toBeTruthy();
    expect(context.webPartTag).toBe(`LocalWebPart.${context.instanceId}`);
  });

  it('finishes the serviceScope so it can consume the page context service key', async () => {
    const pageContext = createMockPageContextData({ web: { title: 'Custom Web' } });
    const themeProvider = createMockThemeProvider();
    const context = await createLocalWebPartContext(
      minimalManifest,
      {},
      buildOptions({ pageContext, themeProvider })
    );

    const scope = (context as unknown as { serviceScope: ScopeLike }).serviceScope;
    expect(scope.consume(pageContextServiceKey)).toBe(pageContext);
    expect(scope.consume(themeServiceKey)).toBe(themeProvider);
  });

  it('normalizes the manifest duck for the framework', async () => {
    let seenManifest: unknown;
    const context = await createLocalWebPartContext(minimalManifest, {}, {
      ...buildOptions(),
      createContext: (scope, domElement, manifest, instanceId) => {
        seenManifest = manifest;
        return buildOptions().createContext!(scope, domElement, manifest, instanceId);
      }
    });

    expect(context.instanceId).toBeTruthy();
    const manifest = seenManifest as Record<string, unknown>;
    expect(manifest.id).toBe(minimalManifest.id);
    expect(manifest.alias).toBe('HelloWorldWebPart');
    expect(manifest.componentType).toBe('WebPart');
    expect(manifest.isInternal).toBe(false);
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.manifestVersion).toBe(2);
    expect(manifest.preconfiguredEntries).toBe(minimalManifest.preconfiguredEntries);
  });

  it('spreads overrides last', async () => {
    const context = await createLocalWebPartContext(
      minimalManifest,
      { webPartTag: 'custom-tag', foo: 42 },
      buildOptions()
    );

    expect(context.webPartTag).toBe('custom-tag');
    expect(context.foo).toBe(42);
  });
});
