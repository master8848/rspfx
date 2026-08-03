import { createHash } from 'node:crypto';
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
  buildWorkbenchUrl,
  openBrowser,
  type ReadProjectResult
} from '@mbsks/rspfx-dev-runtime';
import { findSpDependencies } from '@mbsks/rspfx-manifest-generator';
import { createLogger } from '@mbsks/rspfx-diagnostics';
import type { RspfxPluginOptions } from './types.js';

const logger = createLogger('rspfx');

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
          return readProject(root, resolved.paths, resolved.version);
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

      api.onAfterStartDevServer(({ port }) => {
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
      });

      api.onAfterDevCompile(() => {
        void regenerateAndTick().catch((error: unknown) => {
          logger.error(
            `Failed to regenerate manifests: ${error instanceof Error ? error.message : String(error)}`
          );
        });
      });

      api.modifyRsbuildConfig((config) => {
        config.tools = { ...(config.tools ?? {}), htmlPlugin: false };
        config.output = {
          ...(config.output ?? {}),
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

      api.modifyRspackConfig((config, utils) => {
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
        const production = utils.isProd;
        if (!production) {
          config.optimization = { ...config.optimization, minimize: false };
        }
        config.plugins.push(
          new rspack.DefinePlugin({
            DEBUG: JSON.stringify(!production),
            DEPRECATED_UNIT_TEST: JSON.stringify(false),
            'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development')
          }),
          new SpfxPublicPathPlugin({ entries: project.webParts.entries })
        );
        if (project.localizedResources.length > 0) {
          config.plugins.push(new SpfxLocalizedResourcesPlugin(project.localizedResources));
        }
      });
    }
  };
}

function amdName(entry: BundleEntry): string {
  return `${entry.componentIds[0]}_${entry.version}`;
}

function computeUniqueName(entries: BundleEntry[]): string {
  if (entries.length === 1) {
    return amdName(entries[0]!);
  }
  const joined = entries.map(amdName).join('');
  return createHash('md5').update(joined).digest('hex');
}

function collectExternals(
  root: string,
  projectExternals: string[],
  localizedResources: LocalizedResource[]
): string[] {
  return [
    ...new Set([
      ...findSpDependencies(root).keys(),
      ...projectExternals,
      ...localizedResources.map((resource) => resource.name)
    ])
  ];
}
