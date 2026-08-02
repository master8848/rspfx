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
| `rspfx deploy` | Uploads the `.sppkg` to the app catalog | REST creds via `config.deploy` or env vars; prints manual steps without them |
| `rspfx analyze` | Bundle size report as console table + `.rspfx/analyze.html` | Implies `build` |
| `rspfx clean` | Removes `dist/`, `release/`, `temp/`, `.rspfx/`, `node_modules/.cache` | — |
| `rspfx doctor` | Environment/config checks, exit code 1 on failure | CI-friendly preflight |

All commands load `rspfx.config.ts` and merge CLI flags over it
(`build.minify`/`build.sourcemap`, `dev.port`, etc.).

## What `rspfx build` does

1. **Reads the project** (`config/config.json`): bundle entrypoints, externals,
   `localizedResources`. Entrypoints in the official Heft convention
   (`./lib/...WebPart.js`) are migrated to source (`./src/...WebPart.ts`) by
   `scripts/migrate-to-rspfx.mjs`; without `config.json` bundles, web parts are
   auto-discovered from `src/webparts/*`.
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
   - `loaderConfig.entryModuleId` = the web part folder name
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

`rspfx deploy` automates the upload with REST credentials:

```sh
RSPFX_TENANT=https://contoso.sharepoint.com \
RSPFX_USERNAME=user@contoso.onmicrosoft.com \
RSPFX_PASSWORD=... \
rspfx deploy
```

or via `config.deploy` (`tenantUrl`, `username`, `password`,
`appCatalogSiteUrl`). **Without credentials `rspfx deploy` prints the manual
upload steps instead** — it never fails the pipeline on missing secrets.

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
| Workbench shows a 404 on the bundle | `config.json` bundle name ≠ web part folder name — rename the bundle (see the migration guide) |
| `rspfx package` writes to `solution/` not `sharepoint/solution/` | `paths.zippedPackage` in `config/package-solution.json` is authoritative — that's the official behavior |
