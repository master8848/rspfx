# Roadblocks — what blocks community takeover

Standing blockers that keep RSPFX pre-1.0 — each row names severity, owning file or env var, and mitigation; for current behavior see the linked fact home instead of duplicating it.

## Real-tenant gate

RSPFX has never completed the M1 acceptance gate from [docs/roadmap.md:21](roadmap.md#real-tenant-validation): scaffold → `rspfx package` → upload `.sppkg` to a real Microsoft 365 app catalog → install to a site → render in the workbench with no console errors — the repository holds no tenant credentials.

| Blocker | Severity | File / env var | Mitigation |
|---|---|---|---|
| M1 gate never run — packaging is verified-by-reference only (`reference/FORMATS.md`, `reference/sp-component-ids.json`) | Critical | `docs/roadmap.md:21`, `packages/sppkg-builder/tests/sppkg-builder.test.ts:1` (`zipEntries`) | Run [real-tenant validation](real-tenant-validation.md) on a developer tenant before production use; until then treat byte-equal zip checks as provisional |
| Real-tenant CI missing across SPFx 1.20/1.21/1.22/1.23 | High | `RSPFX_ACCESS_TOKEN` + `RSPFX_APP_CATALOG_URL` in `apps/cli/src/commands/deploy.ts:16`, 120s timeout in `apps/cli/src/commands/deploy.ts:62` | Implement CI calling `rspfx deploy` with a bearer token against `https://contoso.sharepoint.com/sites/appcatalog`; manual steps are in [real-tenant validation](real-tenant-validation.md) |

Until the gate passes, correctness rests on `packages/plugin/tests/parity.test.ts` and `packages/sppkg-builder/tests/sppkg-builder.test.ts:1` zip checks — see [docs/compatibility.md](compatibility.md) and [docs/architecture.md](architecture.md).

## Security hardening remaining

Build and packaging work, but dev-server and scaffolding surfaces have hardening gaps for contributor or CI exposure.

| Blocker | Severity | File / env var | Mitigation |
|---|---|---|---|
| Template XSS — `local/data.json` seed flows into mock API responses with only `sanitizeString` stripping | Medium | `packages/templates/src/index.ts:638` via `packages/dev-runtime/src/mock-api.ts:176` | Keep `local/data.json` trusted-local; do not expose preview beyond `localhost` — hardening lives in `packages/dev-runtime/src/mock-api.ts:176` (`sanitizeString`, `ALLOWED_CURRENT_USER_KEYS`, `isAllowedOrigin`) |
| CORS allowlist narrow — `Access-Control-Allow-Origin` reflects only `localhost`, `127.0.0.1`, `::1`, `*.sharepoint.com`, `*.sharepoint-df.com`, `*.sharepoint.cn`; missing header yields no CORS header | Medium | `packages/dev-runtime/src/mock-api.ts:176` (`isAllowedOrigin`, no `*` fallback) | Run local tests with `SPFX_SERVE_TENANT_DOMAIN= pnpm test` and keep `RSPFX_APP_CATALOG_URL` separate from preview |
| Self-signed cert trust is machine-wide — `~/.rspfx/certs/cert.pem` (825-day, 2048-bit) for HTTPS `:4321` | Medium | `packages/manifest-server/src/index.ts:8` (`ensureCertificates`, `selfsigned.generate`) | Dev-machine only; remove via `sudo security remove-trusted-cert ~/.rspfx/certs/cert.pem` (macOS) or `certlm.msc` (Windows); see [docs/commands.md](commands.md) |

Only `RSPFX_ACCESS_TOKEN` + `RSPFX_APP_CATALOG_URL` are implemented in `apps/cli/src/commands/deploy.ts:16` — `RSPFX_TENANT` / `RSPFX_USERNAME` / `RSPFX_PASSWORD` are not implemented; see [docs/commands.md](commands.md#rspfx-deploy).

## Compatibility and bundler limits

The SPFx matrix is centralized; bundler choice is limited by upstream APIs.

| Blocker | Severity | File / env var | Mitigation |
|---|---|---|---|
| Turbopack not possible — no webpack plugin API, no standalone CLI outside Next.js | High | `docs/roadmap.md:37` | Tracked as `❌ Not possible today`; use `RspfxPlugin` (Rspack), `rspfxVite` (Vite), or `rspfxRsbuild` (Rsbuild); see [docs/why-rspfx.md](why-rspfx.md) |
| Local preview only via Rspack — `/_api` mock and `/` page served by `dev-runtime` on Rspack path; Vite/Rsbuild dev is workbench-only | Medium | `docs/roadmap.md:18`, `packages/dev-runtime/src/mock-api.ts:176` | For `/_api` + preview use `rspack.config.ts` + `RspfxPlugin`; for Vite/Rsbuild set `SPFX_SERVE_TENANT_DOMAIN` and validate via workbench; see [docs/commands.md](commands.md#rspfx-dev) |
| Angular deferred — removed from roadmap, no AOT pipeline | High | `docs/roadmap.md:16` | Do not plan Angular web parts; `src/extensions/` and `src/webparts/` share `loaderConfig` so a future track could layer on without core changes |
| React 19 not validated — examples/templates ship React 18 on SPFx 1.22/1.23 | Medium | `docs/roadmap.md:42` | Validate React 19 + Fluent 8 peers in a branch; see [docs/compatibility.md](compatibility.md#spfx-version-matrix) |
| Version literal drift if scattered | Low | `packages/core/src/versions.ts:13` (`SPFX_VERSIONS`, `SPFX_TARGETS`) | Single source of truth; add targets via [docs/supporting-a-new-spfx-version.md](supporting-a-new-spfx-version.md); `examples/*` intentionally stay on 1.22 |

Parity for Rspack/Vite/Rsbuild is byte-verified by `packages/plugin/tests/parity.test.ts` — see [docs/compatibility.md](compatibility.md) and [docs/architecture.md](architecture.md).

## Migration and support gaps

Scope boundaries are documented in [docs/why-not-to-migrate.md](why-not-to-migrate.md).

| Gap | Severity | File / env var | Mitigation |
|---|---|---|---|
| Extension `.sppkg` path still landing — compile/discovery + local preview done (`ApplicationCustomizerContext` placeholder, `FieldCustomizerContext` sample rows, `ListViewCommandSetContext` toolbar) but deploy unverified | High | `src/extensions/` in `packages/manifest-generator`, `packages/dev-runtime` | Use extensions in local preview (`?locale=fr-fr`/`?market=`); gate production on tenant validation |
| Library components (`src/libraries/`) not supported | High | `docs/why-not-to-migrate.md` | Keep libraries on official toolchain |
| Performance measured only on M1 Pro — `examples/shadcn` cold 633 ms (`docs/performance.md:24`), no official-tool comparison | Medium | `docs/performance.md:24`, `bench/bench.mjs`, `bench/compare-official.mjs`, `BENCH_RUNS` | Run `node bench/bench.mjs examples/shadcn` and `node bench/compare-official.mjs` with `BENCH_RUNS=3`; methodology in `bench/README.md` and [docs/performance.md](performance.md) |
| No long-term support / no build-plugin ecosystem (no spfx-fast-serve, PnP build plugins, custom heft rigs); framework presets not final until M5 | Medium | `docs/why-not-to-migrate.md`, `docs/roadmap.md` | Port CI via `rspfx doctor` + `rspfx build` (~10 lines) and scope to web-parts-only on SPFx 1.20–1.23 |

Full migration procedure is in [docs/supporting-a-new-spfx-version.md](supporting-a-new-spfx-version.md) and [docs/commands.md](commands.md).

## When to adopt vs wait

Adopt now if the solution is web-parts-only on SPFx 1.20–1.23, the team owns CI, and local preview (`rspack.config.ts` + `RspfxPlugin` on `:4321` HTTP) covers dev — validate once via [real-tenant validation](real-tenant-validation.md) and pin `spfxVersion` via `packages/core/src/versions.ts:13`.

| Your project | Verdict |
|---|---|
| 1 web part, React, standard config, SharePoint Online | Adopt — `rspfx new --framework react --yes`, `rspfx doctor`, `rspfx dev --mode local`, `rspfx package` |
| 4 web parts, localization, PnP controls | Adopt — `localizedPath` modules and `?locale=` preview work; see [docs/compatibility.md](compatibility.md) |
| Extension (ApplicationCustomizer / FieldCustomizer / ListViewCommandSet) | Wait — local preview works, tenant install unverified |
| Library, Angular, 2019/on-prem, risk-averse enterprise | Wait — hard blockers in [docs/why-not-to-migrate.md](why-not-to-migrate.md) |
| Need Turbopack or Vite-only `/_api` mock | Wait — see [docs/roadmap.md:37](roadmap.md#feasibility-of-the-open-items) |

Revisit after the M1 gate passes and `bench/compare-official.mjs` is validated on your hardware — both tracked in [docs/roadmap.md](roadmap.md#real-tenant-validation).

