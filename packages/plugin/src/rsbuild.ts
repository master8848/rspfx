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
import { readProject, type ReadProjectResult } from '@mbsks/rspfx-dev-runtime';
import { findSpDependencies } from '@mbsks/rspfx-manifest-generator';
import type { RspfxPluginOptions } from './types.js';

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
    ...findSpDependencies(root).keys(),
    ...projectExternals,
    ...localizedResources.map((resource) => resource.name)
  ];
}
