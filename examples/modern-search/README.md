# @mbsks/rspfx-example-modern-search

**PnP Modern Search v4.23.3 — a real, large production SPFx solution migrated
from Heft + webpack + gulp to RSPFx.**

This is the search web parts solution from
[microsoft-search/pnp-modern-search](https://github.com/microsoft-search/pnp-modern-search)
(≈178 TypeScript files, 24 SCSS modules, 4 web parts), with the official
toolchain replaced by RSPFx. **No web part code was changed.** The migration is
purely build-tooling: the same `src/`, `config/`, and `sharepoint/` files build,
package, and serve through RSPFx instead of `heft start` / `heft package-solution`.

## What it proves

- A **large, real-world, actively maintained** SPFx solution (React 17, Fluent UI 8,
  Microsoft Graph Toolkit, PnPjs, Handlebars, Adaptive Cards, react-ace, dayjs,
  localized resources in 14 locales) compiles and packages with RSPFx unchanged.
- Full pipeline: `rspfx dev` (workbench, `:4321` debug manifests),
  `rspfx build` (~2s for all 4 web parts + lazy chunks), `rspfx package`
  (`.sppkg` with all 16 Microsoft Graph `webApiPermissionRequests`).
- The **only** source change required: none. The one-line `pkg:` SCSS import was
  rewritten to a relative path by the migration script (sass-loader `<16.5`
  doesn't understand the `pkg:` URL scheme).

## What was migrated

| Official SPFx | RSPFx |
|---|---|
| `heft start --clean` (rig: `@microsoft/spfx-web-build-rig`) | `rspfx dev` |
| `heft test --clean --production && heft package-solution --production` | `rspfx package` |
| `@microsoft/spfx-heft-plugins`, `@rushstack/heft`, webpack, babel-loader, css-loader, html-loader, eslint (25 devDependencies) | `@mbsks/rspfx-cli` + `@mbsks/rspfx-core` |
| `config/rig.json`, `config/typescript.json`, `config/sass.json`, `config/spfx-customize-webpack.js` | deleted (RSPFx owns the compiler config) |
| `config/config.json` entrypoints `./lib/webparts/.../WebPart.js` (Heft output) | `./src/webparts/.../WebPart.ts` (source) |
| `localizedResources` resolved via webpack aliases | resolved natively from `config.json` (default locale `en-us`) |

Run `node ../../scripts/migrate-to-rspfx.mjs` against any SPFx project to apply
the same mechanical steps — see [docs/migrating-from-gulp-heft.md](../../docs/migrating-from-gulp-heft.md).

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Dev server + SharePoint workbench (port 4321) |
| `pnpm build` | Production build (dist + release) |
| `pnpm package` | Build + package into `solution/pnp-modern-search-parts-v4.sppkg` |
| `pnpm analyze` | Build + bundle report |
| `pnpm doctor` | Environment checks |
| `pnpm clean` | Remove build output |

```sh
pnpm install
pnpm dev        # then open the printed workbench URL (or your tenant's /_layouts/15/workbench.aspx)
pnpm package    # upload solution/pnp-modern-search-parts-v4.sppkg to the app catalog
```

## Known differences after migration

- **Single-locale strings.** String modules (`SearchResultsWebPartStrings`,
  `ControlStrings`, …) resolve to the default locale (`en-us`) and are bundled;
  RSPFx does not yet emit `localizedPath` manifest entries from
  `config.json` `localizedResources`, so the runtime does not switch locales.
- **Bundle names.** RSPFx requires the bundle name to equal the web part folder
  name, so `modern-search-results-web-part` → `searchResults` (etc.).
- **`webpackJsonp_<hash>` chunk runtime.** Present by design — this is the
  official SPFx `chunkLoadingGlobal` convention for lazy chunks.
- No `spfx-customize-webpack.js` — RSPFx owns the compiler config; aliases used
  by the old webpack file (handlebars, process, adaptive-expressions) were not
  needed because Rspack resolves those packages from their own entries.

## Attribution

Source: [microsoft-search/pnp-modern-search](https://github.com/microsoft-search/pnp-modern-search),
Copyright (c) Microsoft Corporation, MIT License — see [LICENSE](./LICENSE).
This example tracks upstream `search-parts` v4.23.3 and is provided to
demonstrate RSPFx migration; it is not an official Microsoft product.
