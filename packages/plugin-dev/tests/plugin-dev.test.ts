import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mock handles so factories can reference them
const hoisted = vi.hoisted(() => {
  return {
    checkNodeVersion: vi.fn(),
    checkViteConfigEsm: vi.fn(),
    resolveTsconfigRaw: vi.fn(() => undefined),
    detectSassAndWarn: vi.fn(() => false),
    detectTailwindAndWarn: vi.fn(() => ({ hasTailwind: false, hasPostcss: false })),
    tryLoadTailwindVitePlugin: vi.fn(() => undefined),
    ensureAndTrustCerts: vi.fn(async () => ({ key: 'mock-key', cert: 'mock-cert' })),
    ensureCertificates: vi.fn(async () => ({ key: 'k', cert: 'c' })),
    readProject: vi.fn(() => ({
      serveJson: { port: 4321, hostname: 'localhost', https: true },
      webParts: { entries: [], bundles: [], manifestIds: [], packageVersion: '1.0.0', syntheticManifests: [] },
      externals: [],
      localizedResources: [],
    })),
    resolveServeSettings: vi.fn(() => ({
      hostname: 'localhost',
      port: 4321,
      https: true,
      scheme: 'https',
      origin: 'https://localhost:4321',
      tenantDomain: 'contoso.sharepoint.com',
      initialPage: undefined,
    })),
    resolveServeMode: vi.fn(() => 'sharepoint' as const),
    loadFrameworkPreset: vi.fn(async () => ({ preset: {}, moduleUrl: '' })),
    resolveConfig: vi.fn((c: any) => ({
      name: c.name ?? 'test',
      version: '1.0.0',
      framework: 'react',
      dev: { port: 4321, https: true, hostname: 'localhost', fastRefresh: false, autoTrust: false, workbench: true, openBrowser: false, ...c.dev },
      build: { outDir: 'dist', ...c.build },
      paths: { webpartsDir: 'src/webparts', extensionsDir: 'src/extensions', librariesDir: 'src/libraries', configDir: 'config', ...c.paths },
      ...c,
    })),
    collectExternals: vi.fn(() => []),
    createLogger: vi.fn(() => ({ warn: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn(function (this: any) { return this; }) })),
    getPlugins: vi.fn(() => []),
    createHookBus: vi.fn(() => ({ emitBeforeStart: async () => ({ ok: true }), emitAfterStart: async () => ({ ok: true }) })),
  };
});

vi.mock('@mbsks/rspfx-core', () => ({
  RSPFX_PLUGIN_MARKER: Symbol.for('@mbsks/rspfx/bundler-plugin'),
  RSPFX_PLUGIN_OPTIONS: Symbol.for('@mbsks/rspfx/options'),
  resolveConfig: hoisted.resolveConfig,
}));

vi.mock('@mbsks/rspfx-dev-runtime', () => ({
  readProject: hoisted.readProject,
  resolveServeSettings: hoisted.resolveServeSettings,
  resolveServeMode: hoisted.resolveServeMode,
  buildWorkbenchUrl: vi.fn(),
  createManifestRegenerator: vi.fn(),
  createRefreshRuntime: vi.fn(),
  createReloadController: vi.fn(() => ({ current: 0, tick: vi.fn(), path: '/__rspfx_hot.json', clientScript: '', handle: vi.fn(), subscribe: vi.fn() })),
  openBrowser: vi.fn(),
  loadFrameworkPreset: hoisted.loadFrameworkPreset,
  createMockSharePointApi: vi.fn(),
  buildLocalPageHtml: vi.fn(),
  readLocalPageComponents: vi.fn(),
}));

