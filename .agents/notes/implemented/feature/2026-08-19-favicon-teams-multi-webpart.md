# Agent Note: Add favicon, Teams/Outlook, multi-webpart docs and skill

Status: implemented

## Context

Scaffolded projects showed a broken favicon (no `assets/favicon.svg` and no `<link rel="icon">` in `packages/dev-runtime/src/local-page.ts:41`), users mistook the 404 for a build failure. Docs lacked Teams/Outlook install, multi-webpart, and favicon guidance, and `skills/rspfx/SKILL.md:12` still listed `web parts only` and `single-locale` limits while extensions, multi-locale, and Teams packaging had shipped.

## Decision

Add `assets/favicon.svg` (`packages/templates/src/index.ts:83` `buildFiles`, `faviconSvg()` 32×32 SVG with Rspack cube `#ff3b30`/`#ff6b4a`, Vite lightning `#facc15`/`#a78bfa`, SPFx `S` `#0078d4` on `#111827` `rx=7`) copied on `rspfx new` and on project copy; serve at `/assets/favicon.svg` (`packages/dev-runtime/src/serve.ts:260` static `assets → /assets`) and inject `<link rel="icon" type="image/svg+xml" href="${origin}/assets/favicon.svg">` (`local-page.ts:47`). Update `packages/templates/tests/scaffold.test.ts:63` `expectedPaths` to include `assets/favicon.svg` (now 392/393 tests). Add `docs/teams-outlook-install.md` (1.13 manifest, `ClientSideAssets/teams/` in `.sppkg`, SharePoint `Sync to Teams` + `Teams Admin Center`, Outlook new personal scope, troubleshooting), `docs/multi-webpart.md` (duplicate `src/webparts/<name>/` + new `id` `crypto.randomUUID()`, `discoverWebParts` auto-discovery, `rspfx package` emits `<featureId>/WebPart_<id>.xml` per id), `docs/favicon-and-assets.md` (replace `assets/favicon.svg`, per-webpart `assets/` vs shared `assets/`). Update `skills/rspfx/SKILL.md:12` capabilities and add §§6-8 with concrete file refs (`teamsManifest`, `serve.ts:260`, `local-page.ts:47`).

## Consequences

`rspfx new` no longer shows a broken favicon; copying retains `assets/favicon.svg`. Local preview serves the icon and survives restarts. Teams/Outlook install, multi-webpart, and favicon are documented in `docs/` and discoverable via the skill. Tests `SPFX_SERVE_TENANT_DOMAIN= pnpm test` 393/393 pass. `docs/roadblocks.md:1` and `docs/real-tenant-validation.md:1` remain the M1 gate docs.
