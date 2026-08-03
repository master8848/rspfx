import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RSPFX_PLUGIN_MARKER, RSPFX_PLUGIN_OPTIONS } from '@mbsks/rspfx-core';
import { rspfxRsbuild } from '../src/rsbuild.js';

function makeTmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rspfx-plugin-${prefix}-`));
}

function rmRf(target: string): void {
  fs.rmSync(target, { recursive: true, force: true });
}

function writeFixtureProject(dir: string): void {
  fs.mkdirSync(path.join(dir, 'src', 'webparts', 'hello'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'rsbuild-proj', version: '1.2.3' }));
  fs.writeFileSync(path.join(dir, 'src', 'webparts', 'hello', 'helloWebPart.ts'), 'export default class HelloWebPart {}');
  fs.writeFileSync(
    path.join(dir, 'src', 'webparts', 'hello', 'hello.manifest.json'),
    JSON.stringify({ id: 'aaaaaaaa-0000-0000-0000-000000000001', alias: 'HelloWebPart' })
  );
  fs.mkdirSync(path.join(dir, 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'config', 'config.json'),
    JSON.stringify({
      bundles: {
        hello: {
          components: [
            {
              entrypoint: 'src/webparts/hello/helloWebPart.ts',
              manifest: 'src/webparts/hello/hello.manifest.json'
            }
          ]
        }
      },
      externals: { '@microsoft/sp-lodash-subset': '~1.15.2' },
      localizedResources: { HelloStrings: 'lib/strings/{locale}.js' }
    })
  );
  fs.mkdirSync(path.join(dir, 'src', 'strings'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'strings', 'en-us.js'), 'export default { title: "Hello" };');
  fs.writeFileSync(path.join(dir, 'src', 'strings', 'zh-cn.js'), 'export default { title: "你好" };');
  fs.mkdirSync(path.join(dir, 'node_modules', '@microsoft', 'sp-lodash-subset', 'dist'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'node_modules', '@microsoft', 'sp-lodash-subset', 'package.json'),
    JSON.stringify({ name: '@microsoft/sp-lodash-subset', version: '1.23.2' })
  );
  fs.writeFileSync(
    path.join(dir, 'node_modules', '@microsoft', 'sp-lodash-subset', 'dist', 'manifest.manifest.json'),
    JSON.stringify({
      id: 'bbbbbbbb-1111-4222-8333-444444444444',
      alias: 'SPLodashSubset',
      componentType: 'Library',
      version: '1.23.2',
      manifestVersion: 2,
      loaderConfig: { internalModuleBaseUrls: [], entryModuleId: 'sp-lodash-subset', scriptResources: {} }
    })
  );
}

function captureHooks(plugin: { setup(api: unknown): void | Promise<void> }) {
  const hooks: {
    modifyRsbuildConfig?: (config: Record<string, unknown>) => void;
    modifyRspackConfig?: (config: Record<string, unknown>, utils: Record<string, unknown>) => void;
    onBeforeStartDevServer?: (params: { server: { middlewares: { use(route: string, handler: unknown): void } } }) => void;
    onAfterStartDevServer?: (params: { port: number }) => void;
    onAfterDevCompile?: () => void;
    onAfterBuild?: () => void;
  } = {};
  const api = {
    logger: { warn: (): void => undefined, error: (): void => undefined, info: (): void => undefined, success: (): void => undefined },
    modifyRsbuildConfig: (cb: (config: Record<string, unknown>) => void): void => {
      hooks.modifyRsbuildConfig = cb;
    },
    modifyRspackConfig: (cb: (config: Record<string, unknown>, utils: Record<string, unknown>) => void): void => {
      hooks.modifyRspackConfig = cb;
    },
    onBeforeStartDevServer: (cb: (params: { server: { middlewares: { use(route: string, handler: unknown): void } } }) => void): void => {
      hooks.onBeforeStartDevServer = cb;
    },
    onAfterStartDevServer: (cb: (params: { port: number }) => void): void => {
      hooks.onAfterStartDevServer = cb;
    },
    onAfterDevCompile: (cb: () => void): void => {
      hooks.onAfterDevCompile = cb;
    },
    onAfterBuild: (cb: () => void): void => {
      hooks.onAfterBuild = cb;
    }
  };
  plugin.setup(api as never);
  return hooks;
}

describe('rspfxRsbuild', () => {
  it('returns a plugin object with the marker and resolved options', () => {
    const plugin = rspfxRsbuild({ name: 'my-proj', framework: 'react', dev: { port: 9999 } });
    expect(plugin.name).toBe('rspfx-rsbuild');
    expect(plugin[RSPFX_PLUGIN_MARKER]).toBe(true);
    expect(typeof plugin.setup).toBe('function');
    const options = plugin[RSPFX_PLUGIN_OPTIONS];
    expect(options.name).toBe('my-proj');
    expect(options.framework).toBe('react');
    expect(options.dev.port).toBe(9999);
    expect(options.build.outDir).toBe('dist');
  });

  it('injects the SPFx pipeline into the rsbuild and rspack configs', () => {
    const dir = makeTmpDir('rsbuild');
    writeFixtureProject(dir);
    const plugin = rspfxRsbuild({ name: 'rsbuild-proj', projectRoot: dir });
    const hooks = captureHooks(plugin);

    const rsbuildConfig: Record<string, unknown> = { html: true, tools: {}, output: {}, source: {} };
    hooks.modifyRsbuildConfig?.(rsbuildConfig);
    expect((rsbuildConfig.tools as Record<string, unknown>).htmlPlugin).toBe(false);
    expect((rsbuildConfig.output as Record<string, unknown>).distPath).toMatchObject({ root: 'dist' });
    const entry = ((rsbuildConfig.source as Record<string, unknown>).entry as Record<string, unknown>).hello as {
      import: string;
      library: { type: string; name: string };
    };
    expect(entry.import).toBe(path.join(dir, 'src', 'webparts', 'hello', 'helloWebPart.ts'));
    expect(entry.library).toMatchObject({ type: 'amd', name: 'aaaaaaaa-0000-0000-0000-000000000001_1.2.3' });

    const config: Record<string, unknown> = { entry: {}, externals: undefined, output: {}, resolve: {}, plugins: [] };
    hooks.modifyRspackConfig?.(config, { isProd: true });
    const rspackEntry = (config.entry as Record<string, unknown>).hello as {
      import: string;
      library: { type: string; name: string };
    };
    expect(rspackEntry.library).toMatchObject({ type: 'amd', name: 'aaaaaaaa-0000-0000-0000-000000000001_1.2.3' });
    expect(config.externals).toEqual(['@microsoft/sp-lodash-subset', 'HelloStrings']);
    const output = config.output as Record<string, unknown>;
    expect(output.filename).toBe('[name].js');
    expect(output.chunkFilename).toBe('chunk.[name].js');
    expect(output.library).toMatchObject({ type: 'amd' });
    expect(output.chunkLoadingGlobal).toBe('webpackJsonp_aaaaaaaa-0000-0000-0000-000000000001_1.2.3');
    expect(output.crossOriginLoading).toBe('anonymous');
    expect(output.publicPath).toBe('__RSPFX_SPFX_PUBLIC_PATH__');
    expect((config.resolve as Record<string, unknown>).alias).toMatchObject({
      HelloStrings: path.join(dir, 'src', 'strings', 'en-us')
    });
    expect((config.plugins as unknown[]).length).toBe(3);
    rmRf(dir);
  });

  it('keeps dev builds unminified', () => {
    const dir = makeTmpDir('rsbuild-minify');
    writeFixtureProject(dir);
    const plugin = rspfxRsbuild({ name: 'rsbuild-proj', projectRoot: dir });
    const hooks = captureHooks(plugin);
    const config: Record<string, unknown> = { entry: {}, output: {}, resolve: {}, plugins: [] };
    hooks.modifyRspackConfig?.(config, { isProd: false });
    expect(config.optimization).toMatchObject({ minimize: false });
    rmRf(dir);
  });

  it('serves manifests.js with the reload client and ticks the build counter on compile', async () => {
    const dir = makeTmpDir('rsbuild-serve');
    writeFixtureProject(dir);
    const plugin = rspfxRsbuild({ name: 'rsbuild-proj', projectRoot: dir });
    const hooks = captureHooks(plugin);

    const handlers = new Map<string, (req: unknown, res: unknown) => void>();
    const server = {
      middlewares: {
        use(route: string, handler: unknown): void {
          handlers.set(route, handler as (req: unknown, res: unknown) => void);
        }
      }
    };
    hooks.onBeforeStartDevServer?.({ server });

    expect(handlers.has('/temp/manifests.js')).toBe(true);
    expect(handlers.has('/__rspfx_hot.json')).toBe(true);

    const manifestHandler = handlers.get('/temp/manifests.js')!;
    const headers: Record<string, string> = {};
    let manifestBody = '';
    await new Promise<void>((resolve) => {
      manifestHandler(null, {
        setHeader(name: string, value: string): void {
          headers[name] = value;
        },
        end(body: string): void {
          manifestBody = body;
          resolve();
        }
      });
    });
    expect(headers['Cache-Control']).toBe('no-store');
    expect(manifestBody).toContain('self.debugManifests');
    expect(manifestBody).toContain('aaaaaaaa-0000-0000-0000-000000000001');
    expect(manifestBody).toContain('location.reload');
    expect(manifestBody).toContain('?t=');

    const hotHandler = handlers.get('/__rspfx_hot.json')!;
    const readHot = async (): Promise<{ build: number }> => {
      let hotBody = '';
      await new Promise<void>((resolve) => {
        hotHandler(null, {
          setHeader(): void {
            // no-op
          },
          end(body: string): void {
            hotBody = body;
            resolve();
          }
        });
      });
      return JSON.parse(hotBody) as { build: number };
    };
    expect((await readHot()).build).toBe(0);
    hooks.onAfterDevCompile?.();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect((await readHot()).build).toBe(1);
    rmRf(dir);
  });

  it('skips the pipeline when no web part bundles exist', () => {
    const dir = makeTmpDir('rsbuild-empty');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'empty', version: '1.0.0' }));
    const plugin = rspfxRsbuild({ name: 'empty', projectRoot: dir });
    const hooks = captureHooks(plugin);
    const rsbuildConfig: Record<string, unknown> = { tools: {} };
    hooks.modifyRsbuildConfig?.(rsbuildConfig);
    expect((rsbuildConfig.tools as Record<string, unknown>).htmlPlugin).toBe(false);
    const config: Record<string, unknown> = { entry: {}, output: {}, resolve: {}, plugins: [] };
    hooks.modifyRspackConfig?.(config, { isProd: false });
    expect(config.plugins).toEqual([]);
    rmRf(dir);
  });
});
