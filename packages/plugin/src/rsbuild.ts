import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { rspack } from '@rspack/core';
import type { RsbuildPluginAPI } from '@rsbuild/core';
import {
  resolveConfig,
  RSPFX_PLUGIN_MARKER,
  RSPFX_PLUGIN_OPTIONS,
  type RspfxBundlerPluginLike,
  type RspfxConfig
} from '@mbsks/rspfx-core';
import {
  SpfxPublicPathPlugin,
  SpfxLocalizedResourcesPlugin,
  SPFX_PUBLIC_PATH_SENTINEL,
  type BundleEntry,
  type LocalizedResource
} from '@mbsks/rspfx-compiler-rspack';
import {
  readProject,
  createManifestRegenerator,
  createReloadController,
  resolveServeSettings,
  resolveServeMode,
  buildWorkbenchUrl,
  assembleRelease,
  openBrowser,
  loadFrameworkPreset,
  resolveContributionLoaders,
  type ReadProjectResult
} from '@mbsks/rspfx-dev-runtime';
import { createHookBus, getPlugins } from '@mbsks/rspfx-plugin-api';
import type { FrameworkPreset, FrameworkRsbuildContributions } from '@mbsks/rspfx-plugin-api';
import { createLogger } from '@mbsks/rspfx-diagnostics';
import type { RspfxPluginOptions } from './types.js';
import { amdName, collectExternals, computeUniqueName, writeStatsJson } from './shared.js';

const logger = createLogger('rspfx');

const require = createRequire(import.meta.url);
let styleLoaderPath: string | undefined;
let cssLoaderPath: string | undefined;
let sassLoaderPath: string | undefined;
try {
  styleLoaderPath = require.resolve('style-loader');
  cssLoaderPath = require.resolve('css-loader');
  sassLoaderPath = require.resolve('sass-loader');
} catch {
  // Collocated with compiler-rspack; loaders may be hoisted.
}

function resolveFromProject(request: string, root: string, fallback: string | undefined): string | undefined {
  try {
    const requireFromProject = createRequire(path.join(root, 'package.json'));
    return requireFromProject.resolve(request);
  } catch {
    // fall through to fallback
  }
  if (fallback) {
    return fallback;
  }
  try {
    return require.resolve(request);
  } catch {
    return undefined;
  }
}

export function hasPostcssConfig(root: string): boolean {
  // Mirror compiler-rspack: detect postcss via fs.existsSync postcss.config.* at root
  const candidates = [
    'postcss.config.js',
    'postcss.config.cjs',
    'postcss.config.mjs',
    'postcss.config.ts',
    'postcss.config.cts',
    'postcss.config.mts',
    'postcss.config.json'
  ];
  for (const file of candidates) {
    if (fs.existsSync(path.join(root, file))) {
      return true;
    }
  }
  // Fallback: any postcss.config.* file (covers future extensions)
  try {
    const entries = fs.readdirSync(root);
    return entries.some((f) => f.startsWith('postcss.config.'));
  } catch {
    return false;
  }
}

function hasSassInstalled(root: string): boolean {
  try {
    const requireFromProject = createRequire(path.join(root, 'package.json'));
    requireFromProject.resolve('sass');
    return true;
  } catch {
    try {
      require.resolve('sass');
      return true;
    } catch {
      return false;
    }
  }
}

export interface RsbuildRspfxPlugin extends RspfxBundlerPluginLike {
  name: string;
  setup(api: RsbuildPluginAPI): void | Promise<void>;
}

