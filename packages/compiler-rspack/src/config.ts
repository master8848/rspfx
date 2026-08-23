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

const BUILD_TIME_ALIASES: Record<string, string> = {
  '@rspack/plugin-react-refresh': fileURLToPath(new URL('./stubs/react-refresh.js', import.meta.url)),
  '@rspack/plugin-preact-refresh': fileURLToPath(new URL('./stubs/preact-refresh.js', import.meta.url)),
  'vue-loader': fileURLToPath(new URL('./stubs/vue-loader.js', import.meta.url))
};

const SOLID_REFRESH_STUB = fileURLToPath(new URL('./stubs/solid-refresh.js', import.meta.url));

import { canResolveFromProject, isPlatformOnlyModule } from '@mbsks/rspfx-core';

function platformOnlyExternal(data: { request?: string }): string | undefined {
  return typeof data.request === 'string' && isPlatformOnlyModule(data.request) ? `amd ${data.request}` : undefined;
}

/** Build-time stub aliases (refresh plugins, vue-loader) for the native rspack path. */
export { BUILD_TIME_ALIASES, SOLID_REFRESH_STUB };

const BASE_EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json', '.scss', '.css', '.sass'];

/** Build-time aliases shared by the compiler config and the native rspack resolve. */
export { BASE_EXTENSIONS };

const POSTCSS_CONFIG_FILES = [
  'postcss.config.js',
  'postcss.config.cjs',
  'postcss.config.mjs',
  'postcss.config.ts',
  'postcss.config.cts',
  'postcss.config.mts'
];

function tryResolve(name: string, projectRoot: string): string | undefined {
  try {
    const req = createRequire(path.join(projectRoot, 'package.json'));
    return req.resolve(name);
  } catch {}
  try {
    return require.resolve(name);
  } catch {}
  return undefined;
}

function hasPostcssConfigFile(projectRoot: string): boolean {
  for (const f of POSTCSS_CONFIG_FILES) {
    try {
      if (fs.existsSync(path.join(projectRoot, f))) return true;
    } catch {}
  }
  return false;
}

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
  // Persistent filesystem cache: enabled in serve mode for fast incremental rebuilds,
  // and optionally in production/build when RSPFX_CACHE=1 (e.g. CI opt-in).
  const useCache = ctx.serveMode === true || process.env.RSPFX_CACHE === '1' || process.env.RSPFX_CACHE === 'true';

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
  // BUILD_TIME_ALIASES are tiny stubs (react-refresh, preact-refresh, vue-loader);
  // injecting all three is cheap (3 map entries) and avoids per-framework branching
  // in resolve; kept unconditional for correctness — see docs/building-packages.md#sizing--performance.
  const alias: Record<string, string> = { ...BUILD_TIME_ALIASES, ...(ctx.aliases ?? {}) };
  if (ctx.framework === 'solid' && ctx.fastRefresh && !canResolveFromProject(ctx.projectRoot, 'solid-refresh')) {
    alias['solid-refresh'] = SOLID_REFRESH_STUB;
  }
  const extensions: string[] = [...BASE_EXTENSIONS];
  const frameworkRules: RuleSetRule[] = [];

  // Only allow the minimal safe define keys; block RSPFX_* leakage.
  const ALLOWED_DEFINE_KEYS = new Set(['DEBUG', 'DEPRECATED_UNIT_TEST', 'process.env.NODE_ENV']);
  for (const contribution of ctx.swcContributions ?? []) {
    const contrib = contribution as FrameworkRspackContributions;
    if (contrib.swc?.jsc) {
      deepMerge(swcJsc, contrib.swc.jsc);
    }
    if (contrib.define) {
      for (const [k, v] of Object.entries(contrib.define)) {
        if (k.startsWith('RSPFX_') || k.includes('RSPFX')) {
          // Silently drop RSPFX leakage; framework contributions must not define RSPFX env.
          continue;
        }
        if (!ALLOWED_DEFINE_KEYS.has(k)) {
          // Drop unknown keys — only the allowlist is forwarded to DefinePlugin.
          continue;
        }
        define[k] = v;
      }
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

  // CSS handling: always inline via style-loader (never type:"css" or CssExtractRspackPlugin).
  const cssEnabled = (ctx.build as unknown as Record<string, unknown>)?.css !== false;
  const scssEnabled = (ctx.build as unknown as Record<string, unknown>)?.scss !== false;

  let styleLoaderPath: string | undefined = tryResolve('style-loader', ctx.projectRoot);
  let cssLoaderPath: string | undefined = tryResolve('css-loader', ctx.projectRoot);
  const postcssLoaderPath: string | undefined = tryResolve('postcss-loader', ctx.projectRoot);
  const postcssPath: string | undefined = tryResolve('postcss', ctx.projectRoot);
  const hasPostcss = hasPostcssConfigFile(ctx.projectRoot);
  const postcssAvailable = hasPostcss && !!postcssLoaderPath && !!postcssPath;

  if (cssEnabled && styleLoaderPath && cssLoaderPath) {
    const cssUse: unknown[] = [
      styleLoaderPath,
      {
        loader: cssLoaderPath,
        options: { modules: { auto: /\.module\.\w+$/i, namedExport: false, exportLocalsConvention: 'asIs' } }
      }
    ];
    if (postcssAvailable && postcssLoaderPath) {
      (cssUse as unknown[]).push({ loader: postcssLoaderPath });
    }
    rules.push({ test: /\.css$/, use: cssUse as RuleSetRule['use'] });
  }

  const sassPath: string | undefined = tryResolve('sass', ctx.projectRoot);
  let sassLoaderPath: string | undefined = tryResolve('sass-loader', ctx.projectRoot);
  const hasSass = !!sassPath && !!sassLoaderPath;

  if (scssEnabled && hasSass && styleLoaderPath && cssLoaderPath && sassLoaderPath) {
    const importLoaders = (postcssAvailable ? 1 : 0) + 1;
    const scssUse: unknown[] = [
      styleLoaderPath,
      {
        loader: cssLoaderPath,
        options: { modules: { auto: /\.module\.\w+$/i, namedExport: false, exportLocalsConvention: 'asIs' }, importLoaders }
      }
    ];
    if (postcssAvailable && postcssLoaderPath) {
      (scssUse as unknown[]).push({ loader: postcssLoaderPath });
    }
    (scssUse as unknown[]).push({ loader: sassLoaderPath, options: { api: 'modern' } });
    rules.push({ test: /\.s[ac]ss$/i, use: scssUse as RuleSetRule['use'] });
  }

  rules.push({ test: /\.html$/, type: 'asset/source' });

  plugins.unshift(new rspack.DefinePlugin(define));
  if (ctx.additionalPlugins) {
    plugins.push(...(ctx.additionalPlugins as NonNullable<Configuration['plugins']>));
  }
  plugins.push(new SpfxPublicPathPlugin({ entries: ctx.entries }));
  if (ctx.localizedResources && ctx.localizedResources.length > 0) {
    plugins.push(new SpfxLocalizedResourcesPlugin(ctx.localizedResources));
  }

  // Library uses the same AMD wrapper as WebPart/Extension — loaderConfig/entryModuleId drive the difference.
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
    externals: [...ctx.externals, platformOnlyExternal, ...(ctx.localizedResources ?? []).map((resource) => resource.name)],
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
