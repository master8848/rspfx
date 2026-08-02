# Migrating off gulp + Heft to RSPFX

The definitive how-to for moving an existing SPFx project from the official
toolchain (`gulp`/`Heft` + `webpack`, rig `@microsoft/spfx-web-build-rig`) to
RSPFX. It was written from a real migration of
[PnP Modern Search](../examples/modern-search) — see
[migration-case-study.md](migration-case-study.md) for the play-by-play.

> **Before you start, read [why-not-to-migrate.md](why-not-to-migrate.md).**
> Not every project should move. The short version: web parts + React/Vanilla +
> standard `config/` layout → good fit. Extensions, Angular, library
> components, or custom gulp/webpack pipelines → not yet.

## What carries over unchanged

| Item | Status |
|---|---|
| `src/webparts/<name>/` — web part classes, `*.manifest.json`, components, styles | unchanged |
| `config/package-solution.json` | read directly (id, version, features, `includeClientSideAssets`, `webApiPermissionRequests`, `paths.zippedPackage`) |
| `config/serve.json` | read directly (`initialPage` `{tenantdomain}` token, `https`, `port`, `hostname`) |
| `config/config.json` | bundles + externals + `localizedResources` honored (entrypoint paths rewritten, see below) |
| `config/write-manifests.json` | `cdnBasePath` used for release base URLs |
| `sharepoint/` solution assets | unchanged |
| `@microsoft/sp-*` dependencies | stay pinned to your SPFx target (1.20 / 1.21 / 1.22) |
| Localized string modules (`import strings from 'XxxWebPartStrings'`) | resolve natively from `config.json` `localizedResources` (default locale `en-us`) |
| Lazy `import()` chunks, `*.module.scss`, HTML template imports, `require('*.json')` | supported |

## What is removed

- **`gulpfile.js` / Heft rig** — `gulp serve` / `heft start`, `heft test`,
  `heft package-solution`, `heft clean`, `heft eject-webpack` are gone.
- **Toolchain devDependencies** (25 in the Modern Search case): `@rushstack/heft`,
  `@microsoft/spfx-heft-plugins`, `@microsoft/spfx-web-build-rig`,
  `@microsoft/rush-stack-compiler-*`, `@microsoft/sp-build-web`, `gulp`,
  `gulp-*`, `webpack`, `webpack-*`, `babel-loader`, `css-loader`,
  `html-loader`, `ignore-loader`, `os-browserify`, `path-browserify`,
  `process`, `querystring-es3`, `url`, `util`, `eslint` config packages,
  `@types/webpack-env`, `semver`.
- **Heft-only config files**: `config/rig.json`, `config/typescript.json`,
  `config/sass.json`, `config/deploy-azure-storage.json`,
  `config/spfx-customize-webpack.js`.
- **Heft scripts**: `start`, `eject-webpack` (replaced by `rspfx dev`, …).

## The automated path

```sh
node scripts/migrate-to-rspfx.mjs <project-dir>
```

The script performs the mechanical parts (idempotent, never touches `src/`
outside the two documented rewrites, never installs anything):

1. **package.json** — drop toolchain devDependencies, add `rspfx` scripts
   (`dev`, `dev:refresh`, `build`, `package`, `analyze`, `doctor`, `clean`),
   relax `engines.node` to `>=20`.
2. **config/config.json** —
   - entrypoints `./lib/webparts/<name>/<Name>WebPart.js` (Heft output
     convention) → `./src/webparts/<name>/<Name>WebPart.ts`,
   - bundle keys renamed to match web part folder names (RSPFX requires
     bundle name == `src/webparts/<name>` folder).
3. **SCSS** — `@import 'pkg:<pkg>/<path>'` (sass-loader ≥16.5 syntax) rewritten
   to a relative `node_modules` path.
4. **Deletes** the Heft-only config files above.
5. **Writes `rspfx.config.ts`** (detects react/vanilla + scss) and a plain
   `tsconfig.json` if the old one extends a rig.

Then:

```sh
pnpm install        # or npm/yarn — toolchain deps drop out of the lockfile
pnpm dev            # workbench-first development (see getting-started.md)
pnpm package        # → sharepoint/solution/<name>.sppkg (or your paths.zippedPackage)
```

If your project doesn't fit the conventions the script assumes, apply the same
steps by hand with the checklist below.

## Manual checklist

### 1. Prune dependencies

Keep `@microsoft/sp-*` (and your framework, Fluent UI, PnPjs, …). Remove every
package whose only job was running Heft/webpack/gulp (the list above). Remove
`resolutions`/`overrides` entries that pinned transitive **toolchain** packages
(`loader-utils`, `webpack-dev-server`, `babel-loader`…); keep security
overrides for runtime dependencies.

### 2. Add the config file

