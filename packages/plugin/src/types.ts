import type { RspfxConfig } from '@mbsks/rspfx-core';

/**
 * The single options object every rspfx bundler plugin accepts. It IS the
 * project config: name/framework/SPFx version, the build-time `version`,
 * dev server host/port/https/tenant, build settings, paths, playground and
 * deploy. `resolveConfig` fills defaults for everything left unset.
 */
export interface RspfxPluginOptions extends Partial<Omit<RspfxConfig, 'name'>> {
  name: string;
  /** Project root; defaults to `process.cwd()`. */
  projectRoot?: string;
}
