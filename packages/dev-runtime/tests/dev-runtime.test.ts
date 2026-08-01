import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, afterAll, beforeAll } from 'vitest';
import { resolveConfig, type RspfxConfig } from '@mbsks/rspfx-core';
import { startPlayground, startServe } from '../src/index.js';

const FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'proj');

function makeConfig(overrides: Partial<RspfxConfig> = {}): RspfxConfig {
  return resolveConfig({
    name: 'test-proj',
    framework: 'vanilla',
    language: 'typescript',
    styling: 'scss',
    dev: { https: false },
    ...overrides
  });
}

function rmRetry(target: string): void {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      return;
    } catch {
      // Files may still be flushing; retry briefly.
    }
    const end = Date.now() + 100;
    while (Date.now() < end) {
      // busy-wait
    }
  }
}

beforeAll(() => {
  rmRetry(FIXTURE);
  const webpartsDir = path.join(FIXTURE, 'src', 'webparts', 'hello');
  fs.mkdirSync(path.join(FIXTURE, 'node_modules', '@microsoft', 'sp-core-library', 'dist'), {
    recursive: true
  });
  fs.mkdirSync(path.join(FIXTURE, 'node_modules', '@microsoft', 'sp-webpart-base', 'dist'), {
    recursive: true
  });
  fs.mkdirSync(webpartsDir, { recursive: true });
  fs.writeFileSync(
    path.join(FIXTURE, 'package.json'),
    JSON.stringify({ name: 'test-proj', version: '1.0.0' }, null, 2)
  );
  fs.writeFileSync(
    path.join(FIXTURE, 'node_modules', '@microsoft', 'sp-core-library', 'package.json'),
    JSON.stringify({ name: '@microsoft/sp-core-library', version: '1.23.2' })
  );
  fs.writeFileSync(
    path.join(
      FIXTURE,
      'node_modules',
      '@microsoft',
      'sp-core-library',
      'dist',
      '7263c7d0-1d6a-45ec-8d85-d4d1d234171b.manifest.json'
    ),
    JSON.stringify({
      id: '7263c7d0-1d6a-45ec-8d85-d4d1d234171b',
      alias: 'SPCoreLibrary',
      componentType: 'Library',
      version: '1.23.2',
      manifestVersion: 2,
      loaderConfig: {
        internalModuleBaseUrls: ['https://localhost:4321/dist/'],
        entryModuleId: 'sp-core-library',
        scriptResources: {}
      }
    })
  );
  fs.writeFileSync(
    path.join(FIXTURE, 'node_modules', '@microsoft', 'sp-webpart-base', 'package.json'),
    JSON.stringify({ name: '@microsoft/sp-webpart-base', version: '1.23.2' })
  );
  fs.writeFileSync(
    path.join(FIXTURE, 'node_modules', '@microsoft', 'sp-webpart-base', 'dist', 'manifest.manifest.json'),
    JSON.stringify({
      id: '974a7777-0990-4136-8fa6-95d80114c2e0',
      alias: 'SPWebPartBase',
      componentType: 'Library',
      version: '1.23.2',
      manifestVersion: 2,
      loaderConfig: { internalModuleBaseUrls: [], entryModuleId: 'sp-webpart-base', scriptResources: {} }
    })
  );
  fs.writeFileSync(
    path.join(webpartsDir, 'hello.manifest.json'),
    JSON.stringify(
      {
        $schema: 'https://developer.microsoft.com/json-schemas/spfx/client-side-web-part-manifest.schema.json',
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        alias: 'HelloWebPart',
        componentType: 'WebPart',
        version: '*',
        manifestVersion: 2,
        safeWithCustomScriptDisabled: true,
        preconfiguredEntries: [
          {
            group: { default: 'Other' },
            title: { default: 'Hello' },
            description: { default: 'Hello web part' },
            properties: { message: 'hello' }
          }
        ]
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(webpartsDir, 'helloWebPart.ts'),
    `export default class HelloWebPart {
  private _message: string = 'hello';
  public render(): void {
    if (this._message) {
      document.title = this._message;
    }
  }
}
`
  );
});

afterAll(() => {
  rmRetry(FIXTURE);
});

describe('startServe', () => {
  it('serves manifests.js with project + sp-* debug manifests', async () => {
    const handle = await startServe({
      projectRoot: FIXTURE,
      config: makeConfig(),
      noBrowser: true,
      tenantDomain: 'contoso.sharepoint.com',
      port: 0
    });

    try {
      const res = await fetch(`${handle.url}/temp/manifests.js`);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      const body = await res.text();
      expect(body).toContain('self.debugManifests');
      expect(body).toContain('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
      expect(body).toContain('7263c7d0-1d6a-45ec-8d85-d4d1d234171b');
      expect(body).toContain(`${handle.url}/dist/`);
      expect(body).toContain(`${handle.url}/node_modules/@microsoft/sp-core-library/dist/`);
      expect(handle.workbenchUrl).toContain('contoso.sharepoint.com/_layouts/15/workbench.aspx');
      expect(handle.workbenchUrl).toContain(
        `debugManifestsFile=${encodeURIComponent(`${handle.url}/temp/manifests.js`)}`
      );
    } finally {
      await handle.close();
    }
  });

  it('serves the compiled AMD bundle at /dist/<name>.js', async () => {
    const handle = await startServe({
      projectRoot: FIXTURE,
      config: makeConfig(),
      noBrowser: true,
      port: 0
    });

    try {
      const res = await fetch(`${handle.url}/dist/hello.js`);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("define('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee_1.0.0'");
    } finally {
      await handle.close();
    }
  });
});

describe('startPlayground', () => {
  it('serves the playground page and bundle', async () => {
    const playgroundDir = path.join(FIXTURE, 'playground');
    fs.mkdirSync(playgroundDir, { recursive: true });
    fs.writeFileSync(
      path.join(playgroundDir, 'index.html'),
      '<!doctype html><html><body><div id="root"></div><script src="/dist/playground.js"></script></body></html>'
    );
    fs.writeFileSync(
      path.join(playgroundDir, 'main.ts'),
      `const root = document.getElementById('root');
if (root) { root.textContent = 'playground-mount'; }
`
    );

    const handle = await startPlayground({
      projectRoot: FIXTURE,
      config: makeConfig(),
      noBrowser: true,
      port: 0
    });

    try {
      const base = `http://localhost:${handle.port}`;
      const page = await fetch(`${base}/playground/index.html`);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain('playground.js');
      const bundle = await fetch(`${base}/dist/playground.js`);
      expect(bundle.status).toBe(200);
      expect(await bundle.text()).toContain('playground-mount');
    } finally {
      await handle.close();
    }
  });
});

describe('createRefreshRuntime', () => {
  it('returns a no-op runtime for every framework', async () => {
    const { createRefreshRuntime } = await import('../src/refresh.js');
    for (const framework of ['vanilla', 'react', 'solid', 'preact', 'vue', 'svelte'] as const) {
      const runtime = createRefreshRuntime(framework);
      expect(() => runtime.dispose()).not.toThrow();
      expect(() => runtime.preserveState()).not.toThrow();
      expect(() => runtime.restoreState()).not.toThrow();
    }
  });
});

describe('readProject', () => {
  it('externalizes every config.json externals key regardless of value form', async () => {
    const configDir = path.join(FIXTURE, 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({
        externals: {
          jquery: 'https://code.jquery.com/jquery-3.1.0.min.js',
          '@microsoft/load-themed-styles': {
            path: 'node_modules/@microsoft/load-themed-styles/dist/load-themed-styles.js',
            globalName: 'loadThemedStyles'
          },
          lodash: 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js'
        }
      }, null, 2)
    );
    try {
      const { readProject } = await import('../src/project.js');
      const result = readProject(FIXTURE);
      expect(result.externals).toEqual(
        expect.arrayContaining(['jquery', '@microsoft/load-themed-styles', 'lodash'])
      );
    } finally {
      fs.rmSync(configDir, { recursive: true, force: true });
    }
  });
});