vi.mock('@mbsks/rspfx-dev-runtime/vite-shared', () => ({
  VITE_BASE_EXTENSIONS: ['.mjs', '.js', '.mts', '.jsx', '.ts', '.tsx', '.json'],
  resolveTsconfigRaw: hoisted.resolveTsconfigRaw,
  checkNodeVersion: hoisted.checkNodeVersion,
  checkViteConfigEsm: hoisted.checkViteConfigEsm,
  updateOriginWithActualPort: vi.fn((s: any) => s.origin),
  contentTypeFor: vi.fn(),
  safeDecodeWithHops: vi.fn(),
  corsMiddleware: vi.fn(),
  tryResolveFromRoot: vi.fn(),
  isSassInstalled: vi.fn(),
  hasScssFiles: vi.fn(),
  hasPostcssConfig: vi.fn(),
  hasTailwindConfig: vi.fn(),
  getTailwindVersion: vi.fn(),
  detectSassAndWarn: hoisted.detectSassAndWarn,
  detectTailwindAndWarn: hoisted.detectTailwindAndWarn,
  tryLoadTailwindVitePlugin: hoisted.tryLoadTailwindVitePlugin,
  ensureAndTrustCerts: hoisted.ensureAndTrustCerts,
  ensureCertificates: hoisted.ensureCertificates,
  formatTrustInstructions: vi.fn(),
  isCertTrusted: vi.fn(),
  tryTrustCert: vi.fn(),
}));

vi.mock('@mbsks/rspfx-build-core', () => ({
  collectExternals: hoisted.collectExternals,
}));

vi.mock('@mbsks/rspfx-diagnostics', () => ({
  createLogger: hoisted.createLogger,
}));

vi.mock('@mbsks/rspfx-plugin-api', () => ({
  getPlugins: hoisted.getPlugins,
  createHookBus: hoisted.createHookBus,
}));

// Import after mocks
import { rspfxDevPlugin } from '../src/vite.js';

