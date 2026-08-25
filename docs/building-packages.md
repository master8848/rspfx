# Building, packaging & deploying

What each command produces and how to use it in CI. For daily flow see [getting-started.md](getting-started.md).

## Commands

| Command | Output | Notes |
|---|---|---|
| `rspfx build` | `dist/` + `release/manifests/*.manifest.json` + `release/assets/*` | `--no-minify`, `--sourcemap`; bundler config optional |
| `rspfx package` | `sharepoint/solution/<name>.sppkg` | Runs `build` first; `--no-build` to skip |
| `rspfx deploy` | Uploads `.sppkg` to app catalog | see [commands.md#rspfx-deploy](commands.md#rspfx-deploy) |
| `rspfx analyze` | Console table + `.rspfx/analyze.html` | Counts from bundler or `.rspfx/stats.json` |
| `rspfx clean` | Removes `dist/`, `release/`, `.rspfx`, etc. | — |
| `rspfx doctor` | Checks env/config/ports | Exit 1 on fail, good for CI |

All commands read `config/*` and `src/*/*.manifest.json`. With a bundler config (`vite.config.ts`, `rsbuild.config.ts`, or `rspack.config.ts`) it is loaded via `jiti`. Without it the CLI builds the same config from your manifests and runs Vite or Rspack directly (see [migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx](migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx)). Flags override file options.

> No manual `@microsoft/sp-*` install for most web parts. Keep it only if you import that runtime.

## Same manifest

`config/config.json`, `config/package-solution.json`, `src/*/*.manifest.json` work for both Heft/Gulp and RSPFX. Revert with `rspfx migrate --revert` or `git restore`.

## Project layout

Default is the official SPFx layout. Customize via `paths` in plugin options:

| Option | Default | What it controls |
|---|---|---|
| `paths.webpartsDir` | `src/webparts` | Web part discovery + manifest scan |
| `paths.configDir` | `config` | `config.json` + `serve.json` |
| `paths.srcDir` | `src` | `localizedResources` rewriting |

```ts
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxVite({ name: 'my-app', paths: { webpartsDir: 'src/webparts' } })] };
```

Bundle name = web part folder name by default. That name is `loaderConfig.entryModuleId`.

No bundler config needed — `bun run build` / `rspfx build` synthesize it.

## What `rspfx build` does

1. **Reads project** — bundles, externals, localizedResources from `config.json`. Without bundles, scans `src/webparts/*`.
2. **Loads framework preset** — JSX/TS transform, resolve, plugins.
3. **Compiles** (Vite by default, Rsbuild or Rspack if configured) — one AMD bundle per web part (`define('<id>_<version>', …)`), chunks, SCSS, assets. `@microsoft/sp-*` is never bundled. CSS is inlined — no `.css` in the `.sppkg` (see [styling.md](styling.md)).
4. **Writes manifests** to `release/manifests/` — `version`, `entryModuleId` = bundle name, `scriptResources` per external.
5. **Copies assets** to `release/assets/`.

`rspfx build` alone doesn't make a `.sppkg` — that's `rspfx package`.

## What `rspfx package` makes

A zip (see [reference/FORMATS.md](../reference/FORMATS.md)):

```
[Content_Types].xml
_rels/.rels → AppManifest.xml
AppManifest.xml (+ _rels/AppManifest.xml.rels)
feature_<id>.xml + .config.xml + _rels/feature_<id>.xml.rels
<featureId>/<type>_<id>.xml
Resources.resx (if sharepoint/Resources*.resx exists)
ClientSideAssets.xml + ClientSideAssets/ (if bundling assets)
```

From `config/package-solution.json`:

- `paths.zippedPackage` — output path, default `sharepoint/solution/<name>.sppkg`.
- `includeClientSideAssets: true` — bundles inside package, manifests rewritten to `HTTPS://SPCLIENTSIDEASSETLIBRARY/`.
- `includeClientSideAssets: false` / `cdnBasePath` in `write-manifests.json` — CDN URL, only metadata in package.
- `webApiPermissionRequests` → `RequestedWebApiPermission` in `AppManifest.xml`.
- Extension → `Extension_<id>.xml` with `Location` + per-build instance. Library → `Library_<id>.xml` with single-quoted manifest.

Also auto-detects `teams/` (icons → `ClientSideAssets/`) and `sharepoint/Resources*.resx` (`CultureName="default"` + per-lang, resolves `$Resources:Key` in metadata).

## Install

1. `rspfx package`
2. Upload `.sppkg` to app catalog.
3. Deploy (or `skipFeatureDeployment: true`).
4. Add to a site.

Full catalog/CDN/permissions/Teams steps: [deployment.md](deployment.md). `rspfx deploy` automates upload with a token; without it prints manual steps.

## CI

```yaml
- run: bun install --frozen-lockfile
- run: rspfx doctor
- run: rspfx package
- upload: sharepoint/solution/*.sppkg
```

- `rspfx build --no-minify --sourcemap` for staging.
- `RSPFX_LOG_LEVEL` for logs (see [commands.md#environment-variables](commands.md#environment-variables)).
- Cache `node_modules` + `.rspack-cache` (dev only; prod doesn't use it).

## Size and speed

`build.minify` (true), `build.splitChunks` (false), `build.sourcemap` (false).

`splitChunks: false` is correct for SPFx — one AMD bundle per web part. `true` makes `chunk.*.js` that saves duplicate code but needs an extra request.

Example: PnP Modern Search (4 web parts, ~178 files, Fluent UI) builds in ~2s on a laptop.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `UNRESOLVED_EXTERNAL` | Remove that `externals` key or add the package. |
| sp-* code in bundle | You added a `resolve` alias that collides — remove it. |
| `Can't resolve 'XxxWebPartStrings'` | `config.json` `localizedResources` missing or not `lib/.../{locale}.js`. |
| `@import 'pkg:...'` fails | `rspfx migrate` rewrites it for `sass-loader` <16.5. |
| `.html` import fails | Rebuild CLI — `asset/source` handles it. |
| Bundle 404 in workbench | Bundle name must match emitted `.js` and `entryModuleId` (default: folder name). |
| Package goes to `solution/` | `paths.zippedPackage` is authoritative — official behavior. |
