import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@mbsks/rspfx-dev-runtime', async () => {
  const actual = await vi.importActual<typeof import('@mbsks/rspfx-dev-runtime')>('@mbsks/rspfx-dev-runtime');
  return {
    ...actual,
    createCompileContext: vi.fn((opts: unknown) => {
      // call through to actual for realistic shape but also track
      return (actual.createCompileContext as unknown as (o: unknown) => unknown)(opts);
    }),
    createManifestRegenerator: vi.fn((opts: unknown) => {
      return (actual.createManifestRegenerator as unknown as (o: unknown) => unknown)(opts);
    }),
    createReloadController: vi.fn(() => actual.createReloadController()),
    loadFrameworkPreset: vi.fn(async () => ({ preset: { contributions: () => ({}) }, moduleUrl: 'file:///tmp/fake.js' })),
    resolveContributionLoaders: vi.fn((c: unknown) => c),
  };
});

import { createKernel } from '../src/kernel.js';
import { cacheVersionHash, computeUniqueName } from '../src/shared.js';
import { createCompileContext, createManifestRegenerator } from '@mbsks/rspfx-dev-runtime';

const mockedCreateCompileContext = vi.mocked(createCompileContext);
const mockedCreateManifestRegenerator = vi.mocked(createManifestRegenerator);

function makeProject(overrides: Partial<Record<string, unknown>> = {}) {
  const entries = [
    { name: 'hello', import: '/tmp/proj/src/webparts/hello/HelloWebPart.ts', componentIds: ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'], version: '1.0.0' },
    { name: 'world', import: '/tmp/proj/src/webparts/world/WorldWebPart.ts', componentIds: ['bbbbbbbb-cccc-dddd-eeee-ffffffffffff'], version: '1.0.0' },
  ];
  return {
    webParts: {
      entries,
      bundles: [
        { bundleName: 'hello', entrypoint: '/tmp/proj/src/webparts/hello/HelloWebPart.ts', manifestPath: '/tmp/proj/src/webparts/hello/hello.manifest.json' },
        { bundleName: 'world', entrypoint: '/tmp/proj/src/webparts/world/WorldWebPart.ts', manifestPath: '/tmp/proj/src/webparts/world/world.manifest.json' },
      ],
      manifestIds: ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'],
      packageVersion: '1.0.0',
    },
    externals: ['@microsoft/sp-core-library'],
    localizedAliases: { HelloStrings: '/tmp/proj/src/webparts/hello/loc/en-us' },
    localizedResources: [{ name: 'HelloStrings', files: [{ locale: 'en-us', path: '/tmp/proj/src/webparts/hello/loc/en-us.js' }] }],
    configJson: undefined,
    serveJson: undefined,
    ...overrides,
  } as unknown as import('@mbsks/rspfx-dev-runtime').ReadProjectResult;
}

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    name: 'my-app',
    framework: 'react',
    spfxVersion: '1.23',
    dev: { port: 4321, https: false, hostname: 'localhost', workbench: true, fastRefresh: false, openBrowser: false },
    build: { outDir: 'dist', sourcemap: false, minify: false, splitChunks: false },
    paths: { srcDir: 'src', webpartsDir: 'src/webparts', extensionsDir: 'src/extensions', librariesDir: 'src/libraries', configDir: 'config' },
    ...overrides,
  } as unknown as import('@mbsks/rspfx-core').RspfxConfig;
}

