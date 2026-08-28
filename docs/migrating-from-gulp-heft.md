# Migrating off gulp + Heft to RSPFX

The definitive how-to for moving an existing SPFx project from the official toolchain (`gulp`/`Heft` + `webpack`, rig `@microsoft/spfx-web-build-rig`) to RSPFX. It was written from a real migration of [PnP Modern Search](../examples/modern-search) — see [migration-case-study.md](migration-case-study.md) for the play-by-play.

> **Before you start, read [why-not-to-migrate.md](why-not-to-migrate.md).** Not every project should move. The short version: web parts + React/Vanilla + standard `config/` layout → good fit. Extensions, Angular, library components, or custom gulp/webpack pipelines → not yet.

## What carries over unchanged

| Item | Status |
|---|---|
| `src/webparts/<name>/` — web part classes, `*.manifest.json`, components, styles | unchanged |
| `config/package-solution.json` | read directly (id, version, features, `includeClientSideAssets`, `webApiPermissionRequests`, `paths.zippedPackage`) |
| `config/serve.json` | read directly (`initialPage` `{tenantdomain}` token, `https`, `port`, `hostname`) |
| `config/config.json` | bundles + externals + `localizedResources` honored (entrypoint paths rewritten, see below) |
| `config/write-manifests.json` | `cdnBasePath` used for release base URLs |
| `sharepoint/` solution assets | unchanged |
| `@microsoft/sp-*` dependencies | externalized and handled internally — keep them only if your code imports that runtime (e.g. `@microsoft/sp-http`); most web parts need no manual install |
| Localized string modules (`import strings from 'XxxWebPartStrings'`) | resolve natively from `config.json` `localizedResources` (default locale `en-us`) |
| Lazy `import()` chunks, `*.module.scss`, HTML template imports, `require('*.json')` | supported |

## Same manifest for Heft/Gulp and RSPFX

`config/config.json`, `config/package-solution.json`, and `src/*/*.manifest.json` work unchanged for both toolchains. The same manifests drive `gulp bundle` / `heft` and `rspfx build` — no fork.

### Switching toolchains

Keep Heft/Gulp for production and use RSPFX for dev without migrating — `rspfx dev` synthesizes its config from the manifests (see [hybrid-dev.md](hybrid-dev.md)).

To fully switch to RSPFX builds:

```sh
rspfx migrate --dry-run   # preview changes (no writes)
rspfx migrate             # apply: rewrites package.json/config.json, writes bundler config, backs up to .rspfx/migrate-backup.json
bun install              # toolchain deps drop out, @mbsks/rspfx-plugin added
rspfx dev                 # verify workbench
rspfx package             # → sharepoint/solution/<name>.sppkg
```

`rspfx migrate` writes `vite.config.ts` by default; `--bundler rspack` or `--bundler rsbuild` scaffolds `rspack.config.ts` / `rsbuild.config.ts` instead. After migrate `bun run build` / `rspfx build` runs Vite, Rsbuild, or Rspack internally — if `vite`, `rsbuild`, or `rspack` is installed it just works.

> **Tip:** Commit or stash before migrating. `git diff` shows the exact changes. No `src/` is touched outside the documented rewrites.

### Reverting

```sh
rspfx migrate --revert    # restores every file from .rspfx/migrate-backup.json
```

Or, if the branch is clean:

```sh
git restore .
git clean -fd .rspfx
bun install
```

Both restore the Heft/Gulp toolchain. Delete the generated `rspack.config.ts` / `vite.config.ts` / `rsbuild.config.ts` and Heft scripts return as before.

## What is removed

- **`gulpfile.js` / Heft rig** — `gulp serve` / `heft start`, `heft test`, `heft package-solution`, `heft clean`, `heft eject-webpack` are gone (restored by `--revert` or `git restore`).
- **Toolchain devDependencies** (25 in the Modern Search case): `@rushstack/heft`, `@microsoft/spfx-heft-plugins`, `@microsoft/spfx-web-build-rig`, `@microsoft/rush-stack-compiler-*`, `@microsoft/sp-build-web`, `gulp`, `gulp-*`, `webpack`, `webpack-*`, `babel-loader`, `css-loader`, `html-loader`, `ignore-loader`, `os-browserify`, `path-browserify`, `process`, `querystring-es3`, `url`, `util`, `eslint` config packages, `@types/webpack-env`, `semver`.
- **Heft-only config files**: `config/rig.json`, `config/typescript.json`, `config/sass.json`, `config/deploy-azure-storage.json`, `config/spfx-customize-webpack.js`.
- **Heft scripts**: `start`, `eject-webpack` (replaced by `rspfx dev`, …).

