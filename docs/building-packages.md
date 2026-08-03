# Building, packaging & deploying

This is the build pipeline reference: what each command produces, what the
artifacts are, and how to wire it into CI. For the day-to-day flow see
[getting-started.md](getting-started.md); for moving an existing project see
[migrating-from-gulp-heft.md](migrating-from-gulp-heft.md).

## Command overview

| Command | Produces | Notes |
|---|---|---|
| `rspfx build` | `dist/` bundles + `release/manifests/*.manifest.json` + `release/assets/*` | Production compile; `--no-minify`, `--sourcemap` flags |
| `rspfx package` | `<paths.zippedPackage>` (default `sharepoint/solution/<name>.sppkg`) | Implies `build`; `--no-build` to skip |
| `rspfx deploy` | Uploads the `.sppkg` to the app catalog | Bearer-token upload (`RSPFX_ACCESS_TOKEN`); prints manual steps without a token |
| `rspfx analyze` | Bundle size report as console table + `.rspfx/analyze.html` | Implies `build`; module counts fall back to `.rspfx/stats.json` on Vite/Rsbuild |
| `rspfx clean` | Removes `dist/`, `release/`, `temp/`, `.rspfx/`, `node_modules/.cache` | — |
| `rspfx doctor` | Environment/config checks, exit code 1 on failure | CI-friendly preflight |

All commands load the project's bundler config — `rspack.config.ts|js`,
`vite.config.ts|js`, or `rsbuild.config.ts|js` — find the `RspfxPlugin` /
`rspfxVite` / `rspfxRsbuild` plugin by its marker symbol, and use its options,
merging CLI flags over them (`build.minify`/`build.sourcemap`, `dev.port`, etc.).

## Project layout

RSPFX assumes the official SPFx folder layout by default, but every part of it
is configurable via the `paths` section of the plugin options:

| Option | Default | Used for |
|---|---|---|
| `paths.srcDir` | `src` | Rewriting `localizedResources` `lib/...` patterns to source files |
| `paths.webpartsDir` | `src/webparts` | Fallback web part auto-discovery (`config.json` has no `bundles`) and the component manifest scan |
| `paths.configDir` | `config` | Reading `config.json` and `serve.json` |

```ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';

export default {
  mode: 'development',
  plugins: [
    new RspfxPlugin({
      name: 'my-app',
      paths: {
        srcDir: 'src',
        webpartsDir: 'src/webparts',
        configDir: 'config'
      }
    })
  ]
};
```

With the default layout, a web part folder `src/webparts/hello/` maps to a
bundle named `hello`. With `config.json` bundles (or a custom `paths.webpartsDir`),
the **bundle name** is authoritative: `loaderConfig.entryModuleId` is derived
from the bundle entry name rather than the folder name.

## What `rspfx build` does

1. **Reads the project** (`<paths.configDir>/config.json`): bundle entrypoints,
   externals, `localizedResources`. Entrypoints in the official Heft convention
   (`./lib/...WebPart.js`) are migrated to source (`./src/...WebPart.ts`) by
   `scripts/migrate-to-rspfx.mjs`; without `config.json` bundles, web parts are
   auto-discovered from `<paths.webpartsDir>/*` (default `src/webparts/*`).
2. **Loads the framework preset** (`@mbsks/rspfx-framework-<id>`): swc JSX/TS
   transform, define flags, resolve contributions — the same compiler config
   dev mode uses.
3. **Compiles with Rspack**: one AMD bundle per web part
   (`define('<componentId>_<version>', ["@microsoft/sp-core-library", ...], ...)`),
   lazy `import()` → `chunk.<name>.js`, SCSS/CSS modules, HTML imports
   (`asset/source`), assets. sp-* packages are **never bundled** — every
   `@microsoft/sp-*` package found in `node_modules` plus every `externals` key
   in `config.json` is externalized and referenced from the manifest.
4. **Generates component manifests** into `release/manifests/`:
   - `version: "*"` in the source manifest → package.json version
   - `loaderConfig.entryModuleId` = the bundle entry name (the web part folder
     name in the default layout; the `config.json` bundle name otherwise)
   - `scriptResources`: the bundle (`"type": "path"`) + one
     `"type": "component"` entry per external (sp-* IDs/versions harvested from
     `node_modules` manifests, with `reference/sp-component-ids.json` as
     fallback)
   - `localizedResources` string modules resolve to the default locale
     (`en-us`) at compile time and are bundled
5. **Copies assets** to `release/assets/` for packaging.

`rspfx build` alone does **not** produce an installable package — it produces
the pieces (`dist` + `release`) that `rspfx package` assembles.

## What `rspfx package` produces

The `.sppkg` is a DEFLATE zip with the official layout
(see [reference/FORMATS.md](../../reference/FORMATS.md)):

