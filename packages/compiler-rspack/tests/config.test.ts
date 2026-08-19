import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createRspackConfig, type BundleEntry, type CompileContext } from '../src/index.js';
import type { Configuration } from '@rspack/core';

const ENTRY: BundleEntry = {
  name: 'testwebpart',
  import: '/tmp/proj/src/index.ts',
  componentIds: ['aaaaaaaa-0000-0000-0000-000000000001'],
  version: '1.0.0'
};

function makeCtx(overrides: Partial<CompileContext> = {}): CompileContext {
  return {
    projectRoot: '/tmp/proj',
    framework: 'vanilla',
    fastRefresh: false,
    production: true,
    entries: [ENTRY],
    externals: ['@microsoft/sp-core-library'],
    build: {
      sourcemap: false,
      minify: true,
      splitChunks: false,
      outDir: 'dist',
      releaseDir: 'release'
    },
    ...overrides
  };
}

async function getConfig(ctx: CompileContext): Promise<Configuration> {
  return (await createRspackConfig(ctx)) as Configuration;
}

describe('createRspackConfig', () => {
  it('emits a per-entry AMD library named <componentId>_<version>', async () => {
    const config = await getConfig(makeCtx());
    const entries = config.entry as Record<
      string,
      { import: string; library: { type: string; name: string } }
    >;
    expect(entries['testwebpart']).toEqual({
      import: '/tmp/proj/src/index.ts',
      library: { type: 'amd', name: 'aaaaaaaa-0000-0000-0000-000000000001_1.0.0' }
    });
    expect(config.output?.library).toEqual({ type: 'amd' });
  });

  it('uses a distinct per-entry AMD name for every bundle', async () => {
    const second: BundleEntry = {
      name: 'secondwebpart',
      import: '/tmp/proj/src/second.ts',
      componentIds: ['bbbbbbbb-0000-0000-0000-000000000002'],
      version: '2.0.0'
    };
    const config = await getConfig(makeCtx({ entries: [ENTRY, second] }));
    const entries = config.entry as Record<
      string,
      { library?: { type: string; name: string } }
    >;
    expect(entries['testwebpart']?.library?.name).toBe(
      'aaaaaaaa-0000-0000-0000-000000000001_1.0.0'
    );
    expect(entries['secondwebpart']?.library?.name).toBe(
      'bbbbbbbb-0000-0000-0000-000000000002_2.0.0'
    );
  });

  it('uses a deterministic chunkLoadingGlobal for a single component', async () => {
    const config = await getConfig(makeCtx());
    expect(config.output?.chunkLoadingGlobal).toBe(
      'webpackJsonp_aaaaaaaa-0000-0000-0000-000000000001_1.0.0'
    );
  });

  it('hashes chunkLoadingGlobal for multiple bundles', async () => {
    const second: BundleEntry = {
      name: 'secondwebpart',
      import: '/tmp/proj/src/second.ts',
      componentIds: ['bbbbbbbb-0000-0000-0000-000000000002'],
      version: '2.0.0'
    };
    const config = await getConfig(makeCtx({ entries: [ENTRY, second] }));
    const expected = createHash('md5')
      .update('aaaaaaaa-0000-0000-0000-000000000001_1.0.0bbbbbbbb-0000-0000-0000-000000000002_2.0.0')
      .digest('hex');
    expect(config.output?.chunkLoadingGlobal).toBe(`webpackJsonp_${expected}`);
  });

  it('maps devtool by production/sourcemap matrix', async () => {
    const prodNoMap = await getConfig(makeCtx({ production: true, build: { ...makeCtx().build, sourcemap: false } }));
    expect(prodNoMap.devtool).toBe(false);

    const prodMap = await getConfig(makeCtx({ production: true, build: { ...makeCtx().build, sourcemap: true } }));
    expect(prodMap.devtool).toBe('hidden-source-map');

    const dev = await getConfig(makeCtx({ production: false }));
    expect(dev.devtool).toBe('source-map');
  });

  it('passes externals through', async () => {
    const config = await getConfig(
      makeCtx({ externals: ['@microsoft/sp-core-library', '@microsoft/sp-webpart-base'] })
    );
    expect((config.externals as unknown as string[])?.slice(0, 2)).toEqual([
      '@microsoft/sp-core-library',
      '@microsoft/sp-webpart-base'
    ]);
    const platformExternal = (config.externals as unknown[])[2] as (data: { request?: string }) => string | undefined;
    expect(typeof platformExternal).toBe('function');
    expect(platformExternal({ request: '@msinternal/sp-telemetry' })).toBe('amd @msinternal/sp-telemetry');
    expect(platformExternal({ request: '@microsoft/sp-core-library' })).toBeUndefined();
  });

  it('includes DefinePlugin with DEBUG, DEPRECATED_UNIT_TEST and process.env.NODE_ENV', async () => {
    const config = await getConfig(makeCtx());
    const definePlugin = config.plugins?.find(
      (plugin) =>
        plugin &&
        typeof plugin === 'object' &&
        Object.getPrototypeOf(plugin)?.constructor?.name === 'DefinePlugin'
    ) as { _args?: Record<string, string>[] } | undefined;
    expect(definePlugin).toBeDefined();
    expect(definePlugin?._args?.[0]).toEqual({
      DEBUG: 'false',
      DEPRECATED_UNIT_TEST: 'false',
      'process.env.NODE_ENV': '"production"'
    });
  });

  it('uses stable [name].js output filename', async () => {
    const config = await getConfig(makeCtx());
    expect(config.output?.filename).toBe('[name].js');
    expect(config.output?.chunkFilename).toBe('chunk.[name].js');
    expect(config.output?.crossOriginLoading).toBe('anonymous');
    expect(config.output?.publicPath).toBe('__RSPFX_SPFX_PUBLIC_PATH__');
  });

  it('outputs to projectRoot/build.outDir', async () => {
    const config = await getConfig(makeCtx());
    expect(config.output?.path).toBe('/tmp/proj/dist');
  });

  it('disables minimize when build.minify is false', async () => {
    const config = await getConfig(makeCtx({ build: { ...makeCtx().build, minify: false } }));
    expect(config.optimization?.minimize).toBe(false);
  });

  it('uses named module ids in dev and deterministic ids in production', async () => {
    const dev = await getConfig(makeCtx({ production: false }));
    expect(dev.optimization?.moduleIds).toBe('named');
    const prod = await getConfig(makeCtx());
    expect(prod.optimization?.moduleIds).toBe('deterministic');
  });

  it('enables splitChunks only when build.splitChunks is true', async () => {
    const without = await getConfig(makeCtx());
    expect(without.optimization?.splitChunks).toBeUndefined();

    const withChunks = await getConfig(
      makeCtx({ build: { ...makeCtx().build, splitChunks: true } })
    );
    expect(withChunks.optimization?.splitChunks).toEqual({ chunks: 'all' });
  });

  it('enables filesystem cache in serve mode under .rspack-cache', async () => {
    const serve = await getConfig(makeCtx({ serveMode: true }));
    expect(serve.experiments?.cache).toEqual({
      type: 'persistent',
      storage: { type: 'filesystem', directory: '/tmp/proj/.rspack-cache' }
    });

    const notServe = await getConfig(makeCtx());
    expect(notServe.experiments?.cache).toBeUndefined();
  });

  it('adds plain css/scss rules', async () => {
    const config = await getConfig(makeCtx());
    const rules = (config.module?.rules ?? []) as { test?: RegExp; use?: unknown[] }[];
    const scssRule = rules.find((rule) => rule.test?.toString().includes('s[ac]ss'));
    const cssRule = rules.find((rule) => rule.test?.toString() === '/\\.css$/' || rule.test?.toString() === '/\\.css/');
    expect(JSON.stringify(scssRule?.use)).not.toContain('postcss-loader');
    expect(JSON.stringify(cssRule?.use)).not.toContain('postcss-loader');
  });
});
