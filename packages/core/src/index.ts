export { configDefaults, defineConfig, resolveConfig, resolvePathDefaults, tryResolveConfig } from './config.js';
export type {
  BuildConfig,
  DeployConfig,
  DevConfig,
  FrameworkId,
  FrameworkIdCore,
  Issue,
  PathsConfig,
  Result,
  RspfxConfig,
  TeamsConfig
} from './config.js';
export type { ComponentId, CultureName, Lcid, PlatformPrefix, ZipPath } from './newtypes.js';
export {
  LCID_TO_CULTURE,
  Locale,
  localeToCultureName,
  parseComponentId,
  parseZipPath,
  unsafeComponentId,
  unsafeZipPath
} from './newtypes.js';
export { SPFX_DEFAULT_TARGET, SPFX_TARGETS, SPFX_VERSIONS, isSpfxTarget, spfxNpmVersion } from './versions.js';
export type { SpfxReleaseStatus, SpfxTarget, SpfxToolchain, SpfxVersionInfo } from './versions.js';
export { RSPFX_PLUGIN_MARKER, RSPFX_PLUGIN_OPTIONS } from './marker.js';
export type { RspfxBundlerPluginLike } from './marker.js';
export { PLATFORM_ONLY_PREFIXES, isPlatformOnlyModule } from './platform.js';
export { isAllowedOrigin } from './cors.js';
export { solidPng } from './png.js';
export { canResolveFromProject, clearCanResolveCache } from './package-resolve.js';
export { EnvironmentType, PropertyPaneFieldType } from './environment.js';
export { Version } from './version.js';
export type { ISpfxTheme, ThemeProvider, WebPartContextLike } from './context.js';
