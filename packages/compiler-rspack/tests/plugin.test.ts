import { describe, expect, it } from 'vitest';
import { createRspackConfig, spfx, type BundleEntry, type SpfxPluginOptions } from '../src/index.js';
import type { Configuration } from '@rspack/core';

const ENTRY: BundleEntry = {
  name: 'testwebpart',
  import: '/tmp/proj/src/index.ts',
  componentIds: ['aaaaaaaa-0000-0000-0000-000000000001'],
  version: '1.0.0'
};

function makeCtx(options: SpfxPluginOptions) {
  return {
    projectRoot: options.projectRoot,
    framework: options.framework,
    fastRefresh: options.fastRefresh ?? false,
    production: options.production ?? true,
    entries: options.entries,
    externals: options.externals ?? [],
    aliases: options.aliases ?? {},
    build: {
      sourcemap: options.build?.sourcemap ?? false,
      minify: options.build?.minify ?? true,
      splitChunks: options.build?.splitChunks ?? false,
      outDir: options.build?.outDir ?? 'dist',
      releaseDir: options.build?.releaseDir ?? 'release'
    },
    serveMode: options.serveMode ?? false,
    additionalPlugins: options.additionalPlugins,
    swcContributions: options.swcContributions
  };
}

const DEFAULT_OPTIONS: SpfxPluginOptions = {
  projectRoot: '/tmp/proj',
  framework: 'vanilla',
  entries: [ENTRY]
};

describe('spfx', () => {
  it('equals createRspackConfig with filled-in defaults', async () => {
    const fromPlugin = (await spfx(DEFAULT_OPTIONS)) as Configuration;
    const fromCtx = (await createRspackConfig(makeCtx(DEFAULT_OPTIONS))) as Configuration;
    expect(fromPlugin).toEqual(fromCtx);
  });

  it('defaults to production build with AMD entry names and [name].js output', async () => {
    const config = (await spfx(DEFAULT_OPTIONS)) as Configuration;
    expect(config.mode).toBe('production');
    expect(config.devtool).toBe(false);
    const entries = config.entry as Record<
      string,
      { import: string; library: { type: string; name: string } }
    >;
    expect(entries['testwebpart']).toEqual({
      import: '/tmp/proj/src/index.ts',
      library: { type: 'amd', name: 'aaaaaaaa-0000-0000-0000-000000000001_1.0.0' }
    });
    expect(config.output?.filename).toBe('[name].js');
  });

  it('passes externals through', async () => {
    const config = (await spfx({
      ...DEFAULT_OPTIONS,
      externals: ['@microsoft/sp-core-library', '@microsoft/sp-webpart-base']
    })) as Configuration;
    expect(config.externals).toEqual([
      '@microsoft/sp-core-library',
      '@microsoft/sp-webpart-base'
    ]);
  });

  it('honours production, serveMode and build overrides', async () => {
    const config = (await spfx({
      ...DEFAULT_OPTIONS,
      production: false,
      serveMode: true,
      build: { sourcemap: true, minify: false }
    })) as Configuration;
    expect(config.mode).toBe('development');
    expect(config.devtool).toBe('source-map');
    expect(config.optimization?.minimize).toBe(false);
    expect(config.experiments?.cache).toBeDefined();
  });
});
