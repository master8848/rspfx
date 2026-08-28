export {
  rspfxInlineCss,
  rspfxViteInlineCss,
  rspfxVite7InlineCss,
  rspfxVite8InlineCss,
  rspfxRsbuildInlineCss,
  rspfxRspackInlineCss,
  spfxInlineCss,
  spfxInlineCssPlugin,
  createInlineCssPlugin
} from '@mbsks/rspfx-core/inline-css.js';
export type { RspfxInlineCssOptions } from '@mbsks/rspfx-core/inline-css.js';

// Re-export Rspack CSS helpers for convenience — single import surface for fallbacks
export { rspfxCssInlineRule, rspfxSassRule } from '@mbsks/rspfx-compiler-rspack/helpers/css.js';