## The automated path

```sh
rspfx migrate --dry-run
rspfx migrate
bun install        # or npm/yarn — toolchain deps drop out of the lockfile
bun run dev            # workbench-first development (see getting-started.md)
bun run package        # → sharepoint/solution/<name>.sppkg (or your paths.zippedPackage)
```

`rspfx migrate` performs the mechanical parts (idempotent, never touches `src/` outside the two documented rewrites, never installs anything, backs up to `.rspfx/migrate-backup.json`):

1. **package.json** — drop toolchain devDependencies, add `rspfx` scripts (`dev`, `dev:refresh`, `build`, `package`, `analyze`, `doctor`, `clean`), relax `engines.node` to `>=20`, add `@mbsks/rspfx-plugin` devDependency.
2. **config/config.json** — entrypoints `./lib/webparts/<name>/<Name>WebPart.js` (Heft output convention) → `./src/webparts/<name>/<Name>WebPart.ts`, bundle keys renamed to match web part folder names (in the default layout RSPFX requires bundle name == `src/webparts/<name>` folder; a custom layout can decouple the two via `paths` — see below).
3. **SCSS** — `@import 'pkg:<pkg>/<path>'` (sass-loader ≥16.5 syntax) rewritten to a relative `node_modules` path.
4. **Deletes** the Heft-only config files above.
5. **Writes `vite.config.ts`** (with `rspfxVite`; detects react/vanilla + scss) and a plain `tsconfig.json` if the old one extends a rig. Use `--bundler rspack` / `--bundler rsbuild` for those variants.

> **Quick way:** One-liner preview → migrate → install → dev. No hand-editing of configs and no AI edits needed.

## Manual checklist (only if you skip `rspfx migrate`)

If your project doesn't fit the conventions `rspfx migrate` assumes, apply the same steps by hand with the checklist below. Prefer `rspfx migrate --dry-run` first — it shows what would change even for custom layouts.

### 1. Prune dependencies

Keep runtime deps (your framework, Fluent UI, PnPjs). Keep `@microsoft/sp-*` only if your code imports that runtime — most web parts rely on the toolchain's externalization and need no manual `sp-*` install. Remove every package whose only job was running Heft/webpack/gulp (the list above). Remove `resolutions`/`overrides` entries that pinned transitive **toolchain** packages (`loader-utils`, `webpack-dev-server`, `babel-loader`…); keep security overrides for runtime dependencies.

### 2. Add the config file (optional — zero-config also works)

For standard layouts you can skip this and run `bun run build` / `rspfx dev` zero-config — the toolchain synthesizes the config from the manifests and runs Vite, Rsbuild, or Rspack internally. If you want an explicit config (Vite default):

```ts
import { rspfxVite } from '@mbsks/rspfx-plugin';

export default {
  plugins: [
    rspfxVite({
      name: 'my-app',
      framework: 'react',          // vanilla | react | solid | preact | vue | svelte
      spfxVersion: '1.22',         // 1.20 | 1.21 | 1.22 | 1.23 — must match any installed sp-* versions if you have them
      dev: { tenantUrl: 'https://contoso.sharepoint.com' }
    })
  ]
};
```

`@mbsks/rspfx-plugin` is a devDependency (the plugin carries the whole project config; its core dependency is zero-dependency, so no version fights). For Rspack/Rsbuild use `RspfxPlugin` / `rspfxRsbuild` (see [commands.md](commands.md)).

### 3. Rewrite `config/config.json` entrypoints