describe('rspfxDevPlugin config()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.detectSassAndWarn.mockReturnValue(false);
    hoisted.detectTailwindAndWarn.mockReturnValue({ hasTailwind: false, hasPostcss: false });
    hoisted.resolveServeMode.mockReturnValue('sharepoint' as any);
    hoisted.resolveServeSettings.mockReturnValue({
      hostname: 'localhost',
      port: 4321,
      https: true,
      scheme: 'https',
      origin: 'https://localhost:4321',
      tenantDomain: 'contoso.sharepoint.com',
      initialPage: undefined,
    });
    hoisted.readProject.mockReturnValue({
      serveJson: { port: 4321, hostname: 'localhost', https: true },
      webParts: { entries: [], bundles: [], manifestIds: [], packageVersion: '1.0.0', syntheticManifests: [] },
      externals: [],
      localizedResources: [],
    } as any);
    hoisted.loadFrameworkPreset.mockResolvedValue({ preset: {}, moduleUrl: '' } as any);
    hoisted.resolveConfig.mockImplementation((c: any) => ({
      name: c.name ?? 'test',
      version: '1.0.0',
      framework: 'react',
      dev: { port: 4321, https: true, hostname: 'localhost', fastRefresh: false, autoTrust: false, workbench: true, openBrowser: false, ...(c.dev ?? {}) },
      build: { outDir: 'dist', ...(c.build ?? {}) },
      paths: { webpartsDir: 'src/webparts', extensionsDir: 'src/extensions', librariesDir: 'src/libraries', configDir: 'config', ...(c.paths ?? {}) },
      ...c,
    }));
    delete process.env.RSPFX_FAST_REFRESH;
    delete process.env.RSPFX_VITE_MODE;
  });

  afterEach(() => {
    delete process.env.RSPFX_FAST_REFRESH;
    delete process.env.RSPFX_VITE_MODE;
  });

  it('calls checkNodeVersion and checkViteConfigEsm', async () => {
    const plugin = rspfxDevPlugin({ name: 'my-app' });
    await plugin.config({}, { command: 'serve', mode: 'development' });
    expect(hoisted.checkNodeVersion).toHaveBeenCalledTimes(1);
    expect(hoisted.checkViteConfigEsm).toHaveBeenCalledTimes(1);
    // first arg is project root (cwd or provided)
    expect(hoisted.checkViteConfigEsm).toHaveBeenCalledWith(expect.any(String));
  });

  it('returns server.https with certs when sharepoint + https + isServe', async () => {
    hoisted.resolveServeMode.mockReturnValue('sharepoint' as any);
    hoisted.resolveServeSettings.mockReturnValue({
      hostname: 'localhost',
      port: 4321,
      https: true,
      scheme: 'https',
      origin: 'https://localhost:4321',
      tenantDomain: 'contoso.sharepoint.com',
    } as any);
    const plugin = rspfxDevPlugin({ name: 'my-app' });
    const result = await plugin.config({}, { command: 'serve', mode: 'development' });
    expect(hoisted.ensureAndTrustCerts).toHaveBeenCalledTimes(1);
    expect(hoisted.ensureAndTrustCerts).toHaveBeenCalledWith(expect.objectContaining({ hostname: 'localhost' }));
    expect(result.server).toMatchObject({ host: 'localhost', port: 4321, https: { key: 'mock-key', cert: 'mock-cert' } });
  });

  it('returns server.https false when local mode or https false or not serve', async () => {
    // local mode -> useHttps false even if settings.https true
    hoisted.resolveServeMode.mockReturnValue('local' as any);
    hoisted.resolveServeSettings.mockReturnValue({
      hostname: 'localhost',
      port: 4321,
      https: true,
      scheme: 'https',
      origin: 'https://localhost:4321',
      tenantDomain: undefined,
    } as any);
    const plugin = rspfxDevPlugin({ name: 'my-app' });
    const resultLocal = await plugin.config({}, { command: 'serve', mode: 'development' });
    expect(resultLocal.server).toMatchObject({ https: false });
    expect(hoisted.ensureAndTrustCerts).not.toHaveBeenCalled();

    // sharepoint but https false
    hoisted.ensureAndTrustCerts.mockClear();
    hoisted.resolveServeMode.mockReturnValue('sharepoint' as any);
    hoisted.resolveServeSettings.mockReturnValue({
      hostname: 'localhost',
      port: 4321,
      https: false,
      scheme: 'http',
      origin: 'http://localhost:4321',
      tenantDomain: 'contoso.sharepoint.com',
    } as any);
    const resultNoHttps = await plugin.config({}, { command: 'serve', mode: 'development' });
    expect(resultNoHttps.server).toMatchObject({ https: false });
    expect(hoisted.ensureAndTrustCerts).not.toHaveBeenCalled();

    // sharepoint https true but build command (not serve) -> https false
    hoisted.resolveServeSettings.mockReturnValue({
      hostname: 'localhost',
      port: 4321,
      https: true,
      scheme: 'https',
      origin: 'https://localhost:4321',
      tenantDomain: 'contoso.sharepoint.com',
    } as any);
    const resultBuild = await plugin.config({}, { command: 'build', mode: 'production' });
    expect(resultBuild.server).toMatchObject({ https: false });
    expect(hoisted.ensureAndTrustCerts).not.toHaveBeenCalled();
  });

  it('filters disallowed define keys (RSPFx leakage and non-allowlist)', async () => {
    // enable fastRefresh to get viteContribs
    hoisted.resolveConfig.mockImplementation((c: any) => ({
      name: c.name ?? 'test',
      version: '1.0.0',
      framework: 'react',
      dev: { port: 4321, https: true, hostname: 'localhost', fastRefresh: true, autoTrust: false, workbench: true, openBrowser: false },
      build: { outDir: 'dist' },
      paths: { webpartsDir: 'src/webparts' },
      ...c,
    }));
    process.env.RSPFX_FAST_REFRESH = '1';
    hoisted.loadFrameworkPreset.mockResolvedValue({
      preset: {
        vite: () => ({
          define: {
            DEBUG: JSON.stringify(true),
            'process.env.NODE_ENV': JSON.stringify('development'),
            'RSPFX_SECRET': JSON.stringify('leak'),
            'RSPFx_leak': JSON.stringify('leak2'),
            'SOME_RANDOM': JSON.stringify('blocked'),
          },
          plugins: [],
        }),
      },
      moduleUrl: '',
    } as any);
    const plugin = rspfxDevPlugin({ name: 'my-app' });
    const result = await plugin.config({}, { command: 'serve', mode: 'development' });
    // allowed keys kept, disallowed filtered
    expect(result.define).toHaveProperty('DEBUG');
    expect(result.define).toHaveProperty('process.env.NODE_ENV');
    expect(result.define).not.toHaveProperty('RSPFX_SECRET');
    expect(result.define).not.toHaveProperty('RSPFx_leak');
    expect(result.define).not.toHaveProperty('SOME_RANDOM');
    // defaults still present
    expect(result.define).toHaveProperty('DEPRECATED_UNIT_TEST');
  });

  it('keeps allowed define keys from viteContribs', async () => {
    hoisted.resolveConfig.mockImplementation((c: any) => ({
      name: c.name ?? 'test',
      version: '1.0.0',
      framework: 'react',
      dev: { port: 4321, https: true, hostname: 'localhost', fastRefresh: true, autoTrust: false },
      build: { outDir: 'dist' },
      paths: { webpartsDir: 'src/webparts' },
      ...c,
    }));
    process.env.RSPFX_FAST_REFRESH = '1';
    hoisted.loadFrameworkPreset.mockResolvedValue({
      preset: {
        vite: () => ({
          define: {
            DEBUG: JSON.stringify(false),
          },
          plugins: [],
        }),
      },
      moduleUrl: '',
    } as any);
    const plugin = rspfxDevPlugin({ name: 'my-app' });
    const result = await plugin.config({}, { command: 'serve', mode: 'development' });
    expect(result.define).toHaveProperty('DEBUG', JSON.stringify(false));
  });

  it('includes css preprocessorOptions when sass installed vs not', async () => {
    hoisted.detectSassAndWarn.mockReturnValue(true);
    const plugin = rspfxDevPlugin({ name: 'my-app' });
    const withSass = await plugin.config({}, { command: 'serve', mode: 'development' });
    expect((withSass.css as any).preprocessorOptions).toBeDefined();
    expect((withSass.css as any).preprocessorOptions.scss).toEqual({ api: 'modern' });

    hoisted.detectSassAndWarn.mockReturnValue(false);
    const plugin2 = rspfxDevPlugin({ name: 'my-app' });
    const withoutSass = await plugin2.config({}, { command: 'serve', mode: 'development' });
    expect((withoutSass.css as any).preprocessorOptions).toBeUndefined();
    // modules always present
    expect((withSass.css as any).modules).toEqual({ localsConvention: 'asIs', scopeBehaviour: 'local' });
    expect((withoutSass.css as any).modules).toEqual({ localsConvention: 'asIs', scopeBehaviour: 'local' });
  });

  it('resolves tsconfigRaw and includes esbuild.tsconfigRaw when present', async () => {
    hoisted.resolveTsconfigRaw.mockReturnValue({ compilerOptions: { jsx: 'react' } } as any);
    hoisted.resolveConfig.mockImplementation((c: any) => ({
      name: c.name ?? 'test',
      version: '1.0.0',
      framework: 'react',
      dev: { port: 4321, https: true, hostname: 'localhost', fastRefresh: false, autoTrust: false },
      build: { outDir: 'dist' },
      paths: { webpartsDir: 'src/webparts' },
      ...c,
    }));
    const plugin = rspfxDevPlugin({ name: 'my-app' });
    const result = await plugin.config({}, { command: 'serve', mode: 'development' });
    expect(result.esbuild).toBeDefined();
    expect((result.esbuild as any).tsconfigRaw).toBe(JSON.stringify({ compilerOptions: { jsx: 'react' } }));

    hoisted.resolveTsconfigRaw.mockReturnValue(undefined);
    const plugin2 = rspfxDevPlugin({ name: 'my-app' });
    const result2 = await plugin2.config({}, { command: 'serve', mode: 'development' });
    expect(result2.esbuild).toBeUndefined();
  });
});
