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
 * the preview bootstrap satisfies with a no-op stand-in (`MSINTERNAL_PROXY`).
 * Production and workbench builds externalize the whole sp-* layer, so these
 * prefixes never reach resolution there.
 */
export const PLATFORM_ONLY_PREFIXES: readonly string[] = [
  '@msinternal',
  '@azure/msal-browser-1p',
  '@azure/msal-browser-legacy-1p'
];

export function isPlatformOnlyModule(request: string): boolean {
  return PLATFORM_ONLY_PREFIXES.some((prefix) => request === prefix || request.startsWith(prefix + '/'));
}
