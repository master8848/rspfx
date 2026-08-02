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
}

function captureHooks(plugin: { setup(api: unknown): void | Promise<void> }) {
  const hooks: {
    modifyRsbuildConfig?: (config: Record<string, unknown>) => void;
    modifyRspackConfig?: (config: Record<string, unknown>, utils: Record<string, unknown>) => void;
  } = {};
  const api = {
    logger: { warn: (): void => undefined },
    modifyRsbuildConfig: (cb: (config: Record<string, unknown>) => void): void => {
      hooks.modifyRsbuildConfig = cb;
    },
    modifyRspackConfig: (cb: (config: Record<string, unknown>, utils: Record<string, unknown>) => void): void => {
      hooks.modifyRspackConfig = cb;
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
