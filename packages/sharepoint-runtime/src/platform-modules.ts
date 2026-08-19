/**
 * Module prefixes that only exist inside Microsoft's tenant runtime and are
 * never published to npm (or are first-party builds thereof):
 *
 * - `@msinternal/*` — telemetry, feature flags, safe-html, page chrome…
 *   sp-loader provides them on real tenants.
 * - `@azure/msal-browser-1p` / `@azure/msal-browser-legacy-1p` — first-party
 *   MSAL builds used by sp-http-base's token provider.
 *
 * The local dev preview bundles `@microsoft/sp-*` directly (no externals), so
 * any module under these prefixes is externalized as an AMD dependency that
 * the preview bootstrap satisfies with a no-op stand-in (`MSINTERNAL_PROXY`;
 * `@msinternal/safe-html` uses the sanitizer-aware `SAFE_HTML_PROXY`).
 * Production and workbench builds externalize the whole sp-* layer, so these
 * prefixes never reach resolution there.
 *
 * DRIFT RISK: This list MUST stay in sync with the duplicate copy in
 * `packages/compiler-rspack/src/config.ts:27` (same `PLATFORM_ONLY_PREFIXES`
 * and `isPlatformOnlyModule` exact-prefix check). If they drift, a module
 * externalized at build time will have no bootstrap stub at runtime (or vice
 * versa). The check is intentionally `request === prefix || request.startsWith(prefix + '/')`
 * to avoid over-matching `@msinternalfoo` or `@azure/msal-browser` (the
 * public `msal-browser` package is on npm and must NOT be externalized —
 * only the `-1p`/`-legacy-1p` first-party builds are platform-only).
 * `reference/sp-component-ids.json` does not list these prefixes — completeness
 * is verified against the compiler's copy, not that table.
 */
export const PLATFORM_ONLY_PREFIXES: readonly string[] = [
  '@msinternal',
  '@azure/msal-browser-1p',
  '@azure/msal-browser-legacy-1p'
];

export function isPlatformOnlyModule(request: string): boolean {
  return PLATFORM_ONLY_PREFIXES.some((prefix) => request === prefix || request.startsWith(prefix + '/'));
}
