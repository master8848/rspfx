type BundleChunk = {
  type: string;
  code?: string;
  isEntry?: boolean;
  map?: { mappings: string } | null;
};

type BundleAsset = {
  type: string;
  source?: string | Uint8Array;
};

type Bundle = Record<string, BundleChunk | BundleAsset>;

export interface RspfxInlineCssOptions {
  /**
   * Filter which emitted CSS assets to inline.
   * Defaults to all files ending with `.css`.
   */
  filter?: (fileName: string) => boolean;
}

function toString(source: string | Uint8Array): string {
  return typeof source === 'string' ? source : Buffer.from(source).toString('utf8');
}

function inlineStyleCode(css: string): string {
  return `\n(function(){var e=document.createElement("style");e.type="text/css";e.textContent=${JSON.stringify(css)};(document.head||document.documentElement).appendChild(e);})();\n`;
}

/**
 * Rollup/Vite/Rolldown plugin that inlines emitted CSS assets into JS.
 *
 * SPFx loads only JS bundles (`[name].js` via `loaderConfig.scriptResources` `type: "path"`).
 * No external `.css` is fetched, so CSS must be injected by JS.
 * RSPFX inlines by default (`cssCodeSplit: false` / `output.injectStyles: true` / `style-loader`),
 * but when that handling fails (e.g. custom `assetFileNames`, merged Vite config, or
 * extraction enabled) this plugin guarantees inlining by collecting `.css` assets,
 * deleting them, and injecting a `<style>` into every entry chunk.
 *
 * Works for Vite 7 (Rollup) and Vite 8 (Rolldown) — both emit the same Rollup-style
 * `generateBundle` bundle, so one plugin covers both. Also works for Rspack/Rsbuild
 * when CSS extraction is enabled and `.css` assets are emitted.
 *
 * Add it as the last plugin (`enforce: 'post'`) when customization breaks default
 * inlining. See `docs/styling.md#when-default-inlining-fails`.
 */
export function rspfxInlineCss(options: RspfxInlineCssOptions = {}): {
  name: string;
  enforce: 'post';
  generateBundle(
    _options: unknown,
    bundle: Bundle
  ): void;
} {
  const filter = options.filter ?? ((k: string) => k.endsWith('.css'));
  return {
    name: 'rspfx-inline-css',
    enforce: 'post',
    generateBundle(_options: unknown, bundle: Bundle): void {
      const cssKeys = Object.keys(bundle).filter(filter);
      if (cssKeys.length === 0) {
        return;
      }
      let css = '';
      for (const k of cssKeys) {
        const asset = bundle[k] as BundleAsset;
        if (asset.type !== 'asset' || !asset.source) {
          continue;
        }
        css += toString(asset.source as string | Uint8Array) + '\n';
        delete (bundle as Record<string, unknown>)[k];
      }
      if (!css) {
        return;
      }
      const injection = inlineStyleCode(css);
      for (const chunk of Object.values(bundle)) {
        const c = chunk as BundleChunk;
        if (c.type !== 'chunk' || !c.isEntry || typeof c.code !== 'string') {
          continue;
        }
        const mapRegex = /\/\/# sourceMappingURL=.*(?:\r?\n)?$/;
        const match = c.code.match(mapRegex);
        const mapComment = match ? match[0] : '';
        let code = mapComment ? c.code.slice(0, -mapComment.length) : c.code;
        code += injection;
        c.code = code + (mapComment || '');
        if (c.map && typeof c.map.mappings === 'string' && !c.map.mappings.startsWith(';')) {
          c.map.mappings = ';' + c.map.mappings;
        }
      }
    }
  };
}

/**
 * Alias for Vite projects.
 * Import via `import { rspfxViteInlineCss } from '@mbsks/rspfx-core/inline-css.js'` or
 * `import { rspfxViteInlineCss } from '@mbsks/rspfx-plugin'`.
 */
export const rspfxViteInlineCss = rspfxInlineCss;

/**
 * Vite 7 (Rollup) alias — same implementation, separated for docs.
 */
export const rspfxVite7InlineCss = rspfxInlineCss;

/**
 * Vite 8 (Rolldown) alias — same implementation, separated for docs.
 */
export const rspfxVite8InlineCss = rspfxInlineCss;

/**
 * Rsbuild alias — Rsbuild uses Rspack under the hood; when CSS extraction is
 * enabled (custom `output.injectStyles: false` or `CssExtractRspackPlugin`),
 * use this fallback to inline the emitted `.css` back into JS.
 */
export const rspfxRsbuildInlineCss = rspfxInlineCss;

/**
 * Rspack alias — typically `style-loader` via `rspfxCssInlineRule` is preferred;
 * use this fallback only when that chain is bypassed and `.css` assets are emitted.
 */
export const rspfxRspackInlineCss = rspfxInlineCss;

// Legacy / alternative names
export const spfxInlineCss = rspfxInlineCss;
export const spfxInlineCssPlugin = rspfxInlineCss;
export const createInlineCssPlugin = rspfxInlineCss;
