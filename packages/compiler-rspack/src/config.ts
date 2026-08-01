import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { rspack, type Configuration, type RuleSetRule } from '@rspack/core';
import type { CompileContext } from './types.js';
import { RspfxError } from './errors.js';
import type { FrameworkRspackContributions } from '@mbsks/rspfx-plugin-api';

const require = createRequire(import.meta.url);

const styleLoaderPath = require.resolve('style-loader');
const cssLoaderPath = require.resolve('css-loader');
const sassLoaderPath = require.resolve('sass-loader');
const postcssLoaderPath = require.resolve('postcss-loader');

const BASE_EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json', '.scss', '.css', '.sass'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(target[key])) {
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

function computeUniqueName(ctx: CompileContext): string {
  if (ctx.entries.length === 1) {
    const entry = ctx.entries[0]!;
    return `${entry.componentIds[0]!}_${entry.version}`;
  }
  const joined = ctx.entries
    .map((entry) => `${entry.componentIds[0]!}_${entry.version}`)
    .join('');
  return createHash('md5').update(joined).digest('hex');
}

export async function createRspackConfig(ctx: CompileContext): Promise<unknown> {
  if (ctx.entries.length === 0) {
    throw new RspfxError('COMPILE_NO_ENTRIES', 'compiler-rspack: at least one bundle entry is required');
  }
  const build = ctx.build;
  const mode = ctx.production ? 'production' : 'development';
  const outDir = build.outDir ?? 'dist';
  const sourcemap = build.sourcemap ?? false;
  const minify = build.minify ?? true;
  const splitChunks = build.splitChunks ?? false;
  const tailwind = ctx.tailwind === true;
  const useCache = ctx.serveMode === true;

  const firstEntry = ctx.entries[0]!;
  const libraryName = `${firstEntry.componentIds[0]!}_${firstEntry.version}`;
  const devtool: Configuration['devtool'] = ctx.production
    ? sourcemap
      ? 'hidden-source-map'
      : false
    : 'source-map';

  const swcJsc: Record<string, unknown> = {
    parser: { syntax: 'typescript', tsx: true, decorators: true, importMeta: true }
  };
  const define: Record<string, string> = {
    DEBUG: JSON.stringify(!ctx.production),
    DEPRECATED_UNIT_TEST: JSON.stringify(false),
    'process.env.NODE_ENV': JSON.stringify(mode)
  };
  const rules: RuleSetRule[] = [];
  const plugins: Configuration['plugins'] = [];
  const alias: Record<string, string> = {};
  const extensions: string[] = [...BASE_EXTENSIONS];

  for (const contribution of ctx.swcContributions ?? []) {
    const contrib = contribution as FrameworkRspackContributions;
    if (contrib.swc?.jsc) {
      deepMerge(swcJsc, contrib.swc.jsc);
    }
    if (contrib.define) {
      Object.assign(define, contrib.define);
    }
    if (contrib.rules) {
      rules.push(...(contrib.rules as RuleSetRule[]));
    }
    if (contrib.plugins) {
      plugins.push(...(contrib.plugins as NonNullable<Configuration['plugins']>));
    }
    if (contrib.resolve?.alias) {
      Object.assign(alias, contrib.resolve.alias);
    }
    if (contrib.resolve?.extensions) {
      extensions.push(...contrib.resolve.extensions);
    }
    if (contrib.moduleTest?.test) {
      rules.push({ test: contrib.moduleTest.test, type: contrib.moduleTest.type });
    }
  }

  rules.push({
    test: /\.(ts|tsx|jsx|js)$/,
    loader: 'builtin:swc-loader',
    options: { jsc: swcJsc }
  });

  if (tailwind) {
    const tailwindPostcss = (await import('@tailwindcss/postcss')).default;
    const postcssRule = {
      loader: postcssLoaderPath,
      options: { postcssOptions: { plugins: [tailwindPostcss] } }
    };
    rules.push({
      test: /\.css$/,
      use: [
        styleLoaderPath,
        { loader: cssLoaderPath, options: { modules: { auto: true }, importLoaders: 1 } },
        postcssRule
      ]
    });
    rules.push({
      test: /\.s[ac]ss$/i,
      use: [
        styleLoaderPath,
        { loader: cssLoaderPath, options: { modules: { auto: true }, importLoaders: 2 } },
        postcssRule,
        { loader: sassLoaderPath }
      ]
    });
  } else {
    rules.push({
      test: /\.css$/,
      use: [styleLoaderPath, { loader: cssLoaderPath, options: { modules: { auto: true } } }]
    });
    rules.push({
      test: /\.s[ac]ss$/i,
      use: [
        styleLoaderPath,
        { loader: cssLoaderPath, options: { modules: { auto: true }, importLoaders: 1 } },
        { loader: sassLoaderPath }
      ]
    });
  }

  plugins.unshift(new rspack.DefinePlugin(define));
  if (ctx.additionalPlugins) {
    plugins.push(...(ctx.additionalPlugins as NonNullable<Configuration['plugins']>));
  }

  const config: Configuration = {
    mode,
    context: ctx.projectRoot,
    entry: Object.fromEntries(ctx.entries.map((entry) => [entry.name, entry.import])),
    output: {
      path: path.join(ctx.projectRoot, outDir),
      filename: '[name].js',
      chunkFilename: 'chunk.[name].js',
      library: { type: 'amd', name: libraryName },
      chunkLoadingGlobal: `webpackJsonp_${computeUniqueName(ctx)}`,
      crossOriginLoading: 'anonymous',
      publicPath: 'auto',
      devtoolModuleFilenameTemplate: 'webpack:///../[resource-path]'
    },
    externals: ctx.externals,
    resolve: {
      extensions,
      modules: ['node_modules'],
      extensionAlias: { '.js': ['.ts', '.js'] },
      ...(Object.keys(alias).length > 0 ? { alias } : {})
    },
    module: { rules },
    plugins,
    optimization: {
      moduleIds: 'deterministic',
      usedExports: true,
      sideEffects: true,
      removeEmptyChunks: true,
      minimize: mode === 'production' && minify,
      ...(splitChunks ? { splitChunks: { chunks: 'all' } } : {})
    },
    devtool,
    experiments: useCache
      ? {
          cache: {
            type: 'persistent',
            storage: {
              type: 'filesystem',
              directory: path.join(ctx.projectRoot, '.rspack-cache')
            }
          }
        }
      : undefined
  };

  return config;
}
