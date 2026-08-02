import { rspack, type Compiler } from '@rspack/core';
import type { BundleEntry } from './types.js';

export const SPFX_PUBLIC_PATH_SENTINEL = '__RSPFX_SPFX_PUBLIC_PATH__';

interface SpfxPublicPathOptions {
  entries: BundleEntry[];
}

function captureLine(entryName: string): string {
  const globalKey = scriptUrlGlobalKey(entryName);
  return (
    `(function(){window[${JSON.stringify(globalKey)}]=` +
    `typeof document!=="undefined"&&document.currentScript?document.currentScript.src:"";})();\n`
  );
}

function scriptUrlGlobalKey(entryName: string): string {
  return `__rspfx_script_url_${entryName}`;
}

function publicPathExpression(entryName: string): string {
  const globalKey = scriptUrlGlobalKey(entryName);
  return `(typeof window!=="undefined"&&window[${JSON.stringify(globalKey)}]||"").replace(/\\/[^/]*$/,"/")`;
}

/**
 * Mirrors the official SPFx toolchain's publicPath handling: capture
 * `document.currentScript` at bundle top-level (before the AMD `define` call,
 * while the script tag is still executing) and use it to resolve chunk URLs.
 *
 * Rspack's `output.publicPath: 'auto'` cannot be used: the AMD factory (which
 * contains the runtime) executes asynchronously inside sp-loader's module
 * loader, where `document.currentScript` is null and the fallback scan for the
 * last script tag on the page resolves chunk URLs against an unrelated script
 * (e.g. Microsoft's own CDN-hosted workbench scripts), producing 404s.
 *
 * The emitted bundle gets:
 *   1. a prepended line that captures the script URL into a per-entry global
 *   2. the `__RSPFX_SPFX_PUBLIC_PATH__` sentinel (used as `output.publicPath`)
 *      replaced with an expression that reads that global at factory time
 */
export class SpfxPublicPathPlugin {
  private readonly entries: BundleEntry[];

  constructor(opts: SpfxPublicPathOptions) {
    this.entries = opts.entries;
  }

  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap('SpfxPublicPathPlugin', (compilation) => {
      const stage =
        (rspack.Compilation as { PROCESS_ASSETS_STAGE_REPORT?: number }).PROCESS_ASSETS_STAGE_REPORT ?? 5000;
      compilation.hooks.processAssets.tap(
        { name: 'SpfxPublicPathPlugin', stage },
        () => {
          for (const entry of this.entries) {
            const assetName = `${entry.name}.js`;
            const asset = compilation.getAsset(assetName);
            if (!asset) {
              continue;
            }
            const src = asset.source.source().toString();
            if (!src.includes(SPFX_PUBLIC_PATH_SENTINEL)) {
              continue;
            }
            const quote = src.includes(`"${SPFX_PUBLIC_PATH_SENTINEL}"`) ? '"' : "'";
            const rewritten =
              captureLine(entry.name) +
              src.split(quote + SPFX_PUBLIC_PATH_SENTINEL + quote).join(publicPathExpression(entry.name));
            compilation.updateAsset(assetName, new rspack.sources.RawSource(rewritten));
          }
        }
      );
    });
  }
}
