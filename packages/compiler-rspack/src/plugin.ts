import type { BuildConfig, FrameworkId } from '@mbsks/rspfx-core';
import type { BundleEntry } from './types.js';
import { createRspackConfig } from './config.js';

export interface SpfxPluginOptions {
  projectRoot: string;
  framework: FrameworkId;
  entries: BundleEntry[];
  externals?: string[];
  fastRefresh?: boolean;
  production?: boolean;
  aliases?: Record<string, string>;
  localizedResources?: import('./types.js').LocalizedResource[];
  build?: Partial<BuildConfig>;
  serveMode?: boolean;
  additionalPlugins?: unknown[];
  swcContributions?: Record<string, unknown>[];
}

export async function spfx(options: SpfxPluginOptions): Promise<unknown> {
  return createRspackConfig({
    projectRoot: options.projectRoot,
    framework: options.framework,
    fastRefresh: options.fastRefresh ?? false,
    production: options.production ?? true,
    entries: options.entries,
    externals: options.externals ?? [],
    aliases: options.aliases ?? {},
    localizedResources: options.localizedResources,
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
  });
}
