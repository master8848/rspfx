export type {
  BuildResult,
  BundleEntry,
  CompileContext,
  DevServerOptions,
  LocalizedResource,
  LocalizedResourceFile,
  StartDevServerResult,
  WatchHandle
} from './types.js';
export { RspfxError } from './errors.js';
export { createRspackConfig } from './config.js';
export { spfx, type SpfxPluginOptions } from './plugin.js';
export { SpfxPublicPathPlugin, SPFX_PUBLIC_PATH_SENTINEL } from './public-path.js';
export { SpfxLocalizedResourcesPlugin } from './localized-resources.js';
export { build } from './build.js';
export { watch } from './watch.js';
export { startDevServer } from './dev-server.js';