Official projects point at Heft's compile output; RSPFX compiles source directly:

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
  "searchResults": {               // default layout: equals the src/webparts/<name> folder
    "components": [{
      "entrypoint": "./src/webparts/searchResults/SearchResultsWebPart.ts",
      "manifest": "./src/webparts/searchResults/SearchResultsWebPart.manifest.json"
    }]
  }
}
```

`loaderConfig.entryModuleId` in the generated manifests follows the **bundle name**, so `searchResults` here is the entry module id. In the default layout the bundle name must equal the web part folder name (that's what the bundle key above is). If your project uses a different folder structure — e.g. manifests under `components/` or a bundle name that differs from the folder — configure it once in the plugin options (`paths.webpartsDir`, `paths.configDir`, `paths.srcDir`) and the bundle name becomes authoritative for `entryModuleId` regardless of folder naming.

### 4. Delete Heft-only files

`config/rig.json`, `config/typescript.json`, `config/sass.json`, `config/deploy-azure-storage.json`, `config/spfx-customize-webpack.js`, `gulpfile.js` if present. Keep `package-solution.json`, `serve.json`, `write-manifests.json`, `config.json`.

If `config/spfx-customize-webpack.js` did something real (aliases, loader tweaks), check whether it's still needed — Rspack resolves most packages from their own entries. The Modern Search aliases (`handlebars` min build, `process/browser`, `adaptive-expressions` main entry, moment exclusion) were all unnecessary: the bundle grew slightly but built and ran correctly.

### 5. Fix `pkg:` SCSS imports (if present)

`sass-loader` <16.5 (bundled with RSPFX) doesn't understand `@import 'pkg:@fluentui/...'`. Rewrite to a relative path:

```scss
@import '../../../node_modules/@fluentui/react/dist/sass/References.scss';
```

### 6. Verify with `rspfx doctor` + `rspfx dev`

`rspfx doctor` validates node version, config load, ports, certs, sp-* version consistency. Then `rspfx dev` opens the workbench — check each web part loads, property panes work, and the console is clean (bundle 404s usually mean step 3's bundle-name mismatch).

### 7. Package and verify the artifact

`rspfx package`, then inspect: the `.sppkg` must contain `AppManifest.xml`, feature XML, one `WebPart_<id>.xml` per web part, and — with `includeClientSideAssets` — `ClientSideAssets/` bundles whose manifests use `HTTPS://SPCLIENTSIDEASSETLIBRARY/` base URLs. `webApiPermissionRequests` appear in `AppManifest.xml` (`RequestedWebApiPermission` entries).

### 8. Migrate CI

```yaml
- run: bun install --frozen-lockfile
- run: rspfx doctor
- run: rspfx package
- upload: sharepoint/solution/*.sppkg
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `entrypoint not found` | config.json still points at `./lib/...` — rewrite to `./src/...` |
| `Can't resolve 'XxxWebPartStrings'` | `localizedResources` missing from config.json, or pattern isn't `lib/.../{locale}.js`-shaped |
| Manifest references `<bundle>.js` that doesn't exist | bundle name ≠ web part folder name in the default layout — rename the bundle key (or decouple via `paths`) |
| Build fails on `@import 'pkg:…'` | see step 5 |
| sp-* code in bundle | sp-* is auto-externalized; check you didn't add a `resolve` alias colliding with it — no manual install is needed for the externalization to work |
| `Module parse failed` on `.html` | stale CLI — HTML is handled by `asset/source`; rebuild the CLI |
| Type errors in IDE on `*.module.scss` / string modules | RSPFX compiles with swc (no typecheck); add `declare module '*.module.scss'` / string-module `*.d.ts` for IDE niceness (official projects already ship these) |
| `engines` warnings on install | relax `engines.node` to `>=20` |

## After migration: upgrade the SPFx target

Migrating keeps the detected `spfxVersion` (from `package.json` `@microsoft/sp-core-library`, else `SPFX_DEFAULT_TARGET` `packages/core/src/versions.ts:13`).

To move `1.22 → 1.23` after the migrate, change one field `spfxVersion: '1.23'` in the generated config and `bun update @mbsks/rspfx-plugin` — see [upgrading-spfx-version.md](upgrading-spfx-version.md) for the step-by-step, zero-install notes (`@microsoft/sp-*` stays externalized), and the Node 20+ matrix.

Full matrix and per-version guarantees: [compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix).

## After migration: what changes day to day

| Task | Official SPFx | RSPFX |
|---|---|---|
| Dev | `gulp serve` / `heft start --clean` | `rspfx dev` |
| Hot reload | + spfx-fast-serve | `rspfx dev --refresh` |
| Production build | `gulp bundle --ship` / `heft test --production` | `rspfx build` (or `bun run build` — zero-config, no manual bundler config) |
| Package | `gulp package-solution --ship` | `rspfx package` |
| Upload | manual / azure storage | `rspfx deploy` |
| Bundle report | webpack-bundle-analyzer | `rspfx analyze` |
| Clean | `gulp clean` | `rspfx clean` |
| Preflight | — | `rspfx doctor` |
| Revert | — | `rspfx migrate --revert` or `git restore` |

See [building-packages.md](building-packages.md) for the artifact details and [migration-case-study.md](migration-case-study.md) for a real migration (42,000-line solution, 2-hour exercise including two framework fixes).
