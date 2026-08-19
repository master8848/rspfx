import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, afterAll, beforeAll } from 'vitest';
import { resolveConfig, type RspfxConfig } from '@mbsks/rspfx-core';
import { resolveServeMode, startServe } from '../src/index.js';

const FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'proj');

function makeConfig(overrides: Partial<RspfxConfig> = {}): RspfxConfig {
  return resolveConfig({
    name: 'test-proj',
    framework: 'vanilla',
    language: 'typescript',
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
  const extensionsDir = path.join(FIXTURE, 'src', 'extensions', 'header');
  fs.mkdirSync(path.join(FIXTURE, 'node_modules', '@microsoft', 'sp-core-library', 'dist'), {
    recursive: true
  });
  fs.mkdirSync(path.join(FIXTURE, 'node_modules', '@microsoft', 'sp-webpart-base', 'dist'), {
    recursive: true
  });
  fs.mkdirSync(webpartsDir, { recursive: true });
  fs.mkdirSync(extensionsDir, { recursive: true });
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
  fs.writeFileSync(
    path.join(extensionsDir, 'header.manifest.json'),
    JSON.stringify(
      {
        $schema: 'https://developer.microsoft.com/json-schemas/spfx/client-side-extension-manifest.schema.json',
        id: 'dddddddd-4444-4555-8666-777777777777',
        alias: 'HeaderAppCustomizer',
        componentType: 'Extension',
        extensionType: 'ApplicationCustomizer',
        version: '*',
        manifestVersion: 2,
        requiresCustomScript: false
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(extensionsDir, 'headerApplicationCustomizer.ts'),
    `export default class HeaderAppCustomizerApplicationCustomizer {
  public onInit(): Promise<void> {
    return Promise.resolve();
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
      expect(body).toContain('hello.js?t=');
      expect(body).toContain('location.reload');
      expect(handle.workbenchUrl).toContain('contoso.sharepoint.com/_layouts/15/workbench.aspx');
      expect(handle.workbenchUrl).toContain(
        `debugManifestsFile=${encodeURIComponent(`${handle.url}/temp/manifests.js`)}`
      );
    } finally {
      await handle.close();
    }
  });

  it('serves the reload hot endpoint with a build counter', async () => {
    const handle = await startServe({
      projectRoot: FIXTURE,
      config: makeConfig(),
      noBrowser: true,
      port: 0
    });

    try {
      const res = await fetch(`${handle.url}/__rspfx_hot.json`);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      // No Origin header → dev-server keeps wildcard for non-browser clients (documented fallback); Vary from reload handler.
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
      expect(res.headers.get('vary')).toContain('Origin');
      const data = (await res.json()) as { build: number };
      expect(typeof data.build).toBe('number');
      expect(data.build).toBeGreaterThanOrEqual(1);

      // Allowlisted origin should be echoed.
      const allowed = await fetch(`${handle.url}/__rspfx_hot.json`, { headers: { Origin: 'http://localhost:4321' } });
      expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:4321');

      // Non-allowlisted origin → no ACAO (Vary remains)
      const blocked = await fetch(`${handle.url}/__rspfx_hot.json`, { headers: { Origin: 'https://evil.com' } });
      expect(blocked.headers.get('access-control-allow-origin')).toBeNull();
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

  it('serves manifests with fastRefresh enabled', async () => {
    const handle = await startServe({
      projectRoot: FIXTURE,
      config: makeConfig({ dev: { https: false, fastRefresh: true } }),
      noBrowser: true,
      port: 0
    });

    try {
      const res = await fetch(`${handle.url}/temp/manifests.js`);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    } finally {
      await handle.close();
    }
  });
});

describe('startServe local mode', () => {
  it('serves the local preview page at / with injected components', async () => {
    const handle = await startServe({
      projectRoot: FIXTURE,
      config: makeConfig(),
      noBrowser: true,
      port: 0
    });

    try {
      expect(handle.workbenchUrl).toBeUndefined();
      const res = await fetch(`${handle.url}/`);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('window.__RSPFX_COMPONENTS__');
      expect(body).toContain('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
      expect(body).toContain('"bundleName":"hello"');
      expect(body).toContain('/dist/local-runtime.js');
      expect(body).toContain('location.reload');
      expect(body).toContain('local preview');
    } finally {
      await handle.close();
    }
  });

  it('serves the local runtime bootstrap bundle', async () => {
    const handle = await startServe({
      projectRoot: FIXTURE,
      config: makeConfig(),
      noBrowser: true,
      port: 0
    });

    try {
      const res = await fetch(`${handle.url}/dist/local-runtime.js`);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("define('local-runtime_1.0.0',");
      expect(body).toContain('@msinternal/sp-telemetry');
      expect(body).toContain('__RSPFX_COMPONENTS__');
    } finally {
      await handle.close();
    }
  });

  it('serves mock SharePoint REST endpoints under /_api', async () => {
    const handle = await startServe({
      projectRoot: FIXTURE,
      config: makeConfig(),
      noBrowser: true,
      port: 0
    });

    try {
      const web = (await (await fetch(`${handle.url}/_api/web`)).json()) as {
        Title: string;
        ServerRelativeUrl: string;
      };
      expect(web.Title).toBe('Local Workbench');
      expect(web.ServerRelativeUrl).toBe('/');

      const currentUser = (await (
        await fetch(`${handle.url}/_api/web/currentuser`)
      ).json()) as { LoginName: string };
      expect(currentUser.LoginName).toContain('dev@contoso.onmicrosoft.com');

      const lists = (await (await fetch(`${handle.url}/_api/web/lists`)).json()) as {
        value: { Title: string }[];
      };
      expect(lists.value.map((list) => list.Title)).toEqual(['Announcements', 'Documents']);

      const items = (await (
        await fetch(`${handle.url}/_api/web/lists/getbytitle('Announcements')/items`)
      ).json()) as { value: { Id: number; Title: string }[] };
      expect(items.value[0]!.Title).toBe('Welcome to RSPFX');

      const contextinfo = (await (
        await fetch(`${handle.url}/_api/contextinfo`, { method: 'POST' })
      ).json()) as { GetContextWebInformation: { FormDigestValue: string } };
      expect(contextinfo.GetContextWebInformation.FormDigestValue).toBe('0xRSPFXLOCALPREVIEW');

      const unknown = await fetch(`${handle.url}/_api/web/search`);
      expect(unknown.status).toBe(400);
      expect((await unknown.json()) as { error: { code: string } }).toMatchObject({
        error: { code: '-1, System.NotSupportedException' }
      });
    } finally {
      await handle.close();
    }
  });

  it('creates list items via POST /_api/.../items and persists them in the mock store', async () => {
    const handle = await startServe({
      projectRoot: FIXTURE,
      config: makeConfig(),
      noBrowser: true,
      port: 0
    });

    try {
      const createdRes = await fetch(`${handle.url}/_api/web/lists/getbytitle('Announcements')/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Title: 'New item from test' })
      });
      expect(createdRes.status).toBe(201);
      const created = (await createdRes.json()) as { Id: number; Title: string };
      expect(created.Title).toBe('New item from test');
      expect(created.Id).toBe(3);

      const items = (await (
        await fetch(`${handle.url}/_api/web/lists/getbytitle('Announcements')/items`)
      ).json()) as { value: { Id: number; Title: string }[] };
      expect(items.value).toHaveLength(3);
      expect(items.value.some((item) => item.Title === 'New item from test')).toBe(true);
    } finally {
      await handle.close();
    }
  });
});

