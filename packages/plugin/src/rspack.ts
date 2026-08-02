import { rspack, type Compiler } from '@rspack/core';
import {
  resolveConfig,
  RSPFX_PLUGIN_MARKER,
  type RspfxBundlerPluginLike,
  type RspfxConfig
} from '@mbsks/rspfx-core';
import {
  SpfxPublicPathPlugin,
  SpfxLocalizedResourcesPlugin,
  type BundleEntry,
  type LocalizedResource
} from '@mbsks/rspfx-compiler-rspack';
import { readProject } from '@mbsks/rspfx-dev-runtime';
import { createLogger } from '@mbsks/rspfx-diagnostics';
import type { RspfxPluginOptions } from './types.js';

const logger = createLogger('rspfx');

/**
 * The Rspack/Webpack-compatible rspfx plugin. Use it in `rspack.config.ts`:
 *
 * ```ts
 * import { RspfxPlugin } from '@mbsks/rspfx-plugin';
 * export default {
 *   mode: 'development',
 *   plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react', dev: {...}, build: {...} })]
 * };
 * ```
 *
 * `apply(compiler)` injects the SPFx runtime plugins (AMD public-path capture,
 * localized resource emission, DEBUG/NODE_ENV defines) when the compiler runs
 * directly (rspack / webpack-compatible bundlers such as Turbopack).
 *
 * The CLI (`rspfx dev|build|package|…`) instead reads `this.options` from the
 * plugin instance in the user's bundler config and composes the full pipeline
 * (entries discovery, externals, manifests, dev server, sppkg assembly).
 */
export class RspfxPlugin implements RspfxBundlerPluginLike {
  readonly options: RspfxConfig;
  private readonly projectRoot: string;
  readonly [RSPFX_PLUGIN_MARKER]: true = true;

  constructor(options: RspfxPluginOptions) {
    const { projectRoot, ...rest } = options;
    this.projectRoot = projectRoot ?? process.cwd();
    this.options = resolveConfig(rest);
  }

  apply(compiler: Compiler): void {
    let entries: BundleEntry[];
    let localizedResources: LocalizedResource[];
    try {
      const project = readProject(this.projectRoot, this.options.paths);
      entries = project.webParts.entries;
      localizedResources = project.localizedResources;
    } catch (error) {
      logger.warn(
        'RspfxPlugin: no web part bundles discovered — SPFx runtime plugins skipped. ' +
          `Run "rspfx build"/"rspfx dev" for the full pipeline (${error instanceof Error ? error.message : String(error)})`
      );
      return;
    }

    new SpfxPublicPathPlugin({ entries }).apply(compiler);
    if (localizedResources.length > 0) {
      new SpfxLocalizedResourcesPlugin(localizedResources).apply(compiler);
    }
    new rspack.DefinePlugin({
      DEBUG: JSON.stringify(true),
      DEPRECATED_UNIT_TEST: JSON.stringify(false),
      'process.env.NODE_ENV': JSON.stringify('development')
    }).apply(compiler);
  }
}
