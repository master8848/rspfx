# Migration case study: PnP Modern Search

Play-by-play of migrating [PnP Modern Search](https://github.com/microsoft-search/pnp-modern-search) (v4.23.3) from the official SPFx toolchain to RSPFX — the exercise behind `examples/modern-search` and [migrating-from-gulp-heft.md](migrating-from-gulp-heft.md).

## Why this project

One of the largest open-source SPFx solutions — ≈42k lines, 4 web parts, 178 TS files, 24 SCSS modules — and a stress test:

- React 17, Fluent UI 8, Graph Toolkit, PnPjs, Handlebars, Adaptive Cards, react-ace, dayjs, markdown-it.
- 14 locales via `config.json` `localizedResources`.
- Lazy chunks (`React.lazy` + `webpackChunkName`).
- Custom `spfx-customize-webpack.js` (handlebars min, `process/browser`, `adaptive-expressions`, moment exclusion).
- 16 Graph scopes in `webApiPermissionRequests`.
- `pkg:@fluentui/...` SCSS import (sass-loader ≥16.5 syntax).

Web parts only — no extensions or libraries — which is RSPFX's core surface (extensions/libraries are also supported now, but this case predates them).

## The migration

1. Clone upstream at `search-parts` v4.23.3 (SPFx 1.23.0, Heft rig).

2. Run migration — mechanical steps:

   - Drop 25 toolchain devDependencies (Heft, rig, webpack, loaders, eslint, polyfills).
   - Rewrite `config/config.json` entrypoints `./lib/...WebPart.js` → `./src/...WebPart.ts`; rename bundle keys to folder names.
   - Rewrite the one `pkg:` SCSS import to a relative `node_modules` path.
   - Delete rig/sass/typescript/customize-webpack configs.
   - Write `rspack.config.ts` with `RspfxPlugin` + plain `tsconfig.json`.

3. `bun install` — ~52s from warm cache.

4. `rspfx build` — handles:

   - `*.html` template imports as `asset/source` (raw string).
   - Localized strings (`SearchResultsWebPartStrings`, `CommonStrings`, …) via `localizedResources` — default locale `en-us`, including `node_modules` resources from `@pnp/spfx-controls-react`.

5. `rspfx package` — valid `.sppkg` on first try:

   - 213 entries; `AppManifest.xml` with 16 `RequestedWebApiPermission` entries.
   - 4 `WebPart_<id>.xml` elements.
   - `ClientSideAssets/` with bundles and chunks, manifests rewritten to `HTTPS://SPCLIENTSIDEASSETLIBRARY/`.

6. `rspfx dev` — workbench at `https://localhost:4321` served 4 web parts; bundles load over HTTPS with AMD `define('<id>_<version>', …)` header.

## Numbers

| Metric | Value |
|---|---|
| Source | 178 TS/TSX, 24 SCSS, ~3.0 MB, ≈42k lines |
| Toolchain devDependencies removed | 25 |
| `src/` files edited | 0 |
| Production build (cold, minified) | ~2.1 s |
| `.sppkg` size | 2.7 MiB (213 entries) |
| Clone to green build | ~1 hour (including two toolchain fixes) |

## Gaps surfaced

| Gap | Resolution |
|---|---|
| Multi-locale switching | Compiled to per-locale AMD modules (`dist/<name>_<locale>.js`) with `localizedPath` entries; `en-us` fallback, `?locale=` preview — no manual work |
| `pkg:` SCSS import | One-line rewrite (bundled sass-loader <16.5) |
| Bundle-name constraint | Bundle keys must equal web part folder names — mechanical rename in `config.json` |
| `spfx-customize-webpack.js` | All 5 aliases unnecessary under Rspack; custom behavior via `RspfxPlugin` in `rspack.config.ts` or `compilerHooks` |

## What did not need changing

- `src/webparts/**` — zero edits.
- `config/package-solution.json`, `config/serve.json`, `config/write-manifests.json` — read as-is.
- `sharepoint/` assets, `teams/` manifests — untouched.
- `@microsoft/sp-*` — kept at upstream versions; `sp-*` IDs harvested from `node_modules` (stable across 1.20–1.23).

## Comparison vs official

| Area | Official (Heft) | RSPFX |
|---|---|---|
| Full production build | Minutes | ~2 s |
| Config files | Heft rig + webpack customizer | One `rspack.config.ts` (or Vite/Rsbuild, or zero-config) |
| SCSS `pkg:` imports | Supported via sass-loader ≥16.5 | Relative path rewrite (one line) |
| Packaged artifact | Same `.sppkg` ZIP layout | Same — byte-compatible |

> **Tip:** Replay with `examples/modern-search` (migrated copy in this repo) or run the script against a fresh clone.

## Replay

```sh
git clone https://github.com/microsoft-search/pnp-modern-search.git
cd pnp-modern-search/search-parts
node <rspfx-repo>/scripts/migrate-to-rspfx.mjs .
bun install
rspfx build && rspfx package
```

Or use `examples/modern-search` directly — same source, RSPFX toolchain.

## Takeaway

For web-part-only solutions with standard `config/` layout, migration is mechanical — no `src/` edits, one SCSS line, one `config.json` rename — and build times drop an order of magnitude.

The honest limits are in [why-not-to-migrate.md](why-not-to-migrate.md).
