# Roadmap

Milestones from [ARCHITECTURE.md](../../ARCHITECTURE.md). The M1 gate (real-tenant
install) remains the acceptance test for everything packaging-related.

| Milestone | Scope | Status |
|---|---|---|
| **M0** | Reference capture + AMD spike | ✅ **Done** — fixture ground truth committed: `reference/FORMATS.md` (harvested from `@microsoft/*` 1.23.2 packages), `reference/sp-component-ids.json`; Rspack AMD bundle wrapper confirmed byte-compatible with the official `define('<id>_<version>', [...])` form |
| **M1** | Foundation + packaging core (vanilla) | ✅ **Done** — `core` (zero deps), `diagnostics`, `plugin-api`, `manifest-generator` (component manifests, manifests.js, sp-* discovery), `sppkg-builder` (AppManifest/features/ClientSideAssets ZIP) implemented; `sharepoint-runtime` stubs added. Plugin hooks (`compilerHooks.beforeCompile`/`afterStats`, `packageHooks.beforePackage`) are wired into the CLI build/package flow |
| **M2** | Compiler + build/package CLI + React/Solid | 🔄 **In progress** — `compiler-rspack` implemented (swc TS/JSX, SCSS/CSS-modules, assets, dev server, watch) and now exposes the `spfx()` rspack plugin surface; user-configurable folder layout via `paths` landed; CLI (`apps/cli`), templates, and framework packages are being built |
| **M3** | Dev mode | 🔄 **In progress** — `manifest-server` (dev certs in `~/.rspfx/certs` only; serving is handled by the compiler dev server) and `dev-runtime` serve emulation are partially implemented |
| **M4** | Fast refresh + playground | 🔄 **In progress** — refresh runtime in `dev-runtime` is now a stateful machine wired into serve (preserve/restore/dispose, epoch counter, gated on `--refresh`); missing HMR plugin packages resolve to loud stubs with an honest fallback to full reload; playground app is stubbed; per-framework runtimes to follow |
| **M5** | Framework breadth + Fluent | ⏳ Planned — Preact/Vue/Svelte web part classes + refresh; `fluent-adapter` (`FluentWebPart`, theme sync) |
| **M6** | Angular (deferred) | ⏸️ **Deferred** — Angular needs a separate AOT compiler track (`ngc`/`ng-packagr`); explicitly out of scope until M1–M4 are proven. Not a blocker |
| **M7** | Benchmarks, full test suite, docs | ⏳ Planned — cold start <2s, rebuild <300ms, refresh <150ms, small build <4s, large <15s; unit (vitest) + fixture-driven packaging tests + real-tenant CI on 1.20/1.21/1.22/1.23; examples and migration guide |

## Extensions roadmap

`ApplicationCustomizer` and `ListViewCommandSet` (application extensions) are
**out of scope** for M1–M4. The manifest generator and loaderConfig machinery are
designed so extensions can be added later without rework (same script-resource
machinery; component type fields already preserved).

## Testing

- Unit: vitest, colocated in packages.
- Integration: fixture `src` → `dist` → `solution.sppkg` → manifest/zip validation
  against captured reference artifacts (`tests/fixtures/`, `tests/stubs/`).
- Packaging: zip layout diffs against the captured `.sppkg`.
- Compatibility: real-tenant CI across SPFx 1.20/1.21/1.22/1.23 (needs a dev tenant
  for the M1 gate).
- Benchmarks: scripted (`pnpm bench`), results in `.rspfx/benchmarks.jsonl`.

## Current phase note

M0 and M1 are complete. M2–M4 are in progress (compiler and dev-runtime cores
landed; plugin-api hooks wired into the CLI; project config now lives in the
bundler config as the `RspfxPlugin` / `rspfxVite` plugin, replacing
`rspfx.config.ts`; CLI, templates, framework packages,
refresh runtimes, and the playground are being filled in). Framework packages
are currently scaffolded as stubs — treat the web part class / preset API as not
yet final until M5.