```ts
import { defineConfig } from '@mbsks/rspfx-core';

export default defineConfig({
  name: 'my-app',
  framework: 'react',          // vanilla | react | solid | preact | vue | svelte
  spfxVersion: '1.22',         // 1.20 | 1.21 | 1.22 — match installed sp-* versions
  dev: { tenantUrl: 'https://contoso.sharepoint.com' }
});
```

`@mbsks/rspfx-core` is a devDependency (zero-dependency package, so no version fights).

### 3. Rewrite `config/config.json` entrypoints

Official projects point at Heft's compile output; RSPFX compiles source
directly:

```jsonc
// before
"bundles": {
  "modern-search-results-web-part": {
    "components": [{
      "entrypoint": "./lib/webparts/searchResults/SearchResultsWebPart.js",
      "manifest": "./src/webparts/searchResults/SearchResultsWebPart.manifest.json"
    }]
  }
}
// after
"bundles": {
  "searchResults": {               // must equal the src/webparts/<name> folder
    "components": [{
      "entrypoint": "./src/webparts/searchResults/SearchResultsWebPart.ts",
      "manifest": "./src/webparts/searchResults/SearchResultsWebPart.manifest.json"
    }]
  }
}
```

### 4. Delete Heft-only files

`config/rig.json`, `config/typescript.json`, `config/sass.json`,
`config/deploy-azure-storage.json`, `config/spfx-customize-webpack.js`,
`gulpfile.js` if present. Keep `package-solution.json`, `serve.json`,
`write-manifests.json`, `config.json`.

If `config/spfx-customize-webpack.js` did something real (aliases, loader
tweaks), check whether it's still needed — Rspack resolves most packages from
their own entries. The Modern Search aliases (`handlebars` min build,
`process/browser`, `adaptive-expressions` main entry, moment exclusion) were
all unnecessary: the bundle grew slightly but built and ran correctly.

### 5. Fix `pkg:` SCSS imports (if present)

`sass-loader` <16.5 (bundled with RSPFX) doesn't understand
`@import 'pkg:@fluentui/...'`. Rewrite to a relative path:

```scss
@import '../../../node_modules/@fluentui/react/dist/sass/References.scss';
```

### 6. Verify with `rspfx doctor` + `rspfx dev`

`rspfx doctor` validates node version, config load, ports, certs, sp-* version
consistency. Then `rspfx dev` opens the workbench — check each web part loads,
property panes work, and the console is clean (bundle 404s usually mean
step 3's bundle-name mismatch).

### 7. Package and verify the artifact

`rspfx package`, then inspect: the `.sppkg` must contain
`AppManifest.xml`, feature XML, one `WebPart_<id>.xml` per web part, and —
with `includeClientSideAssets` — `ClientSideAssets/` bundles whose manifests
use `HTTPS://SPCLIENTSIDEASSETLIBRARY/` base URLs. `webApiPermissionRequests`
appear in `AppManifest.xml` (`RequestedWebApiPermission` entries).

### 8. Migrate CI

```yaml
- run: pnpm install --frozen-lockfile
- run: rspfx doctor
- run: rspfx package
- upload: sharepoint/solution/*.sppkg
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `entrypoint not found` | config.json still points at `./lib/...` — rewrite to `./src/...` |
| `Can't resolve 'XxxWebPartStrings'` | `localizedResources` missing from config.json, or pattern isn't `lib/.../{locale}.js`-shaped |
| Manifest references `<bundle>.js` that doesn't exist | bundle name ≠ web part folder name — rename the bundle key |
| Build fails on `@import 'pkg:…'` | see step 5 |
| sp-* code in bundle | sp-* is auto-externalized from `node_modules`; check the package is installed (not hoisted away) or you added a `resolve` alias colliding with it |
| `Module parse failed` on `.html` | stale CLI — HTML is handled by `asset/source`; rebuild the CLI |
| Type errors in IDE on `*.module.scss` / string modules | RSPFX compiles with swc (no typecheck); add `declare module '*.module.scss'` / string-module `*.d.ts` for IDE niceness (official projects already ship these) |
| `engines` warnings on install | relax `engines.node` to `>=20` |

## After migration: what changes day to day

| Task | Official SPFx | RSPFX |
|---|---|---|
| Dev | `gulp serve` / `heft start --clean` | `rspfx dev` |
| Hot reload | + spfx-fast-serve | `rspfx dev --refresh` |
| Production build | `gulp bundle --ship` / `heft test --production` | `rspfx build` |
| Package | `gulp package-solution --ship` | `rspfx package` |
| Upload | manual / azure storage | `rspfx deploy` |
| Bundle report | webpack-bundle-analyzer | `rspfx analyze` |
| Clean | `gulp clean` | `rspfx clean` |
| Preflight | — | `rspfx doctor` |

See [building-packages.md](building-packages.md) for the artifact details and
[migration-case-study.md](migration-case-study.md) for a real migration
(18,000-line solution, 2-hour exercise including two framework fixes).
