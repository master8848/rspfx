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
import { getPlugins } from '@mbsks/rspfx-plugin-api';
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
          for (const plugin of getPlugins()) {
            plugin.devHooks?.beforeStart?.({ mode, port: settingsNow.port });
          }
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

      api.onAfterStartDevServer(({ port }) => {
        isDevServer = true;
        originRef.value = `${settings.scheme}://${settings.hostname}:${port}`;
        void regenerateAndTick().catch((error: unknown) => {
          logger.error(
            `Failed to regenerate manifests: ${error instanceof Error ? error.message : String(error)}`
          );
        });
        const workbenchUrl = buildWorkbenchUrl({ ...settings, origin: originRef.value }, resolved);
        if (workbenchUrl && resolved.dev.openBrowser) {
          openBrowser(workbenchUrl);
          logger.info(`Workbench: ${workbenchUrl}`);
        }
        logger.success(`Manifest server running at ${originRef.value}/temp/manifests.js`);
        for (const plugin of getPlugins()) {
          plugin.devHooks?.afterStart?.({ url: originRef.value });
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
        config.tools = { ...(config.tools ?? {}), htmlPlugin: false };
        config.output = {
          ...(config.output ?? {}),
          legalComments: 'none',
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
        if (styleLoaderPath && cssLoaderPath && sassLoaderPath) {
          config.module = config.module ?? {};
          config.module.rules = [
            ...(config.module.rules ?? []),
            {
              test: /\.css$/,
              use: [styleLoaderPath, { loader: cssLoaderPath, options: { modules: { auto: true } } }]
            },
            {
              test: /\.s[ac]ss$/i,
              use: [
                styleLoaderPath,
                { loader: cssLoaderPath, options: { modules: { auto: true }, importLoaders: 1 } },
                { loader: sassLoaderPath, options: { api: 'modern' } }
              ]
            },
            { test: /\.html$/, type: 'asset/source' }
          ];
        }
        const production = utils.isProd;
        config.optimization = {
          ...config.optimization,
          ...(production ? {} : { minimize: false }),
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
          (preset.rsbuild
            ? preset.rsbuild({ fastRefresh })
            : preset.contributions({ fastRefresh })) as unknown as Record<string, unknown>,
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


