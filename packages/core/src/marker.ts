import type { RspfxConfig } from './config.js';

/**
 * Symbol stamped on every rspfx bundler plugin instance (the Rspack/Webpack
 * class and the Vite plugin object). The CLI scans a user's bundler config
 * (rspack.config.ts / vite.config.ts) `plugins` array for this marker and
 * reads the `options` it carries — the single source of project config.
 *
 * `Symbol.for` keeps the marker stable across duplicated package copies.
 */
export const RSPFX_PLUGIN_MARKER: symbol = Symbol.for('@mbsks/rspfx/bundler-plugin');

/**
 * Structural type shared by every rspfx bundler plugin instance. The plugin
 * carries the resolved project config in `options`; the marker symbol is
 * stamped at runtime (see `RSPFX_PLUGIN_MARKER`).
 */
export interface RspfxBundlerPluginLike {
  options: RspfxConfig;
  [key: symbol]: unknown;
}
