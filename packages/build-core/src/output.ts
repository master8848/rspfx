import path from 'node:path';
import { computeUniqueName, type BundleEntryLike } from './amd.js';

/** Sentinel replaced by script URL at runtime (SpfxPublicPathPlugin). */
export const SPFX_PUBLIC_PATH_SENTINEL = '__RSPFX_SPFX_PUBLIC_PATH__';

/** Resolve rspack `devtool` for SPFx (hidden-source-map in prod when sourcemap enabled). */
export function getDevtool(production: boolean, sourcemap?: boolean): 'hidden-source-map' | 'source-map' | false {
  if (production) {
    return sourcemap ? 'hidden-source-map' : false;
  }
  return 'source-map';
}

export interface SpfxOutputOptions {
  projectRoot: string;
  outDir?: string;
  entries: BundleEntryLike[];
  uniqueName?: string;
}

/** Create SPFx output config (AMD library, publicPath sentinel, chunk naming). */
export function createSpfxOutput(opts: SpfxOutputOptions): {
  path: string;
  filename: string;
  chunkFilename: string;
  assetModuleFilename: string;
  uniqueName: string;
  library: { type: string };
  chunkLoadingGlobal: string;
  crossOriginLoading: string;
  publicPath: string;
  devtoolModuleFilenameTemplate: string;
} {
  const outDir = opts.outDir ?? 'dist';
  const uniqueName = opts.uniqueName ?? computeUniqueName(opts.entries as BundleEntryLike[]);
  return {
    path: path.join(opts.projectRoot, outDir),
    filename: '[name].js',
    chunkFilename: 'chunk.[name].js',
    assetModuleFilename: 'assets/[hash][ext][query]',
    uniqueName,
    library: { type: 'amd' },
    chunkLoadingGlobal: `webpackJsonp_${uniqueName}`,
    crossOriginLoading: 'anonymous',
    publicPath: SPFX_PUBLIC_PATH_SENTINEL,
    devtoolModuleFilenameTemplate: 'webpack:///../[resource-path]'
  };
}
