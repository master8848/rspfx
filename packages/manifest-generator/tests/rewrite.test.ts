import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import {
  collectDebugManifests,
  ensureTrailingSlash,
  joinUrlSegments,
  rewriteSpManifestForDebug
} from '../src/index.js';
import type { ComponentManifest } from '../src/index.js';

const fixtureRoot = fileURLToPath(new URL('./fixtures/proj', import.meta.url));

describe('ensureTrailingSlash', () => {
  it('appends a trailing slash when missing', () => {
    expect(ensureTrailingSlash('https://localhost:4321')).toBe('https://localhost:4321/');
  });

  it('keeps an existing trailing slash', () => {
    expect(ensureTrailingSlash('https://localhost:4321/')).toBe('https://localhost:4321/');
  });
});

describe('joinUrlSegments', () => {
  it('joins base url and relative path', () => {
    expect(
      joinUrlSegments('https://localhost:4321', 'node_modules/@microsoft/sp-core-library/dist')
    ).toBe('https://localhost:4321/node_modules/@microsoft/sp-core-library/dist');
  });

  it('handles trailing slashes and leading slashes', () => {
    expect(joinUrlSegments('https://localhost:4321/', '/a/b')).toBe('https://localhost:4321/a/b');
  });
});

describe('rewriteSpManifestForDebug', () => {
  const relativePath = 'node_modules\\@microsoft\\sp-core-library\\dist';
  const baseUrl = 'https://localhost:4321';

  function spManifest(urls: string[] = []): Record<string, unknown> {
    return {
      id: '7263c7d0-1d6a-45ec-8d85-d4d1d234171b',
      componentType: 'Library',
      loaderConfig: { internalModuleBaseUrls: urls, entryModuleId: 'x', scriptResources: {} }
    };
  }

  function loaderUrls(manifest: unknown): string[] {
    return (manifest as { loaderConfig: { internalModuleBaseUrls: string[] } }).loaderConfig
      .internalModuleBaseUrls;
  }

  it('sets internalModuleBaseUrls when empty', () => {
    const manifest = rewriteSpManifestForDebug(spManifest(), relativePath, baseUrl);
    expect(loaderUrls(manifest)).toEqual([
      'https://localhost:4321/node_modules/@microsoft/sp-core-library/dist/'
    ]);
  });

  it('prepends the base url when the first url does not start with it', () => {
    const manifest = rewriteSpManifestForDebug(
      spManifest(['https://cdn.example.com/x']),
      relativePath,
      baseUrl
    );
    expect(loaderUrls(manifest)).toEqual([
      'https://localhost:4321/node_modules/@microsoft/sp-core-library/dist/',
      'https://cdn.example.com/x/'
    ]);
  });

  it('leaves urls untouched when they already start with the base url', () => {
    const manifest = rewriteSpManifestForDebug(
      spManifest(['https://localhost:4321/node_modules/@microsoft/sp-core-library/dist']),
      relativePath,
      baseUrl
    );
    expect(loaderUrls(manifest)).toEqual([
      'https://localhost:4321/node_modules/@microsoft/sp-core-library/dist/'
    ]);
  });

  it('returns the manifest unchanged when it has no loaderConfig', () => {
    const manifest = { id: 'x' };
    expect(rewriteSpManifestForDebug(manifest, relativePath, baseUrl)).toBe(manifest);
  });
});

describe('collectDebugManifests', () => {
  it('combines project manifests with rewritten sp dependency manifests', async () => {
    const projectManifest: ComponentManifest = {
      id: '11111111-1111-4111-8111-111111111111',
      alias: 'HelloWebPart',
      componentType: 'WebPart',
      version: '1.2.3',
      manifestVersion: 2,
      loaderConfig: {
        internalModuleBaseUrls: ['https://localhost:4321/dist/'],
        entryModuleId: 'hello',
        scriptResources: { hello: { type: 'path', path: 'hello.js' } }
      }
    };
    const manifests = await collectDebugManifests({
      projectRoot: fixtureRoot,
      componentManifests: [projectManifest],
      serverOrigin: 'https://localhost:4321'
    });
    expect(manifests[0]).toBe(projectManifest);
    const spCore = manifests.find(
      (manifest) => (manifest as { id?: unknown }).id === '7263c7d0-1d6a-45ec-8d85-d4d1d234171b'
    ) as { loaderConfig: { internalModuleBaseUrls: string[] } };
    expect(spCore.loaderConfig.internalModuleBaseUrls).toEqual([
      'https://localhost:4321/node_modules/@microsoft/sp-core-library/dist/'
    ]);
    const spWebpart = manifests.find(
      (manifest) => (manifest as { id?: unknown }).id === '974a7777-0990-4136-8fa6-95d80114c2e0'
    ) as { loaderConfig: { internalModuleBaseUrls: string[] } };
    expect(spWebpart.loaderConfig.internalModuleBaseUrls).toEqual([
      'https://localhost:4321/node_modules/@microsoft/sp-webpart-base/dist/'
    ]);
  });

  it('skips sp dependencies that only exist in the fallback table', async () => {
    const manifests = await collectDebugManifests({
      projectRoot: fixtureRoot,
      componentManifests: [],
      serverOrigin: 'https://localhost:4321'
    });
    const ids = manifests.map((manifest) => (manifest as { id?: unknown }).id);
    expect(ids).not.toContain('1c6c9123-7aac-41f3-a376-3caea41ed83f');
  });
});
