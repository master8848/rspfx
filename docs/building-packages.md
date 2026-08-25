# Building, packaging & deploying

This is the build pipeline reference: what each command produces, what the artifacts are, and how to wire it into CI. For the day-to-day flow see [getting-started.md](getting-started.md); for moving an existing project see [migrating-from-gulp-heft.md](migrating-from-gulp-heft.md). For exhaustive file paths and manifest naming see [project-structure.md](project-structure.md); for end-to-end catalog/Teams/CDN steps see [deployment.md](deployment.md).

## Command overview

| Command | Produces | Notes |
|---|---|---|
| `rspfx build` | `dist/` bundles + `release/manifests/*.manifest.json` + `release/assets/*` | Production compile; `--no-minify`, `--sourcemap` flags; bundler config is optional — synthesizes from manifests when absent |
| `rspfx package` | `<paths.zippedPackage>` (default `sharepoint/solution/<name>.sppkg`) | Implies `build`; `--no-build` to skip |
| `rspfx deploy` | Uploads the `.sppkg` to the app catalog | see [commands.md#rspfx-deploy](commands.md#rspfx-deploy) |
| `rspfx analyze` | Bundle size report as console table + `.rspfx/analyze.html` | Implies `build`; module counts fall back to `.rspfx/stats.json` on Vite/Rsbuild |
| `rspfx clean` | Removes `dist/`, `release/`, `temp/`, `.rspfx`, `node_modules/.cache` | — |
| `rspfx doctor` | Environment/config checks, exit code 1 on failure | CI-friendly preflight |

All commands read the project from `config/*` and `src/*/*.manifest.json`. When a bundler config (`rspack.config.ts|js`, `vite.config.ts|js`, or `rsbuild.config.ts|js`) is present it is loaded and the `RspfxPlugin` / `rspfxVite` / `rspfxRsbuild` marker is used; when absent the same manifests are synthesized internally and Rspack or Vite runs without extra setup (see [migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx](migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx)). CLI flags merge over file options (`build.minify`/`build.sourcemap`, `dev.port`, etc.).

> **Tip:** No manual `@microsoft/sp-*` install is needed for most web parts. The toolchain externalizes them and emits `"type": "component"` manifest entries so SharePoint resolves its built-in copies (see [project-structure.md](project-structure.md)). Install `sp-*` only if your code imports that runtime.

## Same manifest for Heft/Gulp and RSPFX

`config/config.json`, `config/package-solution.json`, and `src/*/*.manifest.json` are shared between Heft/Gulp and RSPFX. Switching and revert are documented in [migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx](migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx) (`rspfx migrate --revert` or `git restore` / `.rspfx/migrate-backup.json`).

## Project layout

RSPFX assumes the official SPFx folder layout by default, but every part of it is configurable via the `paths` section of the plugin options (or synthesized defaults when no bundler config is present):

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

With the default layout, a web part folder `src/webparts/hello/` maps to a bundle named `hello`. With `config.json` bundles (or a custom `paths.webpartsDir`), the bundle name is authoritative: `loaderConfig.entryModuleId` is derived from the bundle entry name.

Bundler config is optional — omit it for zero-config. `bun run build` / `rspfx build` synthesizes the same options from the manifests and runs Rspack or Vite internally; if `rspack` or `vite` is installed it just works.

## What `rspfx build` does

1. **Reads the project** (`<paths.configDir>/config.json`): bundle entrypoints, externals, `localizedResources`. Entrypoints `./lib/...WebPart.js` are rewritten by `rspfx migrate` to `./src/...WebPart.ts`; without `config.json` bundles, web parts are auto-discovered from `<paths.webpartsDir>/*` (default `src/webparts/*`). No manual `@microsoft/sp-*` install is needed — externals are handled internally.
2. **Loads the framework preset** (`@mbsks/rspfx-framework-<id>`): swc JSX/TS transform, define flags, resolve contributions.
3. **Compiles with Rspack (or Vite/Rsbuild when that config is present)**: one AMD bundle per web part (`define('<componentId>_<version>', ["@microsoft/sp-core-library", ...], ...)`), lazy `import()` → `chunk.<name>.js`, SCSS/CSS modules, HTML imports (`asset/source`), assets. sp-* packages are never bundled — every `@microsoft/sp-*` in `node_modules` plus every `externals` key in `config.json` is externalized. Styling is inlined into JS (no external `.css` in the `.sppkg`); see [styling.md](styling.md) for defaults, Tailwind v4, and per-bundler customization.
4. **Generates component manifests** into `release/manifests/`: `version: "*"` → package.json version; `loaderConfig.entryModuleId` = bundle entry name; `scriptResources` = bundle (`"type": "path"`) + one `"type": "component"` per external (sp-* IDs/versions from `node_modules` manifests when present, fallback `reference/sp-component-ids.json`); `localizedResources` resolve to default locale (`en-us`) at compile time.
5. **Copies assets** to `release/assets/` for packaging.

`rspfx build` alone does **not** produce an installable package — it produces the pieces (`dist` + `release`) that `rspfx package` assembles.

## What `rspfx package` produces

The `.sppkg` is a standard SharePoint package — a zip with a defined layout (full spec in [reference/FORMATS.md](../reference/FORMATS.md)):

```
[Content_Types].xml                       — content types, xml first
_rels/.rels                               → AppManifest.xml
AppManifest.xml                            — solution metadata, permissions, version
_rels/AppManifest.xml.rels                 → feature + assets
feature_<id>.xml                           — one per feature in package-solution.json
feature_<id>.xml.config.xml                — feature config
_rels/feature_<id>.xml.rels                → feature config + component manifests
<featureId>/<type>_<id>.xml                — your component manifest (WebPart / Extension / Library)
Resources.resx                             — when sharepoint/Resources*.resx exists
ClientSideAssets.xml                       — when bundling assets into the package
ClientSideAssets/                          — your bundles, chunks, and Teams files
```

Key semantics, all read from `config/package-solution.json`:

- `paths.zippedPackage` — output path (default `sharepoint/solution/<name>.sppkg`).
- `includeClientSideAssets: true` — bundles in package; manifests `internalModuleBaseUrls` rewritten to `HTTPS://SPCLIENTSIDEASSETLIBRARY/`.
- `includeClientSideAssets: false` (or `cdnBasePath` in `config/write-manifests.json`) — manifests keep CDN base URL; only metadata ships; upload `release/assets/*` to CDN.
- `webApiPermissionRequests` — emitted as `RequestedWebApiPermission` entries in `AppManifest.xml`.
- `skipFeatureDeployment`, `isDomainIsolated`, `developer`, `metadata` — passed through to `AppManifest.xml`.
- **Extension** (`componentType: Extension`) → `<featureId>/Extension_<id>.xml` with `Location` and a per-build instance — no `<Module>`.
- **Library** (`componentType: Library`) → `<featureId>/Library_<id>.xml` with single-quoted manifest — no `<Module>` or `<Location>`.

RSPFX also auto-detects two optional folders:

- `teams/` — when present (`manifest.json` + icons), files are included under `ClientSideAssets/`.
- `sharepoint/Resources*.resx` — `Resources.resx` (`CultureName="default"`) plus `Resources.<lang>.resx` land at zip root; also powers localized `metadata.shortDescription` / `longDescription` (`"$Resources:KeyName"` → `<LocalizedString CultureName="...">` per locale).

`rspfx package` runs the same zip validation the tests use (`validateSppkg`) and reports entry count on success.

## Installing

1. `rspfx package`
2. Upload the `.sppkg` to the **app catalog** (*SharePoint Admin Center → App Catalog → Apps for SharePoint*).
3. Click *Deploy* (or set `skipFeatureDeployment: true` to auto-deploy).
4. On any site: *Add an app* → your solution → *Add*.

Full step-by-step with catalog URLs, CDN, API permissions, Teams sync, and env-var interpolation: [deployment.md](deployment.md).

## Deploying from CLI

`rspfx deploy` automates the upload with a bearer access token (see [commands.md#rspfx-deploy](commands.md#rspfx-deploy)).

Without a token `rspfx deploy` prints the manual upload steps instead.

The catalog URL is validated before upload.

The upload fails fast after a 120s timeout.

## CI usage

Exit codes are 0/1 and logs are structured, so the pipeline slots into CI:

```yaml
steps:
  - run: bun install --frozen-lockfile
  - run: rspfx doctor            # preflight; fails fast on bad env
  - run: rspfx package           # build + package (zero-config also works: bun run build)
  - upload: sharepoint/solution/*.sppkg
```

Tips:

- Use `rspfx build --no-minify --sourcemap` to keep debuggable bundles in a staging build; ship minified.
- Log level via env var (see [commands.md#environment-variables](commands.md#environment-variables)).
- Cache `node_modules` and `.rspack-cache` (dev-mode persistent cache) between runs; production builds run without the persistent cache by design.

## Sizing & performance

Build-time knobs: `build.minify` (default true), `build.splitChunks` (default false), `build.sourcemap` (default false).

`splitChunks: false` is the SPFx default because each web part ships as a single self-contained AMD bundle (`define('<id>_<version>', …)`); enabling `splitChunks: true` emits shared `chunk.*.js` files that reduce duplicate code across web parts but require an extra request and are not cached across tenants the same way.

For reference, [PnP Modern Search](../examples/modern-search) (4 web parts, ~178 source files, Fluent UI 8, MGT, Handlebars, Adaptive Cards) builds in ~2s on a laptop (`rspfx build`).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `UNRESOLVED_EXTERNAL: External 'X' could not be resolved` | An `externals` key in `config/config.json` has no component manifest under `node_modules/X/dist` — remove the key, or add the package if it's a real component |
| Bundle contains sp-* code | An `@microsoft/sp-*` import wasn't externalized — check you didn't add a `resolve` alias colliding with it; no manual sp-* install is needed for the externalization itself |
| `Module not found: Can't resolve 'XxxWebPartStrings'` | `config.json` `localizedResources` entry missing or not in the `lib/.../{locale}.js` shape — RSPFX maps each entry to the default-locale source file |
| `@import 'pkg:...'` fails | sass-loader <16.5 doesn't support the `pkg:` scheme — `rspfx migrate` rewrites these to relative `node_modules` paths |
| `.html` import fails to parse | Fixed by the built-in `asset/source` rule; if you still hit it, you're on a stale CLI — rebuild |
| Workbench shows a 404 on the bundle | `config.json` bundle name doesn't match the emitted bundle — `entryModuleId` follows the bundle name, so the bundle key, the emitted `.js` file and the manifest must agree (default layout: bundle key == web part folder name) |
| `rspfx package` writes to `solution/` not `sharepoint/solution/` | `paths.zippedPackage` in `config/package-solution.json` is authoritative — that's the official behavior |
