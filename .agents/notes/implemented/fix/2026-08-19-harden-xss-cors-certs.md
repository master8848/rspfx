# Agent Note: Harden XSS, CORS, certs and packaging

Status: implemented

## Context

Audit `2026-08-19-security-audit-spfx-spa` flagged stored XSS in scaffolded templates (`packages/templates/src/index.ts:638` `event.fieldValue` via `innerHTML` and vanilla `props.description` unescaped), CORS wildcard on `/_api` and `__rspfx_hot.json` (`packages/dev-runtime/src/mock-api.ts:176`, `reload.ts:21`), `decodeURIComponent` crash (`compiler-rspack/src/dev-server.ts:78`), MSINTERNAL safe-html proxy (`sharepoint-runtime/src/local-bootstrap.ts:78`), cert SAN `~/.rspfx/certs` (`manifest-server/src/index.ts:8`), and zip traversal (`sppkg-builder/src/sppkg-builder.ts:516`).

## Decision

Fix `packages/templates/src/index.ts:638` to `textContent` with `String(event.fieldValue)` and add `escapeHtml` helper to vanilla component (`packages/templates/src/index.ts:793`) wrapping `props.description`; framework components (`solid`/`preact`/`vue`/`svelte`) keep JSX `{{ }}` auto-escape. Harden `mock-api.ts:79,245` with `isAllowedOrigin` allowlist (`localhost`/`127.0.0.1`/`::1`/`*.sharepoint.com`/`*.sharepoint-df.com`/`*.sharepoint.cn`) and `Vary: Origin`, require `X-RequestDigest` for `X-HTTP-Method` overrides, sanitize `local/data.json` seed (`sanitizeString`, `ALLOWED_CURRENT_USER_KEYS`). Guard `dev-server.ts:71` with `safeDecodeURIComponent` + 4-iteration double-decode check + dot-segment `../` rejection and `path.resolve` guard. Validate custom hostname (`manifest-server/src/index.ts:35` `validateCustomHostname` rejects `..`, `[^a-z0-9.-]`, sharepoint domains) and add `::1` SAN with `X509Certificate` expiry check and `0o600`/`0o644` perms. Freeze `__RSPFX_COMPONENTS__`/`__rspfx_script_url_*` (`local-page.ts:120`, `public-path.ts:11`) and document hijack risk. Harden `sppkg-builder/src/sppkg-builder.ts:479,516`, `lcid.ts:60`, `xml.ts:269`, `compiler-rspack/src/config.ts:126`, `plugin/src/vite.ts:253`/`rsbuild.ts:329`, `scripts/publish.mjs:31` guard `CI` + OTP via env.

## Consequences

Scaffolded `FieldCustomizer` no longer executes `<img onerror>` etc.; vanilla web part `description` is escaped. Local `/_api` and hot poll no longer `*` — only allowed origins. Dev server survives malformed `%ZZ`. Cert `~/.rspfx/certs` regenerates on hostname mismatch and rejects `evil&` injection. Zip `toZipPath` rejects `../`. Tests `SPFX_SERVE_TENANT_DOMAIN= pnpm test` 391/391 now pass with new `mock-api`/`reload` allowlist tests. Remaining: Vite/Rsbuild local preview still workbench-only.