describe('resolveServeMode', () => {
  it('defaults to sharepoint when a tenant is configured and local otherwise', () => {
    const config = makeConfig();
    expect(resolveServeMode({ mode: undefined, config }, 'contoso.sharepoint.com')).toBe('sharepoint');
    expect(resolveServeMode({ mode: undefined, config }, undefined)).toBe('local');
    expect(resolveServeMode({ mode: 'local', config }, 'contoso.sharepoint.com')).toBe('local');
    expect(resolveServeMode({ mode: 'sharepoint', config }, undefined)).toBe('sharepoint');
  });
});

describe('createRefreshRuntime', () => {
  it('tracks preserve/restore transitions and stays inert after dispose for every framework', async () => {
    const { createRefreshRuntime } = await import('../src/refresh.js');
    for (const framework of ['vanilla', 'react', 'solid', 'preact', 'vue', 'svelte'] as const) {
      const events: string[] = [];
      const runtime = createRefreshRuntime(framework, {
        onPreserve: () => events.push('preserve'),
        onRestore: () => events.push('restore')
      });
      expect(runtime.preserved).toBe(false);
      expect(runtime.disposed).toBe(false);
      expect(runtime.epoch).toBe(0);

      runtime.preserveState();
      expect(runtime.preserved).toBe(true);
      expect(runtime.epoch).toBe(0);
      expect(events).toEqual(['preserve']);

      runtime.restoreState();
      expect(runtime.preserved).toBe(false);
      expect(runtime.epoch).toBe(1);
      expect(events).toEqual(['preserve', 'restore']);

      expect(() => runtime.dispose()).not.toThrow();
      expect(runtime.disposed).toBe(true);
      expect(() => runtime.dispose()).not.toThrow();
      expect(runtime.preserved).toBe(false);

      runtime.preserveState();
      runtime.restoreState();
      expect(runtime.preserved).toBe(false);
      expect(runtime.epoch).toBe(1);
      expect(events).toEqual(['preserve', 'restore']);
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

  it('reads config, bundles and localized resources from a custom layout', async () => {
    const customConfigDir = path.join(FIXTURE, 'config-custom');
    const widgetDir = path.join(FIXTURE, 'components', 'widget');
    fs.mkdirSync(customConfigDir, { recursive: true });
    fs.mkdirSync(widgetDir, { recursive: true });
    fs.writeFileSync(
      path.join(customConfigDir, 'config.json'),
      JSON.stringify({
        bundles: {
          'widget-bundle': {
            components: [
              {
                entrypoint: './components/widget/widgetWidget.ts',
                manifest: './components/widget/widget.manifest.json'
              }
            ]
          }
        },
        localizedResources: { WidgetStrings: 'lib/widget/loc/{locale}.js' }
      }, null, 2)
    );
    fs.writeFileSync(
      path.join(widgetDir, 'widget.manifest.json'),
      JSON.stringify({
        id: 'bbbbbbbb-2222-4333-8444-555555555555',
        alias: 'WidgetWebPart',
        componentType: 'WebPart',
        version: '1.0.0',
        manifestVersion: 2
      }, null, 2)
    );
    fs.writeFileSync(
      path.join(widgetDir, 'widgetWidget.ts'),
      `export default class WidgetWebPart {\n  public render(): void {}\n}\n`
    );
    try {
      const { readProject } = await import('../src/project.js');
      const result = readProject(FIXTURE, {
        configDir: 'config-custom',
        webpartsDir: 'components',
        srcDir: 'components'
      });
      expect(result.webParts.bundles).toHaveLength(1);
      expect(result.webParts.bundles[0]!.bundleName).toBe('widget-bundle');
      expect(result.webParts.manifestIds).toEqual(['bbbbbbbb-2222-4333-8444-555555555555']);
      expect(result.webParts.entries[0]!.name).toBe('widget-bundle');
      expect(result.localizedAliases['WidgetStrings']).toBe(
        path.join(FIXTURE, 'components', 'widget', 'loc', 'en-us')
      );
    } finally {
      fs.rmSync(customConfigDir, { recursive: true, force: true });
      fs.rmSync(path.join(FIXTURE, 'components'), { recursive: true, force: true });
    }
  });

  it('discovers extension bundles alongside web parts', async () => {
    const { readProject } = await import('../src/project.js');
    const result = readProject(FIXTURE);
    expect(result.webParts.bundles).toHaveLength(2);
    expect(result.webParts.bundles.map((bundle) => bundle.bundleName)).toEqual([
      'hello',
      'header'
    ]);
    expect(result.webParts.entries.map((entry) => entry.name)).toEqual(['hello', 'header']);
    expect(result.webParts.manifestIds).toEqual([
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      'dddddddd-4444-4555-8666-777777777777'
    ]);
    expect(result.webParts.packageVersion).toBe('1.0.0');
  });

  it('picks the <Name>ApplicationCustomizer.ts entrypoint for extensions', async () => {
    const { discoverWebParts } = await import('../src/project.js');
    const result = discoverWebParts(FIXTURE, undefined, 'src/webparts', undefined, 'src/extensions');
    const header = result.bundles.find((bundle) => bundle.bundleName === 'header')!;
    expect(header.entrypoint.endsWith('headerApplicationCustomizer.ts')).toBe(true);
    expect(header.manifestPath.endsWith('header.manifest.json')).toBe(true);
  });

  it('keeps explicit config.json bundles authoritative over directory discovery', async () => {
    const configDir = path.join(FIXTURE, 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({
        bundles: {
          'explicit-bundle': {
            components: [
              {
                entrypoint: './src/webparts/hello/helloWebPart.ts',
                manifest: './src/webparts/hello/hello.manifest.json'
              }
            ]
          }
        }
      }, null, 2)
    );
    try {
      const { readProject } = await import('../src/project.js');
      const result = readProject(FIXTURE);
      expect(result.webParts.bundles).toHaveLength(1);
      expect(result.webParts.bundles[0]!.bundleName).toBe('explicit-bundle');
    } finally {
      fs.rmSync(configDir, { recursive: true, force: true });
    }
  });
});
