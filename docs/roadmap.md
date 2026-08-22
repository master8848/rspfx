# Roadmap

See [Roadblocks](roadblocks.md) for what blocks community takeover and [Real-tenant validation](real-tenant-validation.md) for the step-by-step tenant gate.

Milestones from [ARCHITECTURE.md](../ARCHITECTURE.md).

Real-tenant validation (install a generated `.sppkg` into a real Microsoft 365 app catalog and render it) remains the acceptance test for everything packaging-related — see [Real-tenant validation](#real-tenant-validation) below.

| Milestone | Scope | Status |
|---|---|---|
| M0 | Reference capture + AMD spike | Done — fixture ground truth committed: `reference/FORMATS.md` (harvested from `@microsoft/*` 1.23.2 packages), `reference/sp-component-ids.json`; Rspack AMD bundle wrapper confirmed byte-compatible with the official `define('<id>_<version>', [...])` form |
| M1 | Foundation + packaging core (vanilla) | Done — `core` (zero deps), `diagnostics`, `plugin-api`, `manifest-generator` (component manifests, manifests.js, sp-* discovery), `sppkg-builder` (AppManifest/features/ClientSideAssets ZIP) implemented; `sharepoint-runtime` stubs added. Plugin hooks (`compilerHooks.beforeCompile`/`afterStats`, `packageHooks.beforePackage`) are wired into the CLI build/package flow. Tenant gate passed 2026-08-22 (web part + extension + library install) — see [real-tenant-validation.md](real-tenant-validation.md) |
| M2 | Compiler + build/package CLI | Done — `compiler-rspack` (swc TS/JSX, SCSS/CSS-modules, assets, dev server, watch) + `spfx()` rspack plugin surface; multi-bundler support: `RspfxPlugin` (rspack), `rspfxVite` (vite.config.ts), `rspfxRsbuild` (rsbuild.config.ts); user-configurable folder layout via `paths`; CLI commands `new`/`dev`/`build`/`package`/`deploy`/`doctor`/`analyze`/`clean`; templates + all framework packages shipped; examples for every framework |
| M3 | Dev mode | Done — `:4321` HTTPS manifest server (certs from `manifest-server`), debug manifests at `/temp/manifests.js`, workbench URL + auto-open (opt-in), auto-reload; `dev-runtime` serve emulation |
| M4 | Fast refresh + local preview | Done — stateful refresh runtime in `dev-runtime` wired into serve (preserve/restore/dispose, epoch counter, gated on `--refresh`); react/preact/vue/svelte HMR wired (missing plugin packages fall back to loud stubs + full reload); `rspfx dev` serves a local preview page at `/` with a mock SharePoint REST API — no tenant needed (the old `rspfx playground` command was removed). Solid refresh shipped in M9; vanilla keeps full reload |
| M5 | Framework breadth + Fluent | Done — vanilla/react/solid/preact/vue/svelte web part classes + presets (`@mbsks/rspfx-framework-*`), `fluent-adapter` (`FluentWebPart`, theme sync) |
| M6 | Angular | Removed — not supported; no roadmap slot. The web part classes are a self-contained preset layer, so a future Angular track (separate AOT pipeline) could be layered back on without core changes |
| M7 | Benchmarks, full test suite, docs | In progress — RSPFX-only numbers measured (`bench/bench.mjs` + `docs/performance.md`, 2026-08-01: cold start 633 ms, recompile 68 ms median, full build 315 ms on `examples/shadcn`); official-toolchain comparison harness ships (`bench/compare-official.mjs` — Heft / `gulp bundle` / `gulp serve` / `gulp fast-serve`); docs shipped (migration guide, case study, why/why-not, frameworks, fast refresh, compatibility, internal API). Remaining: validate the official harness on real machines, add the SPFx official matrix, real-tenant validation |
| M8 | Bundler parity — major feature | Done — (b) Vite deep parity shipped: framework presets gained `vite()` (vite plugins/esbuild) and `rsbuild()` (webpack-shaped rules/plugins) contributions; `rspfxVite` prepends the same script-URL capture line as the Rspack path (byte-compat header), rewrites the publicPath sentinel, inlines CSS into the JS bundle (no `.css` files), writes `.rspfx/stats.json` module counts for `rspfx analyze`, and auto-reloads after rebuilds (`?t=` cache-busting); `rspfxRsbuild` merges the same preset surface into `modifyRspackConfig` (no swc — Rsbuild owns SWC) with fast refresh gated on dev, and writes the same stats. Fast refresh on both paths is enabled by `rspfx dev --refresh` / `dev.fastRefresh` (`RSPFX_FAST_REFRESH=1`). (c) Parity test suite (`packages/plugin/tests/parity.test.ts`) builds the same fixture through rspack/vite/rsbuild and asserts identical manifest bytes, release asset name sets, capture-line + AMD define header per bundler, no `.css` files, and stats.json for vite/rsbuild. (a) Turbopack remains not possible — no webpack plugin API; parked (see feasibility table). Local preview (`/` + mock `/_api`) stays Rspack-only |
| M9 | Fast refresh for all frameworks (vanilla excluded — full reload is acceptable there) | Done — Solid wired in the `@mbsks/rspfx-framework-solid` preset: `solid-refresh/babel` with `bundler: 'rspack-esm'` (`import.meta.webpackHot`) + dev-mode `babel-preset-solid`, gated on `--refresh`/`dev.fastRefresh` like the others. Missing-package fallback matches the react/preact pattern but is conditional: the `solid-refresh` runtime is imported by transformed modules in the browser bundle, so the stub alias only applies when the package can't be resolved from the project (no-op helpers, loud warning, full reload). Covered by `framework-solid/tests/build.test.ts` + `compiler-rspack/tests/stubs.test.ts`. Exit criterion met: `rspfx dev --refresh` preserves state for react/preact/vue/svelte/solid; vanilla keeps full reload by design |

## Real-tenant validation

- The M1 gate (from ARCHITECTURE.md): scaffold a project → `rspfx package` → upload the `.sppkg` to a real SharePoint app catalog (a Microsoft 365 developer tenant) → install → the web part renders in the workbench with no console errors — **passed 2026-08-22** for web parts, extensions (`ApplicationCustomizer`, `FieldCustomizer`, `ListViewCommandSet`, `FormCustomizer`), and libraries (`componentType: Library`). See [real-tenant-validation.md](real-tenant-validation.md) for the step-by-step gate and validation checklist.
- Real-tenant CI: run the same flow automated across SPFx targets (see [docs/compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix) and `packages/core/src/versions.ts:13`) (needs tenant credentials in CI secrets; deploy env vars see [docs/commands.md#rspfx-deploy](commands.md#rspfx-deploy) and [docs/real-tenant-validation.md#tenant-credential-setup](real-tenant-validation.md#tenant-credential-setup)).
- Packaging correctness rests on byte-level assertions against the captured reference artifacts (`reference/FORMATS.md`, `reference/sp-component-ids.json`) plus the tenant gate.

## Feasibility of the open items

| Item | Verdict | Why |
|---|---|---|
| **Turbopack as a bundler** | ❌ **Not possible today** | Vercel's docs state Turbopack **does not support webpack plugins**, and standalone Turbopack outside Next.js is still in development (no public CLI, no plugin API). The `RspfxPlugin` "webpack-compatible interface" is an Rspack-compatible interface; Turbopack will never run it. The claim in `docs/why-rspfx.md` / `skills/rspfx/SKILL.md` is aspirational and being corrected. Track Vercel's standalone-Turbopack releases; revisit only when a plugin API ships |
| **Vite deep parity** | ✅ **Done** | Shipped in M8: preset `vite()`/`rsbuild()` contributions, `RSPFX_FAST_REFRESH` gating, byte-compat capture line + AMD header verified by the parity suite (`packages/plugin/tests/parity.test.ts`), CSS inlined, `.rspfx/stats.json` module counts for `rspfx analyze`, auto-reload after rebuilds. Rsbuild received the same treatment (framework presets, fast refresh, analyze stats) |
| **Solid fast refresh** | ✅ Feasible, medium effort | `solid-refresh` (babel plugin) + a solid HMR client; pattern mirrors the existing react/preact stub-with-fallback |
| **Extensions** (`ApplicationCustomizer`, `FieldCustomizer`, `ListViewCommandSet`, `FormCustomizer`) | ✅ Verified | `rspfx new --component applicationcustomizer|fieldcustomizer|listviewcommandset|formcustomizer` ships manifest templates (`client-side-extension-manifest.schema.json`, `requiresCustomScript: false`) + `src/extensions/` TypeScript entries + per-type sp-* deps. Compile/discovery of extension bundles plus **local dev preview runtime** (real `ApplicationCustomizerContext` placeholder provider, `FieldCustomizerContext` sample rows via `onRenderCell`, `ListViewCommandSetContext` toolbar via `onListViewUpdated`/`onExecute`, sp-loader lifecycle `_init` → `onInit` → render) plus **sppkg + tenant install** verified. Multi-locale `?locale=`/`?market=` switching. |
| **React 19 validation** | ✅ Feasible, small effort | Bump `examples/react` + templates to React 19, run web part + Fluent tests; risk is Fluent 8 peer ranges, not RSPFX itself |
| **Official-toolchain benchmarks** (Heft / gulp / gulp fast-serve) | ⚠️ Feasible with caveats | Harness ships as `bench/compare-official.mjs`. Caveats: (1) fast-serve predates Heft — it only runs on the gulp+webpack line, so it benchmarks the SPFx 1.22 skeleton while Heft is measured via `gulp bundle` on the 1.23 skeleton; (2) first run installs the official toolchain (minutes); (3) needs Node in the supported range (SPFx 1.23 wants Node 20.19+/22+; Node 24 may warn) |
| **Real-tenant validation** | ⚠️ External dependency, not difficulty | Needs a Microsoft 365 developer tenant + app-catalog credentials; nothing in the repo blocks it. See [Real-tenant validation](#real-tenant-validation) and the tutorial in [real-tenant-validation.md](real-tenant-validation.md) |

## Backlog (claimed but not yet real)

- **React 19 / non-SPFx-pinned React** — examples and templates currently ship
  React 18 (SPFx 1.22/1.23 line). The claim "any React version" needs validation
  with React 19 + Fluent before it's promoted from a demo statement to a
  supported guarantee.

## Testing

- Unit: vitest, colocated in packages.
- Integration: fixture `src` → `dist` → `solution.sppkg` → manifest/zip validation
  against captured reference artifacts (`tests/fixtures/`, `tests/stubs/`).
- Packaging: zip layout diffs against the captured `.sppkg`.
- Bundler parity: `packages/plugin/tests/parity.test.ts` builds the same fixture
  through rspack/vite/rsbuild and asserts byte-equal manifests/release structure,
  capture-line + AMD header per bundler, no `.css` files, and stats.json (M8).
- Compatibility: real-tenant validation across SPFx targets (see [docs/compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix) and `packages/core/src/versions.ts:13`) (needs a dev tenant — still open).
- Benchmarks: RSPFX harness (`node bench/bench.mjs`), official-toolchain
  comparison harness (`node bench/compare-official.mjs` — Heft / gulp / gulp
  fast-serve).

## Current phase note

M0–M5, M8 and M9 are complete. Real-tenant gate passed for web parts, extensions, and libraries; remaining work: official-toolchain benchmark validation plus React 19 and Turbopack (parked until Vercel ships a standalone plugin API). The framework web part class / preset APIs reached their final shape in M5 — no longer stubs.
