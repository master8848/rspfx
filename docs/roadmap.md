# Roadmap

See [roadblocks.md](roadblocks.md) for adoption blockers and [real-tenant-validation.md](real-tenant-validation.md) for the tenant gate.

## Current state

| Area | State |
|---|---|
| Reference capture + AMD wrapper | Ground truth committed (`reference/FORMATS.md`, `reference/sp-component-ids.json`), byte-compatible `define('<id>_<version>', …)` |
| Foundation + packaging | `core` (zero deps), `diagnostics`, `plugin-api`, `manifest-generator`, `sppkg-builder`, `sharepoint-runtime`; plugin hooks wired into CLI |
| Compiler + CLI | `compiler-rspack` (SWC, SCSS, assets, dev server) + `RSpfxPlugin` / `rspfxVite` / `rspfxRsbuild`; `new`/`dev`/`build`/`package`/`deploy`/`doctor`/`analyze`/`clean`; templates + frameworks + examples |
| Dev mode | `:4321` HTTPS manifest server (`/temp/manifests.js`), workbench URL, auto-reload (`/__rspfx_hot.json`) |
| Fast refresh + local preview | Refresh runtime (`--refresh`), react/preact/vue/svelte/solid preserved; local preview at `http://localhost:4321/` + mock `/_api` (Rspack path; Vite/Rsbuild is workbench-only) |
| Frameworks + Fluent | vanilla/react/solid/preact/vue/svelte + `fluent-adapter` |
| Bundler parity | Vite and Rsbuild ship same capture line + AMD header + CSS inlining + `stats.json`, verified by `parity.test.ts`; Turbopack not possible (no plugin API) |
| Real-tenant validation | Web part + extension + library `.sppkg` installed and rendered — see [real-tenant-validation.md](real-tenant-validation.md) |

## Real-tenant validation

Tenant gate: scaffold → `rspfx package` → upload `.sppkg` to real app catalog → install → render in workbench with no console errors. Packaging correctness rests on byte-level assertions against `reference/FORMATS.md` + the gate.

Real-tenant CI matrix is planned across SPFx 1.20–1.24 (needs tenant credentials in CI secrets; env vars see [commands.md#environment-variables](commands.md#environment-variables)).

## Backlog

| Status | Item | Notes |
|---|---|---|
| ✅ Done | SPFx output format locked in | Reference build output captured so SharePoint loads the bundle correctly (see `reference/FORMATS.md`). |
| ✅ Done | Core build and packaging | Manifests and `.sppkg` generation working. Plugin hooks wired into the CLI. |
| ✅ Done | Compilers and CLI | Rspack, Vite, and Rsbuild all produce the same output. Commands `new`, `dev`, `build`, `package`, `deploy`, `doctor`, `analyze`, and `clean` work. |
| ✅ Done | Dev server | Local manifest server, workbench URL, and auto-reload. |
| ✅ Done | Fast refresh and local preview | Edits keep component state for React, Preact, Vue, Svelte, and Solid. Local preview with mock API on Rspack; Vite/Rsbuild uses workbench. |
| ✅ Done | Frameworks and Fluent UI | Vanilla, React, Solid, Preact, Vue, and Svelte supported with Fluent adapter. |
| ✅ Done | Bundler parity | Same output across Rspack, Vite, and Rsbuild verified by tests. |
| ✅ Done | Tested on a real tenant | Web part, extension, and library installed from the app catalog and rendered. |
| ❌ Not planned | Turbopack | No plugin API and no standalone CLI — can't be supported. |
| 💡 Future | React 19 + Fluent 8 | Need to check latest React with Fluent before we promise full support. |
| 💡 Future | Speed comparison with official toolchain | Test harness exists, needs results on more machines. |
| 💡 Future | Automated tenant checks in CI | Needs a Microsoft 365 test tenant and credentials. |

## Testing

| Layer | How |
|---|---|
| Unit | vitest, colocated |
| Integration | `src` → `dist` → `.sppkg` → manifest/zip validation vs `reference/FORMATS.md` |
| Parity | Same fixture via Rspack/Vite/Rsbuild — byte-equal manifests, headers, no `.css` |
| Tenant | Real catalog install across SPFx targets (manual; CI planned) |
| Benchmarks | `bench/bench.mjs` + `bench/compare-official.mjs` |
