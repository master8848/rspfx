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

Real-tenant CI is planned across SPFx targets (needs tenant credentials in CI secrets; env vars see [commands.md#rspfx-deploy](commands.md#rspfx-deploy)).

## Open items

| Item | Verdict |
|---|---|
| Turbopack | Not possible — no webpack plugin API, no standalone CLI outside Next.js |
| React 19 | Feasible, small effort — bump examples/templates, validate Fluent 8 peers |
| Official-toolchain benchmarks | Feasible — harness ships as `bench/compare-official.mjs`; classic numbers on this machine are seconds vs RSPFX milliseconds |
| Real-tenant CI | External dependency — needs Microsoft 365 developer tenant credentials |

## Backlog

React 19 validation with Fluent before promoting "any React version" from demo to guarantee.

## Testing

| Layer | How |
|---|---|
| Unit | vitest, colocated |
| Integration | `src` → `dist` → `.sppkg` → manifest/zip validation vs `reference/FORMATS.md` |
| Parity | Same fixture via Rspack/Vite/Rsbuild — byte-equal manifests, headers, no `.css` |
| Tenant | Real catalog install across SPFx targets (manual; CI planned) |
| Benchmarks | `bench/bench.mjs` + `bench/compare-official.mjs` |
