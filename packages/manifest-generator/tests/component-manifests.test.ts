import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { generateComponentManifests, RspfxError } from '../src/index.js';
import type { ManifestContext } from '../src/index.js';

const fixtureRoot = fileURLToPath(new URL('./fixtures/proj', import.meta.url));
const multiRoot = fileURLToPath(new URL('./fixtures/multi', import.meta.url));

function ctx(overrides: Partial<ManifestContext> = {}): ManifestContext {
  return {
    projectRoot: fixtureRoot,
    production: false,
    baseUrls: { debug: 'https://localhost:4321/dist/', release: [] },
    packageVersion: '1.2.3',
    bundleFiles: new Map([['hello', 'hello.js']]),
    externals: ['@microsoft/sp-core-library', '@microsoft/sp-webpart-base'],
    ...overrides
  };
}

describe('generateComponentManifests', () => {
  it('builds loaderConfig from the source manifest and externals', async () => {
    const manifests = await generateComponentManifests(ctx());
    expect(manifests).toHaveLength(1);
    const manifest = manifests[0]!;
    expect(manifest.$schema).toBeUndefined();
    expect(manifest.version).toBe('1.2.3');
    expect(manifest.alias).toBe('HelloWebPart');
    expect(manifest.componentType).toBe('WebPart');
    expect(manifest.manifestVersion).toBe(2);
    expect(manifest.safeWithCustomScriptDisabled).toBe(true);
    expect(manifest.supportedHosts).toContain('SharePointWebPart');
    expect(manifest.preconfiguredEntries).toHaveLength(1);
    expect(manifest.loaderConfig.entryModuleId).toBe('hello');
    expect(manifest.loaderConfig.internalModuleBaseUrls).toEqual([
      'https://localhost:4321/dist/'
    ]);
    expect(manifest.loaderConfig.scriptResources['hello']).toEqual({
      type: 'path',
      path: 'hello.js'
    });
    expect(manifest.loaderConfig.scriptResources['@microsoft/sp-core-library']).toEqual({
      type: 'component',
      id: '7263c7d0-1d6a-45ec-8d85-d4d1d234171b',
      version: '1.23.2'
    });
    expect(manifest.loaderConfig.scriptResources['@microsoft/sp-webpart-base']).toEqual({
      type: 'component',
      id: '974a7777-0990-4136-8fa6-95d80114c2e0',
      version: '1.23.2'
    });
  });

  it('keeps the entry first and sorts externals alphabetically', async () => {
    const manifests = await generateComponentManifests(ctx());
    const keys = Object.keys(manifests[0]!.loaderConfig.scriptResources);
    expect(keys).toEqual([
      'hello',
      '@microsoft/sp-core-library',
      '@microsoft/sp-webpart-base'
    ]);
  });

  it('strips pre-release suffixes when replacing version *', async () => {
    const manifests = await generateComponentManifests(
      ctx({ packageVersion: '1.2.3-beta.1' })
    );
    expect(manifests[0]!.version).toBe('1.2.3');
  });

  it('uses release base urls when production', async () => {
    const manifests = await generateComponentManifests(
      ctx({ production: true, baseUrls: { debug: 'https://localhost:4321/dist/', release: ['https://cdn.example.com/my-app/'] } })
    );
    expect(manifests[0]!.loaderConfig.internalModuleBaseUrls).toEqual([
      'https://cdn.example.com/my-app/'
    ]);
  });

  it('defaults the entry path to <dir>.js when the bundle file is unknown', async () => {
    const manifests = await generateComponentManifests(ctx({ bundleFiles: new Map() }));
    expect(manifests[0]!.loaderConfig.scriptResources['hello']).toEqual({
      type: 'path',
      path: 'hello.js'
    });
  });

  it('resolves non-sp externals from node_modules/<pkg>/dist manifests', async () => {
    const manifests = await generateComponentManifests(ctx({ externals: ['@acme/widget'] }));
    expect(manifests[0]!.loaderConfig.scriptResources['@acme/widget']).toEqual({
      type: 'component',
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      version: '2.1.0'
    });
  });

  it('skips externals matching the bundle name', async () => {
    const manifests = await generateComponentManifests(
      ctx({ externals: ['hello', '@acme/widget'] })
    );
    const scriptResources = manifests[0]!.loaderConfig.scriptResources;
    expect(scriptResources['@acme/widget']).toBeDefined();
    expect(scriptResources['hello']).toEqual({ type: 'path', path: 'hello.js' });
  });

  it('throws UNRESOLVED_EXTERNAL for externals without a manifest', async () => {
    const error = await generateComponentManifests(
      ctx({ externals: ['@microsoft/does-not-exist'] })
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RspfxError);
    expect((error as RspfxError).code).toBe('UNRESOLVED_EXTERNAL');
  });

  it('throws MULTIPLE_MANIFESTS when a web part folder has more than one manifest', async () => {
    const error = await generateComponentManifests(
      ctx({ projectRoot: multiRoot, externals: [] })
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RspfxError);
    expect((error as RspfxError).code).toBe('MULTIPLE_MANIFESTS');
  });

  it('returns an empty array for a project without src/webparts', async () => {
    const missingRoot = fileURLToPath(new URL('./fixtures/nonexistent', import.meta.url));
    const manifests = await generateComponentManifests(ctx({ projectRoot: missingRoot }));
    expect(manifests).toEqual([]);
  });
});
