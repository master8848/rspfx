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
export { createRspackConfig, BASE_EXTENSIONS, BUILD_TIME_ALIASES, SOLID_REFRESH_STUB } from './config.js';
export { spfx, type SpfxPluginOptions } from './plugin.js';
export {
  SpfxPublicPathPlugin,
  SPFX_PUBLIC_PATH_SENTINEL,
  scriptUrlCaptureLine,
  scriptUrlPublicPathExpression
} from './public-path.js';
export { SpfxLocalizedResourcesPlugin } from './localized-resources.js';
export { build } from './build.js';
export { watch } from './watch.js';
export { startDevServer } from './dev-server.js';