```
[Content_Types].xml
_rels/.rels
AppManifest.xml            solution metadata, WebApiPermissionRequests, version
AppManifest.xml.rels
feature_<id>.xml           one feature per package-solution.json feature
feature_<id>.xml.config.xml
<featureId>/WebPart_<componentId>.xml   component manifest (JSON) per web part
ClientSideAssets.xml       present when includeClientSideAssets = true
ClientSideAssets/          bundles, chunks, and rewritten manifests
```

Key semantics, all read from `config/package-solution.json`:

- `paths.zippedPackage` — output path (default convention
  `sharepoint/solution/<name>.sppkg`)
- `includeClientSideAssets: true` — bundles land in the package and every
  manifest's `internalModuleBaseUrls` is rewritten to the
  `HTTPS://SPCLIENTSIDEASSETLIBRARY/` pseudo-URL that SharePoint resolves at
  install time
- `includeClientSideAssets: false` (or a `cdnBasePath` in
  `config/write-manifests.json`) — manifests keep the CDN base URL and only
  metadata ships in the package; upload the `release/assets/*` files to your CDN
- `webApiPermissionRequests` — emitted as `RequestedWebApiPermission` entries in
  `AppManifest.xml` (the admin consent dialog shows them after install)
- `skipFeatureDeployment`, `isDomainIsolated`, `developer`, `metadata` — passed
  through to `AppManifest.xml`

`rspfx package` runs the same zip validation the tests use (`validateSppkg`) and
reports entry count on success.

## Installing

1. `rspfx package`
2. Upload the `.sppkg` to the **app catalog** (*SharePoint Admin Center → App
   Catalog → Apps for SharePoint*).
3. Click *Deploy* (or set `skipFeatureDeployment: true` to auto-deploy).
4. On any site: *Add an app* → your solution → *Add*.

## Deploying from CLI

`rspfx deploy` automates the upload with a bearer access token:

```sh
RSPFX_ACCESS_TOKEN=<token> \
RSPFX_APP_CATALOG_URL=https://contoso.sharepoint.com/sites/appcatalog \
rspfx deploy
```

or `config.deploy.appCatalogSiteUrl` for the catalog URL (prompted otherwise).
**Without a token `rspfx deploy` prints the manual upload steps instead** — it
never fails the pipeline on missing secrets. The catalog URL is validated before
upload, and the upload fails fast after a 120s timeout.

## CI usage

Exit codes are 0/1 and logs are structured, so the pipeline slots into CI:

```yaml
steps:
  - run: pnpm install --frozen-lockfile
  - run: rspfx doctor            # preflight; fails fast on bad env
  - run: rspfx package           # build + package
  - upload: sharepoint/solution/*.sppkg
```

Tips:

- Use `rspfx build --no-minify --sourcemap` to keep debuggable bundles in a
  staging build; ship minified.
- `RSPFX_LOG_LEVEL=debug` (or `silent`) tunes CLI output.
- Cache `node_modules` and `.rspack-cache` (dev-mode persistent cache) between
  runs; production builds run without the persistent cache by design.

## Sizing & performance

Build-time knobs: `build.minify` (default true), `build.splitChunks` (default
false), `build.sourcemap` (default false). For reference, the full
[PnP Modern Search](../examples/modern-search) solution — 4 web parts, ~178
source files, Fluent UI 8, MGT, Handlebars, Adaptive Cards — builds in **~2s**
on a laptop (`rspfx build`), including manifest generation.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `UNRESOLVED_EXTERNAL: External 'X' could not be resolved` | An `externals` key in `config/config.json` has no component manifest under `node_modules/X/dist` — remove the key, or add the package if it's a real component |
| Bundle contains sp-* code | An `@microsoft/sp-*` import wasn't externalized — check the package is in `node_modules` (it's auto-externalized there) and not resolved through an alias |
| `Module not found: Can't resolve 'XxxWebPartStrings'` | `config.json` `localizedResources` entry missing or not in the `lib/.../{locale}.js` shape — RSPFX maps each entry to the default-locale source file |
| `@import 'pkg:...'` fails | sass-loader <16.5 doesn't support the `pkg:` scheme — the migration script rewrites these to relative `node_modules` paths |
| `.html` import fails to parse | Fixed by the built-in `asset/source` rule; if you still hit it, you're on a stale CLI — rebuild |
| Workbench shows a 404 on the bundle | `config.json` bundle name doesn't match the emitted bundle — `entryModuleId` follows the bundle name, so the bundle key, the emitted `.js` file and the manifest must agree (default layout: bundle key == web part folder name) |
| `rspfx package` writes to `solution/` not `sharepoint/solution/` | `paths.zippedPackage` in `config/package-solution.json` is authoritative — that's the official behavior |
