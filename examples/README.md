# Examples

Scaffolded RSPFx projects demonstrating each supported framework and bundler.

Each example is generated via `rspfx new` with deterministic placeholder GUIDs. GUIDs are **shared across framework variants** to keep package-solution IDs stable for docs and tests — e.g. `react` and `vite-react` both use component ID `11111111-1111-4111-8111-111111111101`, solution ID `22222222-2222-4222-8222-222222222201`, feature ID `33333333-3333-4333-8333-333333333301` (`packages/templates/src/index.ts`, `packages/templates/src/manifests.ts`). Likewise `vanilla`/`vite-vanilla` share `…1106/…2206/…3306`, and `shadcn`/`solid` share `…1102/…2202/…3302`; `rsbuild-solid` (`@mbsks/rspfx-example-rsbuild-solid`, component `11111111-1111-4111-8111-111111111108`) uses distinct IDs from `solid` and is the first Rsbuild + Solid example. Do not install two variants with overlapping IDs on the same tenant; regenerate IDs with `crypto.randomUUID()` for production use (`docs/project-structure.md`).

`modern-search` is the production-scale example — PnP Modern Search v4.23.3 migrated to RSPFx (see `examples/modern-search/README.md` and `docs/migration-case-study.md`). Its 4 web part manifests use real PnP GUIDs (`544c1372-…`) and `teams/` contains one icon pair per manifest; all 8 PNGs are regenerated and match manifest IDs.

Run `rspfx doctor` in any example directory to verify environment; `rspfx build` and `rspfx package` produce the same `dist/`/`sharepoint/solution/*.sppkg` layout as official SPFx.
