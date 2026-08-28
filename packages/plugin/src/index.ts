export { RspfxPlugin } from './rspack.js';
export {
  rspfxInlineCss,
  rspfxViteInlineCss,
  rspfxVite7InlineCss,
  rspfxVite8InlineCss,
  rspfxRsbuildInlineCss,
  rspfxRspackInlineCss,
  spfxInlineCss,
  spfxInlineCssPlugin,
  createInlineCssPlugin,
  rspfxCssInlineRule,
  rspfxSassRule
} from './inline-css.js';
export type { RspfxInlineCssOptions } from './inline-css.js';
export { createKernel } from './kernel.js';
export type { Kernel, KernelOpts } from './kernel.js';
export { rspfxVite, VITE_ENV } from './vite.js';
export type { ViteRspfxPlugin } from './vite.js';
export { rspfxRsbuild } from './rsbuild.js';
export type { RsbuildRspfxPlugin } from './rsbuild.js';
export { rspfxResolve } from './resolve.js';
export type { RspfxPluginOptions } from './types.js';
export { defineConfig, resolveConfig, RSPFX_PLUGIN_MARKER, RSPFX_PLUGIN_OPTIONS } from '@mbsks/rspfx-core';
export type { RspfxConfig } from '@mbsks/rspfx-core';
