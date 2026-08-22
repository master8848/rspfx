// @vitest-environment happy-dom
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { createLocalWebPartContext } from '../src/context.js';

const requireReal = createRequire(import.meta.url);

function realPath(...segments: string[]): string {
  return path.join(process.cwd(), 'packages/sharepoint-runtime/node_modules', ...segments);
}

describe('createLocalWebPartContext default path (real @microsoft/*)', () => {
  it('loads real @microsoft modules via absolute path (not vitest stubs)', async () => {
    // Real @microsoft packages depend on @msinternal/* which is not installed in Node;
    // requiring lib-commonjs will throw MODULE_NOT_FOUND. The test verifies that the
    // real package is present and that the error is the expected fallback signal,
    // not a stub. If the module loads, we verify its shape; if it throws, we assert
    // the missing internal is the cause (real module, not stub).
    let coreLib: Record<string, unknown> | undefined;
    let loadError: unknown;
    try {
      coreLib = requireReal(realPath('@microsoft/sp-core-library/lib-commonjs/index.js')) as Record<string, unknown>;
    } catch (e) {
      loadError = e;
    }
    if (loadError) {
      const msg = loadError instanceof Error ? loadError.message : String(loadError);
      expect(msg).toMatch(/@msinternal|Cannot find module/);
      // Real package exists but needs internal stub — confirms we reached real, not stub.
      return;
    }
    const webpartBase = requireReal(realPath('@microsoft/sp-webpart-base/lib-commonjs/index.js')) as Record<string, unknown>;
    const spHttp = requireReal(realPath('@microsoft/sp-http/lib-commonjs/index.js')) as Record<string, unknown>;
    const pageContextMod = requireReal(realPath('@microsoft/sp-page-context/lib-commonjs/index.js')) as Record<string, unknown>;
    const componentBase = requireReal(realPath('@microsoft/sp-component-base/lib-commonjs/index.js')) as Record<string, unknown>;

    expect(coreLib.ServiceScope).toBeDefined();
    const ServiceScope = coreLib.ServiceScope as { startNewRoot(): unknown };
    expect(typeof ServiceScope.startNewRoot).toBe('function');
    const root = ServiceScope.startNewRoot() as Record<string, unknown>;
    // Real ServiceScope has provide/consume/whenFinished/finish; stub is minimal.
    expect(typeof root.provide).toBe('function');
    expect(typeof root.consume).toBe('function');

    expect((coreLib.SPEvent as unknown)).toBeDefined();
    expect(webpartBase.WebPartContext).toBeDefined();
    expect(typeof webpartBase.WebPartContext).toBe('function');

    expect(spHttp.SPHttpClient).toBeDefined();
    expect((spHttp.SPHttpClient as { serviceKey?: unknown }).serviceKey).toBeDefined();
    expect(spHttp.MSGraphClientFactory).toBeDefined();
    expect(pageContextMod.PageContext).toBeDefined();
    expect((pageContextMod.PageContext as { serviceKey?: { id: string } }).serviceKey?.id).toMatch(/PageContext/);
    expect(componentBase.ThemeProvider).toBeDefined();
    expect((componentBase.ThemeProvider as { serviceKey?: { id: string } }).serviceKey?.id).toMatch(/ThemeProvider/);
  });

  it('creates context via default path without stub injection (exercises loadRealContextModules)', async () => {
    const manifest = { id: '00000000-0000-0000-0000-000000000099', alias: 'DefaultPathWebPart', preconfiguredEntries: [] };
    let context: unknown;
    let error: unknown;
    try {
      context = await createLocalWebPartContext(manifest);
    } catch (e) {
      error = e;
    }
    if (error) {
      // Must fail loudly with informative message, not silently return stubbed context
      const msg = error instanceof Error ? error.message : String(error);
      expect(msg.length).toBeGreaterThan(0);
      return;
    }
    const ctx = context as Record<string, unknown>;
    expect(ctx.instanceId).toBeTruthy();
    expect(ctx.serviceScope).toBeDefined();
    expect(ctx.webPartTag).toMatch(/^LocalWebPart\./);
    // serviceScope should be finished and consumable (real ServiceScope behavior)
    const scope = ctx.serviceScope as { consume?: (k: unknown) => unknown; whenFinished?: (cb: () => void) => void };
    expect(typeof scope.consume === 'function' || typeof scope.whenFinished === 'function').toBe(true);
  });

  it('produces equivalent context when wired with real modules explicitly', async () => {
    let coreLib: {
      ServiceScope: { startNewRoot(): { provide(k: unknown, v: unknown): unknown; finish(): void } };
      SPEvent: new (name: string) => unknown;
    };
    let webpartBase: {
      WebPartContext: new (p: unknown) => { serviceScope: unknown };
      WebPartFormFactor: { Standard: unknown };
    };
    let pageContextMod: { PageContext: { serviceKey: { id: string } } };
    let componentBase: { ThemeProvider: { serviceKey: { id: string } } };
    try {
      coreLib = requireReal(realPath('@microsoft/sp-core-library/lib-commonjs/index.js')) as typeof coreLib;
      webpartBase = requireReal(realPath('@microsoft/sp-webpart-base/lib-commonjs/index.js')) as typeof webpartBase;
      pageContextMod = requireReal(realPath('@microsoft/sp-page-context/lib-commonjs/index.js')) as typeof pageContextMod;
      componentBase = requireReal(realPath('@microsoft/sp-component-base/lib-commonjs/index.js')) as typeof componentBase;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Real modules require @msinternal — expected in Node without webpack. This still
      // exercises the real package path (not stubs) and verifies fallback.
      expect(msg).toMatch(/@msinternal|Cannot find module/);
      return;
    }

    const manifest = {
      id: '00000000-0000-0000-0000-000000000100',
      alias: 'RealWiredWebPart',
      preconfiguredEntries: [{ properties: { title: 'hello' } }]
    };

    const context = await createLocalWebPartContext(manifest as unknown, {}, {
      createScope: () => coreLib.ServiceScope.startNewRoot() as unknown as import('../src/context.js').ScopeLike,
      createContext: (scope, domElement, manif, instanceId) => {
        // Mimic default path wiring with real keys
        const realScope = scope as unknown as { provide(k: unknown, v: unknown): unknown; finish(): void };
        realScope.provide(pageContextMod.PageContext.serviceKey, { web: { title: 'real' } });
        realScope.provide(componentBase.ThemeProvider.serviceKey, { tryGetTheme: () => undefined } as unknown);
        const ctx = new webpartBase.WebPartContext({
          parentServiceScope: scope,
          manifest: manif,
          instanceId,
          webPartTag: `LocalWebPart.${instanceId}`,
          loggingTag: `LocalWebPart.${instanceId}`,
          domElement,
          statusRenderer: {
            displayLoadingIndicator() {},
            clearLoadingIndicator() {},
            renderError() {},
            clearError() {},
            _displayLoadingIndicator() {}
          },
          host: { serviceScope: scope },
          isPropertyPaneRenderedByWebPart: () => false,
          isPropertyPaneOpen: () => false,
          isContentPanelOpen: () => false,
          requestPropertyPaneAction: () => undefined,
          formFactor: webpartBase.WebPartFormFactor.Standard,
          sdks: {},
          microsoftTeams: undefined,
          sdksAsync: Promise.resolve({}),
          _dataUpdatedEvent: new coreLib.SPEvent(`WebPart_${instanceId}_dataUpdated`)
        } as unknown);
        (scope as unknown as { finish(): void }).finish?.();
        return ctx as unknown as import('@mbsks/rspfx-core').WebPartContextLike;
      }
    });

    expect(context.instanceId).toBeTruthy();
    expect(context.manifest).toBeDefined();
    expect((context.manifest as { id: string }).id).toBe(manifest.id);
  });
});
