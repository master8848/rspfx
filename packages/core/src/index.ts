export { configDefaults, defineConfig, resolveConfig, resolvePathDefaults } from './config.js';
export type {
  BuildConfig,
  DeployConfig,
  DevConfig,
  FrameworkId,
  PathsConfig,
  PlaygroundConfig,
  RspfxConfig,
  TeamsConfig
} from './config.js';
export { SPFX_DEFAULT_TARGET, SPFX_TARGETS, SPFX_VERSIONS, isSpfxTarget, spfxNpmVersion } from './versions.js';
export type { SpfxReleaseStatus, SpfxTarget, SpfxToolchain, SpfxVersionInfo } from './versions.js';
export { RSPFX_PLUGIN_MARKER, RSPFX_PLUGIN_OPTIONS } from './marker.js';
export type { RspfxBundlerPluginLike } from './marker.js';
export { EnvironmentType, PropertyPaneFieldType } from './environment.js';
export { Version } from './version.js';
export type { ISpfxTheme, ThemeProvider, WebPartContextLike } from './context.js';
