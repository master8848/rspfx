# Building and packaging

What each command produces — build outputs (`dist/`, `release/`) on this page, catalog upload and CDN on [deployment.md](deployment.md). See Microsoft docs: [Package and deploy SPFx solutions](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/package-and-deploy) and [Host SPFx from Office 365 CDN](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/hosting-spfx-from-office-365-cdn).

For daily flow see [getting-started.md](getting-started.md); for ZIP layout see [reference/FORMATS.md](../reference/FORMATS.md).

## Commands

| Command | Output | Notes |
|---|---|---|
| `rspfx build` | `dist/` + `release/manifests/*.manifest.json` + `release/assets/*` | `--no-minify`, `--sourcemap`; bundler config optional |
| `rspfx package` | `sharepoint/solution/<name>.sppkg` | Runs `build` first; `--no-build` to skip |
| `rspfx analyze` | Console table + `.rspfx/analyze.html` | Module counts via bundler or `.rspfx/stats.json` |
| `rspfx clean` | Removes `dist/`, `release/`, `.rspfx`, etc. | — |
| `rspfx doctor` | Checks env, config, ports, certs | Exit 1 on fail — use in CI |

All commands read `config/*` and `src/*/*.manifest.json`.

With a bundler config (`vite.config.ts`, `rsbuild.config.ts`, or `rspack.config.ts`) it is loaded via `jiti`; without it the CLI synthesizes config from manifests and runs Vite, Rsbuild, or Rspack directly.

See [migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx](migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx).

> **Tip:** No manual `@microsoft/sp-*` install for most web parts — externalized, SharePoint resolves built-in copies.

> **Tip:** `bun run build` (or `pnpm` / `npm` / `yarn` `run build`) and `rspfx build` are the same codepath — use either.

## Project layout

Default is the official SPFx layout.

Customize via `paths` in plugin options:

| Option | Default | Controls |
|---|---|---|
| `paths.webpartsDir` | `src/webparts` | Web part discovery |
| `paths.configDir` | `config` | `config.json` + `serve.json` |
| `paths.srcDir` | `src` | `localizedResources` rewriting |

Bundle name = web part folder name by default — that name becomes `loaderConfig.entryModuleId`.

No bundler config needed — zero-config synthesis handles standard layouts.

## What `rspfx build` does

1. Reads project — bundles, externals, `localizedResources` from `config.json`; scans `src/webparts/*` when `bundles` is absent.

2. Loads framework preset — JSX/TS transform, resolve, plugins.

3. Compiles (Vite by default, Rsbuild or Rspack if configured) — one AMD bundle per web part (`define('<id>_<version>', …)`), chunks, SCSS, assets; `@microsoft/sp-*` never bundled; CSS inlined, no `.css` in `.sppkg` — see [styling.md](styling.md).

4. Writes manifests to `release/manifests/` — `version` from `package.json`, `entryModuleId` = bundle name, `scriptResources` per external, `internalModuleBaseUrls` from `cdnBasePath`.

5. Copies assets to `release/assets/`.

`rspfx build` alone does not create a `.sppkg` — that is `rspfx package`.

> **Tip:** `rspfx build --no-minify --sourcemap` for debuggable staging builds; CI should use default minified output.

## What `rspfx package` does

Creates a DEFLATE zip at `config/package-solution.json` `paths.zippedPackage` (default `sharepoint/solution/<name>.sppkg`).

Content is driven by that file:

- `includeClientSideAssets: true` — bundles embedded under `ClientSideAssets/`, manifests rewritten to `HTTPS://SPCLIENTSIDEASSETLIBRARY/` — see [Host SPFx from Office 365 CDN](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/hosting-spfx-from-office-365-cdn).
- `includeClientSideAssets: false` or `cdnBasePath` in `write-manifests.json` — external CDN URL in manifests; upload `release/assets/*` there.
- `webApiPermissionRequests` → `RequestedWebApiPermission` in `AppManifest.xml`.
- Extensions → `Extension_<id>.xml` with `Location`; libraries → `Library_<id>.xml`.
- Auto-detects `teams/` (icons → `ClientSideAssets/teams/`) and `sharepoint/Resources*.resx`.

Full ZIP entry list and ordering: [reference/FORMATS.md](../reference/FORMATS.md#4-sppkg-zip-layout-jszip-deflate-level-9).

Deployment steps (catalog, CDN, permissions, Teams): [deployment.md](deployment.md).

`rspfx deploy` automates upload with a token; without it prints manual steps.

## Comparison vs official

| Area | Official | RSPFX |
|---|---|---|
| Build output | `dist/` + `temp/` (Heft) | `dist/` + `release/manifests/` + `release/assets/` |
| Bundle format | AMD `define('<id>_<version>', …)` | Same — byte-compatible (see [compatibility.md](compatibility.md)) |
| CSS | Extracted or inlined per rig | Inlined — no `.css` files in `.sppkg` |
| Manifests | `release/` via `write-manifests` | Same semantics, `cdnBasePath` ↔ `SPCLIENTSIDEASSETLIBRARY` |
| Package | `gulp package-solution` | `rspfx package` — same ZIP layout |

## CI

```yaml
- run: bun install --frozen-lockfile   # or pnpm install --frozen-lockfile / npm ci / yarn --frozen-lockfile
- run: rspfx doctor
- run: rspfx package
- upload: sharepoint/solution/*.sppkg
```

- `RSPFX_LOG_LEVEL` for verbose logs — see [commands.md#environment-variables](commands.md#environment-variables).
- Cache `node_modules` + `.rspack-cache` (dev only; prod ignores persistent cache).

## Size and speed

Defaults: `minify: true`, `splitChunks: false`, `sourcemap: false`.

`splitChunks: false` is correct for SPFx — one AMD bundle per web part.

`true` saves duplicate code via `chunk.*.js` but adds a request.

Example: PnP Modern Search (4 web parts, 178 files, Fluent UI) → ~2 s on a laptop.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `UNRESOLVED_EXTERNAL` | Remove that `externals` key or add the package |
| `sp-*` code in bundle | Remove `resolve` alias that collides with `sp-*` |
| `Can't resolve 'XxxWebPartStrings'` | `localizedResources` missing or not `lib/.../{locale}.js` shaped |
| `@import 'pkg:...'` fails | Rewritten by `rspfx migrate` for sass-loader <16.5 |
| `.html` import fails | Rebuild CLI — `asset/source` handles it |
| Bundle 404 in workbench (`https://localhost:4321/dist/...`) | Bundle name must match `entryModuleId` — default: folder name — see [project-structure.md](project-structure.md) |
| Package goes to `solution/` | `paths.zippedPackage` is authoritative |