export function rspfxRsbuild(options: RspfxPluginOptions): RsbuildRspfxPlugin {
  const { projectRoot, ...rest } = options;
  const root = projectRoot ?? process.cwd();
  const resolved = resolveConfig(rest);

  return {
    name: 'rspfx-rsbuild',
    [RSPFX_PLUGIN_MARKER]: true,
    [RSPFX_PLUGIN_OPTIONS]: resolved,

    setup(api) {
      const read = (): ReadProjectResult | undefined => {
        try {
          return readProject(root, resolved.paths, resolved.version, resolved);
        } catch (error) {
          api.logger.warn(
            'rspfxRsbuild: no web part bundles discovered — SPFx pipeline skipped. ' +
              `Run "rspfx build"/"rspfx dev" for the full pipeline (${error instanceof Error ? error.message : String(error)})`
          );
          return undefined;
        }
      };

      const settings = resolveServeSettings({ config: resolved }, read()?.serveJson);
      const reload = createReloadController();
      const originRef: { value: string } = { value: settings.origin };

      let regenerator: ReturnType<typeof createManifestRegenerator> | undefined;
      const ensureRegenerator = (): ReturnType<typeof createManifestRegenerator> | undefined => {
        if (regenerator) {
          return regenerator;
        }
        const project = read();
        if (!project) {
          return undefined;
        }
        const entryModuleIds: Record<string, string> = {};
        project.webParts.bundles.forEach((bundle, index) => {
          entryModuleIds[project.webParts.manifestIds[index]!] = bundle.bundleName;
        });
        regenerator = createManifestRegenerator({
          projectRoot: root,
          production: false,
          origin: () => originRef.value,
          packageVersion: project.webParts.packageVersion,
          entries: project.webParts.entries,
          externals: collectExternals(root, project.externals, project.localizedResources),
          localizedResources: project.localizedResources,
          webpartsDir: resolved.paths?.webpartsDir,
          extensionsDir: resolved.paths?.extensionsDir,
          librariesDir: resolved.paths?.librariesDir,
          entryModuleIds,
          bundleUrlSuffix: () => `?t=${reload.current}`
        });
        return regenerator;
      };

      const regenerateAndTick = async (): Promise<void> => {
        const regen = ensureRegenerator();
        if (!regen) {
          return;
        }
        await regen.regenerate();
        reload.tick();
      };

      api.onBeforeStartDevServer(({ server }) => {
        const project = read();
        if (project) {
          const settingsNow = resolveServeSettings({ config: resolved }, project.serveJson);
          const mode = resolveServeMode({ mode: undefined, config: resolved }, settingsNow.tenantDomain);
          const bus = createHookBus(getPlugins(), { logger: logger.child({ phase: 'beforeStart' }) });
          void bus.emitBeforeStart({ mode, port: settingsNow.port }).then((result) => {
            if (!result.ok) logger.warn(`beforeStart hook failed: ${result.error.message}`);
          });
        }
        server.middlewares.use('/temp/manifests.js', (_req, res, next) => {
          const regen = ensureRegenerator();
          if (!regen) {
            next();
            return;
          }
          const response = res as {
            setHeader(k: string, v: string): void;
            end(b: string): void;
            statusCode?: number;
          };
          void regen
            .regenerate()
            .then(() => {
              response.setHeader('Content-Type', 'application/javascript');
              response.setHeader('Cache-Control', 'no-store');
              response.end(regen.manifestsJs + reload.clientScript);
            })
            .catch((error: unknown) => {
              response.statusCode = 500;
              response.end(error instanceof Error ? error.message : String(error));
            });
        });
        server.middlewares.use(reload.path, (req, res) => {
          reload.handle(req, res as Parameters<typeof reload.handle>[1]);
        });
      });

      let isDevServer = false;

      // Browser open is once-only on initial dev server start — never on HMR/rebuild.
      // Uses `onAfterStartDevServer` only (not `onAfterDevCompile`) and `browserOpened` guard.
      // Respects CLI `--browser` via `RSPFX_OPEN_BROWSER` env (set by `rspfx dev`),
      // falling back to `config.dev.openBrowser`. `onAfterDevCompile`/`regenerateAndTick`
      // intentionally do NOT open the browser.
      let browserOpened = false;
      api.onAfterStartDevServer(async ({ port }) => {
        isDevServer = true;
        originRef.value = `${settings.scheme}://${settings.hostname}:${port}`;
        void regenerateAndTick().catch((error: unknown) => {
          logger.error(
            `Failed to regenerate manifests: ${error instanceof Error ? error.message : String(error)}`
          );
        });
        const workbenchUrl = buildWorkbenchUrl({ ...settings, origin: originRef.value }, resolved);
        const shouldOpenBrowser =
          process.env.RSPFX_OPEN_BROWSER === '1'
            ? true
            : process.env.RSPFX_OPEN_BROWSER === '0'
              ? false
              : (resolved.dev.openBrowser ?? false);
        if (!browserOpened && workbenchUrl && shouldOpenBrowser) {
          browserOpened = true;
          openBrowser(workbenchUrl);
          logger.info(`Workbench: ${workbenchUrl}`);
        }
        logger.success(`Manifest server running at ${originRef.value}/temp/manifests.js`);
        {
          const bus = createHookBus(getPlugins(), { logger: logger.child({ phase: 'afterStart' }) });
          await bus.emitAfterStart({ url: originRef.value });
        }
      });

      api.onAfterDevCompile(() => {
        void regenerateAndTick().catch((error: unknown) => {
          logger.error(
            `Failed to regenerate manifests: ${error instanceof Error ? error.message : String(error)}`
          );
        });
      });

      api.onAfterBuild(() => {
        if (isDevServer) {
          return;
        }
        const project = read();
        if (!project) {
          return;
        }
        const distDir = path.join(root, resolved.build.outDir ?? 'dist');
        let outputFiles: string[] = [];
        if (fs.existsSync(distDir)) {
          outputFiles = fs
            .readdirSync(distDir)
            .filter((file) => file.endsWith('.js') && fs.statSync(path.join(distDir, file)).isFile());
        }
        return assembleRelease({
          projectRoot: root,
          config: resolved,
          project,
          externals: collectExternals(root, project.externals, project.localizedResources),
          outputFiles,
          production: true
        }).catch((error: unknown) => {
          logger.error(
            `Failed to assemble release: ${error instanceof Error ? error.message : String(error)}`
          );
        }).then(() => undefined);
      });

      api.onAfterBuild(({ stats }) => {
        if (!stats) {
          return;
        }
        const moduleCounts: Record<string, number> = {};
        const statsList = 'stats' in stats ? stats.stats : [stats];
        for (const s of statsList) {
          const json = s.toJson({ all: false, chunks: true, chunkModules: true });
          for (const chunk of json.chunks ?? []) {
            const rec = chunk as {
              name?: string;
              names?: string[];
              modules?: unknown[];
              entry?: boolean;
              initial?: boolean;
            };
            if (!rec.entry && !rec.initial) {
              continue;
            }
            const name = rec.name ?? rec.names?.[0];
            if (!name) {
              continue;
            }
            moduleCounts[name] = Array.isArray(rec.modules) ? rec.modules.length : 0;
          }
        }
        if (Object.keys(moduleCounts).length > 0) {
          writeStatsJson(root, moduleCounts);
        }
      });

      api.modifyRsbuildConfig((config) => {
        const userInject = (config.output as any)?.injectStyles;
        config.tools = { ...(config.tools ?? {}), htmlPlugin: false };
        config.output = {
          ...(config.output ?? {}),
          legalComments: 'none',
          injectStyles: userInject ?? true,
          distPath: {
            ...(typeof config.output?.distPath === 'object' ? config.output.distPath : {}),
            root: resolved.build.outDir
          }
        };
        const project = read();
        if (!project) {
          return;
        }
        config.source = {
          ...(config.source ?? {}),
          entry: Object.fromEntries(
            project.webParts.entries.map((entry) => [
              entry.name,
              { import: entry.import, library: { type: 'amd', name: amdName(entry) } }
            ])
          )
        };
      });

      let frameworkPresetPromise: ReturnType<typeof loadFrameworkPreset> | undefined;
      const loadPreset = (): ReturnType<typeof loadFrameworkPreset> =>
        (frameworkPresetPromise ??= loadFrameworkPreset(resolved.framework, root));

      api.modifyRspackConfig(async (config, utils) => {
        const project = read();
        if (!project) {
          return;
        }
        config.entry = Object.fromEntries(
          project.webParts.entries.map((entry) => [
            entry.name,
            { import: entry.import, library: { type: 'amd', name: amdName(entry) } }
          ])
        );
        config.externals = collectExternals(root, project.externals, project.localizedResources);
        config.output = {
          ...config.output,
          filename: '[name].js',
          chunkFilename: 'chunk.[name].js',
          library: { type: 'amd' },
          chunkLoadingGlobal: `webpackJsonp_${computeUniqueName(project.webParts.entries)}`,
          crossOriginLoading: 'anonymous',
          publicPath: SPFX_PUBLIC_PATH_SENTINEL
        };
        const localizedAliases = project.localizedAliases;
        if (Object.keys(localizedAliases).length > 0) {
          config.resolve.alias = { ...(config.resolve.alias ?? {}), ...localizedAliases };
        }
        const cssEnabled = (resolved.build as any)?.css !== false;
        if (cssEnabled) {
          const hasPostcss = hasPostcssConfig(root);
          const styleLoader = resolveFromProject('style-loader', root, styleLoaderPath);
          const cssLoader = resolveFromProject('css-loader', root, cssLoaderPath);
          const sassLoader = resolveFromProject('sass-loader', root, sassLoaderPath);
          let postcssLoader: string | undefined;
          if (hasPostcss) {
            postcssLoader = resolveFromProject('postcss-loader', root, undefined);
            if (!postcssLoader) {
              try {
                postcssLoader = require.resolve('postcss-loader');
              } catch {
                postcssLoader = undefined;
              }
            }
          }
          const hasSass = !!sassLoader && hasSassInstalled(root);
          if (styleLoader && cssLoader) {
            config.module = config.module ?? {};
            const rules: NonNullable<typeof config.module.rules> = [...(config.module.rules ?? [])];
            type LoaderUse = string | { loader: string; options?: Record<string, unknown> };
            const cssUse: LoaderUse[] = [
              styleLoader,
              {
                loader: cssLoader,
                options: {
                  modules: { auto: /\.module\.\w+$/i, namedExport: false, exportLocalsConvention: 'asIs' },
                  importLoaders: hasPostcss && postcssLoader ? 1 : 0
                }
              }
            ];
            if (hasPostcss && postcssLoader) {
              cssUse.push({ loader: postcssLoader });
            }
            rules.push({ test: /\.css$/, use: cssUse as unknown as NonNullable<import('@rspack/core').RuleSetRule['use']> });
            if (hasSass) {
              const scssUse: LoaderUse[] = [
                styleLoader,
                {
                  loader: cssLoader,
                  options: {
                    modules: { auto: /\.module\.\w+$/i, namedExport: false, exportLocalsConvention: 'asIs' },
                    importLoaders: hasPostcss && postcssLoader ? 2 : 1
                  }
                }
              ];
              if (hasPostcss && postcssLoader) {
                scssUse.push({ loader: postcssLoader });
              }
              scssUse.push({ loader: sassLoader!, options: { api: 'modern' } });
              rules.push({ test: /\.s[ac]ss$/i, use: scssUse as unknown as NonNullable<import('@rspack/core').RuleSetRule['use']> });
            }
            rules.push({ test: /\.html$/, type: 'asset/source' });
            config.module.rules = rules;
          } else {
            config.module = config.module ?? {};
            config.module.rules = [...(config.module.rules ?? []), { test: /\.html$/, type: 'asset/source' }];
          }
        } else {
          config.module = config.module ?? {};
          config.module.rules = [...(config.module.rules ?? []), { test: /\.html$/, type: 'asset/source' }];
        }
        const production = utils.isProd;
        config.optimization = {
          ...config.optimization,
          minimize: production ? (resolved.build.minify ?? true) : false,
          splitChunks: false
        };
        const defineOptions: Record<string, string> = {
          DEBUG: JSON.stringify(!production),
          DEPRECATED_UNIT_TEST: JSON.stringify(false),
          'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development')
        };
        config.plugins.push(
          new rspack.DefinePlugin(defineOptions),
          new SpfxPublicPathPlugin({ entries: project.webParts.entries })
        );
        if (project.localizedResources.length > 0) {
          config.plugins.push(new SpfxLocalizedResourcesPlugin(project.localizedResources));
        }
        const frameworkModule = await loadPreset();
        const preset = frameworkModule.preset as unknown as FrameworkPreset;
        const fastRefresh =
          !utils.isProd &&
          (process.env['RSPFX_FAST_REFRESH'] === '1' || (resolved.dev.fastRefresh ?? false));
        const contribs = resolveContributionLoaders(
          ((preset.rsbuild
            ? preset.rsbuild({ fastRefresh })
            : preset.contributions?.({ fastRefresh })) ?? {}) as unknown as Record<string, unknown>,
          frameworkModule.moduleUrl
        ) as unknown as FrameworkRsbuildContributions;
        if (contribs.rules) {
          config.module = {
            ...config.module,
            rules: [
              ...(config.module.rules ?? []),
              ...(contribs.rules as NonNullable<typeof config.module.rules>)
            ]
          };
        }
        if (contribs.plugins) {
          config.plugins.push(...(contribs.plugins as typeof config.plugins));
        }
        if (contribs.resolve?.extensions) {
          config.resolve.extensions = [...(config.resolve.extensions ?? []), ...contribs.resolve.extensions];
        }
        if (contribs.resolve?.alias) {
          config.resolve.alias = { ...(config.resolve.alias ?? {}), ...contribs.resolve.alias };
        }
        if (contribs.define) {
          const allowed = new Set(['DEBUG', 'DEPRECATED_UNIT_TEST', 'process.env.NODE_ENV']);
          for (const [k, v] of Object.entries(contribs.define)) {
            if (k.startsWith('RSPFX_') || k.includes('RSPFX')) {
              logger.warn(`Ignoring disallowed define key '${k}' from rsbuild contributions (RSPFX leakage blocked)`);
              continue;
            }
            if (!allowed.has(k)) {
              logger.warn(`Ignoring disallowed define key '${k}' from rsbuild contributions (allowlist: ${[...allowed].join(', ')})`);
              continue;
            }
            defineOptions[k] = v;
          }
        }
      });
    }
  };
}


