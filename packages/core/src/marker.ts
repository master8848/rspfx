import type { RspfxConfig } from './config.js';

/**
 * Symbol stamped on every rspfx bundler plugin instance (the Rspack/Webpack
 * class and the Vite plugin object). The CLI scans a user's bundler config
 * (rspack.config.ts / vite.config.ts) `plugins` array for this marker and
 * reads the project config via `RSPFX_PLUGIN_OPTIONS`.
 *
 * `Symbol.for` keeps the marker stable across duplicated package copies.
 */
export const RSPFX_PLUGIN_MARKER: unique symbol = Symbol.for(
  '@mbsks/rspfx/bundler-plugin'
) as any;

/**
 * Symbol key carrying the resolved project config on every rspfx bundler
 * plugin instance. It must NOT be a plain string key: `options` is a reserved
 * hook name in Rollup/Vite, and bundlers iterate plugin keys looking for
 * hooks — symbol keys are ignored by every bundler.
 */
export const RSPFX_PLUGIN_OPTIONS: unique symbol = Symbol.for('@mbsks/rspfx/options') as any;

/**
 * Structural type shared by every rspfx bundler plugin instance. The plugin
 * carries the resolved project config under `RSPFX_PLUGIN_OPTIONS`; the
 * marker symbol is stamped at runtime (see `RSPFX_PLUGIN_MARKER`).
 */
export interface RspfxBundlerPluginLike {
  readonly [RSPFX_PLUGIN_OPTIONS]: RspfxConfig;
  [key: symbol]: unknown;
}
