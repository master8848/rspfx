import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { rspack, type Configuration, type RuleSetRule } from '@rspack/core';
import type { CompileContext } from './types.js';
import { RspfxError } from './errors.js';
import { SpfxLocalizedResourcesPlugin } from './localized-resources.js';
import { SpfxPublicPathPlugin, SPFX_PUBLIC_PATH_SENTINEL } from './public-path.js';
import type { FrameworkRspackContributions } from '@mbsks/rspfx-plugin-api';

const require = createRequire(import.meta.url);

const styleLoaderPath = require.resolve('style-loader');
const cssLoaderPath = require.resolve('css-loader');
const sassLoaderPath = require.resolve('sass-loader');

const BUILD_TIME_ALIASES: Record<string, string> = {
  '@rspack/plugin-react-refresh': fileURLToPath(new URL('./stubs/react-refresh.js', import.meta.url)),
  '@rspack/plugin-preact-refresh': fileURLToPath(new URL('./stubs/preact-refresh.js', import.meta.url)),
  'vue-loader': fileURLToPath(new URL('./stubs/vue-loader.js', import.meta.url))
};

const SOLID_REFRESH_STUB = fileURLToPath(new URL('./stubs/solid-refresh.js', import.meta.url));

/** Build-time stub aliases (refresh plugins, vue-loader) for the native rspack path. */
export { BUILD_TIME_ALIASES, SOLID_REFRESH_STUB };

function canResolveFromProject(projectRoot: string, specifier: string): boolean {
  const packageName = specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0]!;
  let dir = projectRoot;
  for (;;) {
    if (fs.existsSync(path.join(dir, 'node_modules', packageName))) {
      return true;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return false;
    }
    dir = parent;
  }
}

const BASE_EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json', '.scss', '.css', '.sass'];

/** Build-time aliases shared by the compiler config and the native rspack resolve. */
export { BASE_EXTENSIONS };

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
  for (const entry of ctx.entries) {
    if (entry.componentIds.length === 0) {
      throw new RspfxError(
        'COMPILE_ENTRY_NO_COMPONENT_ID',
        `compiler-rspack: bundle entry "${entry.name}" has no component id — check its .manifest.json "id" field`
      );
    }
    if (!entry.version) {
      throw new RspfxError(
        'COMPILE_ENTRY_NO_VERSION',
        `compiler-rspack: bundle entry "${entry.name}" has no version`
      );
    }
  }
  const build = ctx.build;
  const mode = ctx.production ? 'production' : 'development';
  const outDir = build.outDir ?? 'dist';
  const sourcemap = build.sourcemap ?? false;
  const minify = build.minify ?? true;
  const splitChunks = build.splitChunks ?? false;
  const useCache = ctx.serveMode === true;

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
  const alias: Record<string, string> = { ...BUILD_TIME_ALIASES, ...(ctx.aliases ?? {}) };
  if (ctx.framework === 'solid' && ctx.fastRefresh && !canResolveFromProject(ctx.projectRoot, 'solid-refresh')) {
    alias['solid-refresh'] = SOLID_REFRESH_STUB;
  }
  const extensions: string[] = [...BASE_EXTENSIONS];
  const frameworkRules: RuleSetRule[] = [];

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
      frameworkRules.push(...(contrib.rules as RuleSetRule[]));
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
      frameworkRules.push({ test: contrib.moduleTest.test, type: contrib.moduleTest.type });
    }
  }

  const claimsJsx = (test: unknown): boolean => {
    if (test instanceof RegExp) {
      return test.test('file.tsx') || test.test('file.jsx');
    }
    return typeof test === 'string' && (test.includes('.tsx') || test.includes('.jsx'));
  };
  const frameworkHandlesJsx = frameworkRules.some((rule) => claimsJsx(rule.test));

  const jsSourceTest = frameworkHandlesJsx ? /\.(ts|js)$/ : /\.(ts|tsx|jsx|js)$/;
  rules.push({
    test: jsSourceTest,
    loader: 'builtin:swc-loader',
    options: { jsc: swcJsc }
  });

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

  rules.push({ test: /\.html$/, type: 'asset/source' });

  plugins.unshift(new rspack.DefinePlugin(define));
  if (ctx.additionalPlugins) {
    plugins.push(...(ctx.additionalPlugins as NonNullable<Configuration['plugins']>));
  }
  plugins.push(new SpfxPublicPathPlugin({ entries: ctx.entries }));
  if (ctx.localizedResources && ctx.localizedResources.length > 0) {
    plugins.push(new SpfxLocalizedResourcesPlugin(ctx.localizedResources));
  }

  const config: Configuration = {
    mode,
    context: ctx.projectRoot,
    entry: Object.fromEntries(
      ctx.entries.map((entry) => [
        entry.name,
        {
          import: entry.import,
          library: { type: 'amd', name: `${entry.componentIds[0]!}_${entry.version}` }
        }
      ])
    ),
    output: {
      path: path.join(ctx.projectRoot, outDir),
      filename: '[name].js',
      chunkFilename: 'chunk.[name].js',
      library: { type: 'amd' },
      chunkLoadingGlobal: `webpackJsonp_${computeUniqueName(ctx)}`,
      crossOriginLoading: 'anonymous',
      publicPath: SPFX_PUBLIC_PATH_SENTINEL,
      devtoolModuleFilenameTemplate: 'webpack:///../[resource-path]'
    },
    externals: [...ctx.externals, ...(ctx.localizedResources ?? []).map((resource) => resource.name)],
    resolve: {
      extensions,
      modules: ['node_modules'],
      extensionAlias: { '.js': ['.ts', '.js'] },
      ...(Object.keys(alias).length > 0 ? { alias } : {})
    },
    module: { rules },
    plugins,
    optimization: {
      moduleIds: ctx.production ? 'deterministic' : 'named',
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
