import { rspack, type Compiler } from '@rspack/core';
import { createRequire } from 'node:module';
import type { BundleEntry } from './types.js';

export const SPFX_PUBLIC_PATH_SENTINEL = '__RSPFX_SPFX_PUBLIC_PATH__';

interface SpfxPublicPathOptions {
  entries: BundleEntry[];
}

/**
 * SECURITY: `window.__rspfx_script_url_*` and `window.__RSPFX_COMPONENTS__`
 * (see `dev-runtime/src/local-page.ts`) are XSS-sensitive — an injected script
 * that overwrites the chunk base URL (`publicPath`) or component list before
 * the bundle factory runs can redirect chunk loads to an attacker host or inject
 * components. In production the bundles are hosted on CDNs with CSP, but in
 * local preview the page is dev-only and we mitigate by capturing
 * `document.currentScript.src` synchronously at bundle top-level (while the
 * script tag is still executing) and attempting to freeze the global with
 * `Object.defineProperty(..., { writable:false, configurable:false })`.
 * Overwrite is still possible if an attacker runs *before* the capture line,
 * so dependencies should be vetted and CSP applied where possible.
 */
function captureLine(entryName: string): string {
  const globalKey = scriptUrlGlobalKey(entryName);
  // First statement captures the script URL; second attempts to freeze the
  // global so later scripts cannot silently overwrite the chunk base. The
  // try/catch keeps the bundle loadable if freezing is denied (e.g. already
  // defined). Header prefix is intentionally stable — tests assert
  // `startsWith('(function(){window["__rspfx_script_url_<name>"]=')`.
  return (
    `(function(){window[${JSON.stringify(globalKey)}]=` +
    `typeof document!=="undefined"&&document.currentScript?document.currentScript.src:"";` +
    `try{Object.defineProperty(window,${JSON.stringify(globalKey)},{value:window[${JSON.stringify(globalKey)}],writable:false,configurable:false});}catch{}})();\n`
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
 * The script-URL capture line prepended to every AMD bundle, before the
 * `define(...)` call. Bundler-agnostic — reused by the Vite plugin so its
 * bundles start with the exact same bytes as the Rspack path.
 */
export function scriptUrlCaptureLine(entryName: string): string {
  return captureLine(entryName);
}

/**
 * The expression replacing `SPFX_PUBLIC_PATH_SENTINEL`, resolving chunk/asset
 * URLs against the captured script URL. Bundler-agnostic.
 */
export function scriptUrlPublicPathExpression(entryName: string): string {
  return publicPathExpression(entryName);
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
class SpfxPublicPathPluginJs {
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
            const original = asset.source;
            const src = original.source().toString();
            const hasSentinel = src.includes(SPFX_PUBLIC_PATH_SENTINEL);
            const capture = captureLine(entry.name);
            if (!hasSentinel) {
              // Preserve original sourcemap by concatenating via ConcatSource (offsets map by 1 line for capture)
              const ConcatSource = (rspack.sources as unknown as { ConcatSource?: new (...args: unknown[]) => unknown }).ConcatSource;
              if (ConcatSource) {
                compilation.updateAsset(
                  assetName,
                  new ConcatSource(capture, original) as unknown as typeof original
                );
              } else {
                compilation.updateAsset(
                  assetName,
                  new rspack.sources.RawSource(capture + src)
                );
              }
              continue;
            }
            const quote = src.includes(`"${SPFX_PUBLIC_PATH_SENTINEL}"`) ? '"' : "'";
            const sentinelQuoted = quote + SPFX_PUBLIC_PATH_SENTINEL + quote;
            const replacement = publicPathExpression(entry.name);
            // Try ReplaceSource to preserve sourcemap while replacing sentinel (column offset is acceptable, lines unchanged)
            const ReplaceSource = (rspack.sources as unknown as { ReplaceSource?: new (src: unknown) => { replace(a: number, b: number, c: string): void } })
              .ReplaceSource;
            const ConcatSource = (rspack.sources as unknown as { ConcatSource?: new (...args: unknown[]) => unknown }).ConcatSource;
            if (ReplaceSource && ConcatSource) {
              try {
                const replaceSource = new ReplaceSource(original);
                let idx = 0;
                while ((idx = src.indexOf(sentinelQuoted, idx)) !== -1) {
                  replaceSource.replace(idx, idx + sentinelQuoted.length - 1, replacement);
                  idx += replacement.length;
                }
                compilation.updateAsset(
                  assetName,
                  new ConcatSource(capture, replaceSource) as unknown as typeof original
                );
                continue;
              } catch {}
            }
            // Fallback: string replacement with ConcatSource+SourceMapSource if map available
            const rewrittenWithoutCapture = src.split(sentinelQuoted).join(replacement);
            const mapFn = (original as unknown as { map?: (opts?: unknown) => unknown }).map;
            let map: unknown = null;
            try {
              map = typeof mapFn === 'function' ? mapFn.call(original, { columns: true }) ?? mapFn.call(original) : null;
            } catch {
              map = null;
            }
            if (map && ConcatSource) {
              const SourceMapSource = (rspack.sources as unknown as { SourceMapSource?: new (...args: unknown[]) => unknown }).SourceMapSource;
              if (SourceMapSource) {
                try {
                  compilation.updateAsset(
                    assetName,
                    new ConcatSource(
                      capture,
                      new SourceMapSource(rewrittenWithoutCapture, assetName, map as string, src, map as string, true)
                    ) as unknown as typeof original
                  );
                  continue;
                } catch {}
              }
            }
            if (ConcatSource) {
              compilation.updateAsset(
                assetName,
                new ConcatSource(capture, new rspack.sources.RawSource(rewrittenWithoutCapture)) as unknown as typeof original
              );
            } else {
              compilation.updateAsset(assetName, new rspack.sources.RawSource(capture + rewrittenWithoutCapture));
            }
          }
        }
      );
    });
  }
}

let RustPlugin: typeof SpfxPublicPathPluginJs | undefined;
try {
  const req = createRequire(import.meta.url);
  const mod = req('../../crates/rspfx-rspack-plugin/index.node');
  if (mod?.SpfxPublicPathPlugin) RustPlugin = mod.SpfxPublicPathPlugin;
} catch {}

export const SpfxPublicPathPlugin: typeof SpfxPublicPathPluginJs = RustPlugin ?? SpfxPublicPathPluginJs;
