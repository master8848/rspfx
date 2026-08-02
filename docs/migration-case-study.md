# Migration case study: PnP Modern Search

This is the play-by-play of migrating
[PnP Modern Search](https://github.com/microsoft-search/pnp-modern-search)
(search web parts, v4.23.3) from the official SPFx toolchain to RSPFX — the
same exercise that produced `examples/modern-search` and the
[migrating-from-gulp-heft.md](migrating-from-gulp-heft.md) guide.

## Why this project

PnP Modern Search is one of the largest, most actively used open-source SPFx
solutions (≈42k lines of TypeScript/SCSS, 4 web parts, 178 TypeScript files, 24 SCSS modules).
It is also a brutal stress test:

- React 17 + Fluent UI 8 + Microsoft Graph Toolkit + PnPjs + HandleBars
  templates + Adaptive Cards + react-ace (Code Editor) + dayjs + markdown-it
- localized resources in 14 locales (`localizedResources` in `config.json`)
- lazy-loaded chunks (`React.lazy` + `webpackChunkName`)
- a custom `spfx-customize-webpack.js` (handlebars min build, `process/browser`,
  `adaptive-expressions` main entry, moment exclusion)
- `webApiPermissionRequests` (16 Microsoft Graph scopes) in the solution
- a `pkg:@fluentui/...` SCSS import (sass-loader ≥16.5 syntax)

Crucially, it is **web parts only** — no extensions, no library components —
which is exactly RSPFX's supported surface.

## The migration (as executed)

1. Clone upstream at `search-parts` v4.23.3 (SPFx 1.23.0, Heft rig
   `@microsoft/spfx-web-build-rig`).
2. Run `node scripts/migrate-to-rspfx.mjs <dir>` — the mechanical steps:
   - drop 25 toolchain devDependencies (`@rushstack/heft`, `spfx-heft-plugins`,
     `spfx-web-build-rig`, webpack, loaders, eslint, node polyfills, …)
   - rewrite `config/config.json` entrypoints `./lib/...WebPart.js` →
     `./src/...WebPart.ts`; rename bundle keys to the web part folder names
     (`modern-search-results-web-part` → `searchResults`, …)
   - rewrite the one `pkg:` SCSS import to a relative `node_modules` path
   - delete rig/sass/typescript/customize-webpack config files
   - write `rspack.config.ts` (with the `RspfxPlugin`) + a plain `tsconfig.json`
3. `pnpm install` — 52s from warm cache.
4. `rspfx build` — **first run failed** on the two gaps below, fixed in
   toolchain, rebuilt, **second run succeeded**:
   - `*.html` template imports (`import template from './results/...html'`)
     — official webpack used `html-loader`; RSPFX now handles HTML natively via
     the Rspack `asset/source` rule (raw-string module, same semantics).
   - bare localized string modules (`import * as strings from
     'SearchResultsWebPartStrings'` / `'CommonStrings'` / `'ControlStrings'` /
     `'PropertyControlStrings'`) — official webpack resolved these via
     `localizedResources` aliases; RSPFX now maps `config.json`
     `localizedResources` to the default-locale source file automatically
     (including `node_modules`-based resources from `@pnp/spfx-controls-react`).
5. `rspfx package` — first try produced a valid `.sppkg`:
   - 213 zip entries; `AppManifest.xml` (name, version, `SkipFeatureDeployment`,
     `DeveloperProperties`, **16 `RequestedWebApiPermission` entries**);
   - 4 `WebPart_<id>.xml` elements under the solution feature;
   - `ClientSideAssets/` with all bundles + chunks, every manifest rewritten to
     `HTTPS://SPCLIENTSIDEASSETLIBRARY/`.
6. `rspfx dev` — workbench debug manifests on `:4321` served the 4 web parts;
   bundles load over HTTPS with the AMD `define('<id>_4.23.3', [...])` header.

## Numbers

| Metric | Value |
|---|---|
| Source | 178 TS/TSX files, 24 SCSS, 3.0 MB, ≈42k lines |
| Toolchain devDependencies removed | 25 |
| Files edited in `src/` by the migration | 0 |
| Full production build (`rspfx build`, cold, minified) | **≈2.1 s** |
| `.sppkg` size | 2.7 MiB (213 entries) |
| Time from clone to green build | ~1 hour (including two toolchain fixes + tests) |

## Gaps the exercise surfaced

These are the honest limits (tracked in [why-not-to-migrate.md](why-not-to-migrate.md)):

1. **Multi-locale runtime switching.** String modules resolve to `en-us` and are
   bundled. RSPFX does not yet emit `localizedPath` manifest entries from
   `config.json` `localizedResources`, so sp-loader won't swap locale modules —
   the migrated solution renders default-locale strings.
2. **`pkg:` SCSS imports** need a one-line rewrite (bundled sass-loader <16.5).
3. **Bundle-name constraint.** Bundle keys must equal web part folder names
   (RSPFX's `entryModuleId` convention) — a mechanical rename in `config.json`.
4. **No `spfx-customize-webpack.js` equivalent — but an escape hatch now.**
   All five aliases in the upstream file turned out to be unnecessary under
   Rspack. For genuinely custom behavior, the project config lives in
   `rspack.config.ts` as the `RspfxPlugin` from `@mbsks/rspfx-plugin` — the
   Rspack config is yours to extend (extra loaders, plugins, rule merges) —
   and `plugin-api` hooks (`beforeCompile`/`afterStats`/`beforePackage`) are
   wired into the CLI.

## What did NOT need changing

- `src/webparts/**` — zero edits
- `config/package-solution.json` — read as-is (including Graph permission
  requests)
- `config/serve.json`, `config/write-manifests.json` — read as-is
- `sharepoint/` assets, `teams/` manifests — untouched
- `@microsoft/sp-*` dependencies — kept at upstream versions; sp-* manifests
  harvested from `node_modules` (component IDs stable across 1.20–1.23)

## Replay it

```sh
git clone https://github.com/microsoft-search/pnp-modern-search.git
cd pnp-modern-search/search-parts
node <rspfx-repo>/scripts/migrate-to-rspfx.mjs .
pnpm install
rspfx build && rspfx package
```

Or use the migrated copy directly: `examples/modern-search` (workspace example,
same source, RSPFX toolchain, full attribution in its README).