describe('createKernel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cacheVersion stable vs framework switch', () => {
    const project = makeProject();
    const k1 = createKernel({ root: '/tmp/proj', config: makeConfig({ framework: 'react' }), project, fastRefresh: false, mode: 'build' });
    const k2 = createKernel({ root: '/tmp/proj', config: makeConfig({ framework: 'react' }), project, fastRefresh: false, mode: 'build' });
    expect(k1.cacheVersion()).toBe(k2.cacheVersion());
    expect(k1.cacheVersion()).toMatch(/^[a-f0-9]{8}$/);
    // direct hash compare
    const direct = cacheVersionHash({ framework: 'react', version: '1.23', build: makeConfig({ framework: 'react' }).build });
    expect(k1.cacheVersion()).toBe(direct);

    const k3 = createKernel({ root: '/tmp/proj', config: makeConfig({ framework: 'vue' }), project, fastRefresh: false, mode: 'build' });
    expect(k3.cacheVersion()).not.toBe(k1.cacheVersion());

    const k4 = createKernel({ root: '/tmp/proj', config: makeConfig({ framework: 'react', spfxVersion: '1.24' }), project, fastRefresh: false, mode: 'build' });
    expect(k4.cacheVersion()).not.toBe(k1.cacheVersion());

    const k5 = createKernel({ root: '/tmp/proj', config: makeConfig({ framework: 'react', build: { outDir: 'lib' } as unknown as Record<string, unknown> }), project, fastRefresh: false, mode: 'build' });
    // different build should bust
    expect(k5.cacheVersion()).not.toBe(k1.cacheVersion());
  });

  it('lazyCompilation dev vs build', () => {
    const project = makeProject();
    const kDev = createKernel({ root: '/tmp/proj', config: makeConfig(), project, fastRefresh: true, mode: 'dev' });
    expect(kDev.lazyCompilation()).toEqual({ entries: false, imports: true });
    const kBuild = createKernel({ root: '/tmp/proj', config: makeConfig(), project, fastRefresh: false, mode: 'build' });
    expect(kBuild.lazyCompilation()).toBeUndefined();
  });

  it('createCompileContext production flag', () => {
    const project = makeProject();
    const kernel = createKernel({ root: '/tmp/proj', config: makeConfig(), project, fastRefresh: true, mode: 'dev' });

    const ctxProd = kernel.createCompileContext({ production: true, serveMode: false });
    expect(ctxProd.production).toBe(true);
    expect(ctxProd.serveMode).toBe(false);
    expect(ctxProd.fastRefresh).toBe(true);
    expect(ctxProd.framework).toBe('react');
    expect(mockedCreateCompileContext).toHaveBeenCalledTimes(1);
    expect((mockedCreateCompileContext.mock.calls[0]![0] as Record<string, unknown>).production).toBe(true);

    mockedCreateCompileContext.mockClear();
    const ctxDev = kernel.createCompileContext({ production: false, serveMode: true });
    expect(ctxDev.production).toBe(false);
    expect(ctxDev.serveMode).toBe(true);
    expect((mockedCreateCompileContext.mock.calls[0]![0] as Record<string, unknown>).production).toBe(false);
    expect((mockedCreateCompileContext.mock.calls[0]![0] as Record<string, unknown>).serveMode).toBe(true);
  });

  it('createCompileContext forwards userModuleRules', () => {
    const project = makeProject();
    const kernel = createKernel({ root: '/tmp/proj', config: makeConfig(), project, fastRefresh: false, mode: 'build' });
    const rules = [{ test: /\.foo$/, use: 'foo-loader' }];
    const ctx = kernel.createCompileContext({ production: true, serveMode: false, userModuleRules: rules as unknown as unknown[] });
    expect((ctx as unknown as { userModuleRules: unknown[] }).userModuleRules).toEqual(rules);
  });

  it('createManifestRegenerator entryModuleIds mapping', () => {
    const project = makeProject();
    const kernel = createKernel({ root: '/tmp/proj', config: makeConfig(), project, fastRefresh: false, mode: 'build' });
    const origin = () => 'https://localhost:4321';
    kernel.createManifestRegenerator({ origin });
    expect(mockedCreateManifestRegenerator).toHaveBeenCalledTimes(1);
    const opts = mockedCreateManifestRegenerator.mock.calls[0]![0] as Record<string, unknown>;
    expect(opts.entryModuleIds).toEqual({
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee': 'hello',
      'bbbbbbbb-cccc-dddd-eeee-ffffffffffff': 'world',
    });
    expect(opts.projectRoot).toBe('/tmp/proj');
    expect(opts.production).toBe(true);
    expect(opts.origin).toBe(origin);
    expect(opts.entries).toBe(project.webParts.entries);

    mockedCreateManifestRegenerator.mockClear();
    const kernelDev = createKernel({ root: '/tmp/proj', config: makeConfig(), project, fastRefresh: false, mode: 'dev' });
    kernelDev.createManifestRegenerator({ origin });
    const optsDev = mockedCreateManifestRegenerator.mock.calls[0]![0] as Record<string, unknown>;
    expect(optsDev.production).toBe(false);
  });

  it('createManifestRegenerator passes webpartsDir etc', () => {
    const project = makeProject();
    const config = makeConfig({ paths: { webpartsDir: 'src/webparts', extensionsDir: 'src/extensions', librariesDir: 'src/libraries' } as unknown as Record<string, unknown> });
    const kernel = createKernel({ root: '/tmp/proj', config, project, fastRefresh: false, mode: 'build' });
    kernel.createManifestRegenerator({ origin: () => 'https://x' });
    const opts = mockedCreateManifestRegenerator.mock.calls[0]![0] as Record<string, unknown>;
    expect(opts.webpartsDir).toBe('src/webparts');
    expect(opts.extensionsDir).toBe('src/extensions');
    expect(opts.librariesDir).toBe('src/libraries');
  });

  it('uniqueName delegates to computeUniqueName', () => {
    const project = makeProject();
    const kernel = createKernel({ root: '/tmp/proj', config: makeConfig(), project, fastRefresh: false, mode: 'build' });
    expect(kernel.uniqueName()).toBe(computeUniqueName(project.webParts.entries as unknown as Parameters<typeof computeUniqueName>[0]));
    // single entry case
    const single = makeProject({
      webParts: {
        entries: [{ name: 'hello', import: '/tmp/a', componentIds: ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'], version: '1.0.0' }],
        bundles: [{ bundleName: 'hello', entrypoint: '/tmp/a', manifestPath: '/tmp/b' }],
        manifestIds: ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'],
        packageVersion: '1.0.0',
      },
    } as unknown as Record<string, unknown>);
    const kSingle = createKernel({ root: '/tmp/proj', config: makeConfig(), project: single as unknown as import('@mbsks/rspfx-dev-runtime').ReadProjectResult, fastRefresh: false, mode: 'build' });
    expect(kSingle.uniqueName()).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee_1.0.0');
  });

  it('amdName and externals passthrough', () => {
    const project = makeProject();
    const kernel = createKernel({ root: '/tmp/proj', config: makeConfig(), project, fastRefresh: false, mode: 'build' });
    expect(kernel.amdName({ componentIds: ['id-1'], version: '1.0.0', name: 'hello' })).toBe('id-1_1.0.0');
    expect(kernel.externals).toEqual(expect.arrayContaining(['@microsoft/sp-core-library']));
  });
});
