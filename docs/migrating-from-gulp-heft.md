# Migrating off gulp + Heft to RSPFX

Definitive guide for moving an existing SPFx project from the official toolchain (gulp/Heft, webpack, `@microsoft/spfx-web-build-rig`) to RSPFX. See Microsoft docs: [SharePoint Framework toolchain](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/sharepoint-framework-toolchain) and [SharePoint Framework overview](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/sharepoint-framework-overview).

Based on the real migration of [PnP Modern Search](../examples/modern-search) — see [migration-case-study.md](migration-case-study.md) for the full play-by-play.

> Read [why-not-to-migrate.md](why-not-to-migrate.md) first.

Not every project should move.

Web parts with React/Vanilla and standard `config/` layout are a good fit; custom gulp pipelines or SPFx 2019/on-prem are not.

## What carries over

| Item | Status |
|---|---|
| `src/webparts/<name>/` — web part classes, `*.manifest.json`, components, styles | Unchanged |
| `config/package-solution.json` | Read directly (`id`, `version`, `features`, `includeClientSideAssets`, `webApiPermissionRequests`, `paths.zippedPackage`) |
| `config/serve.json` | Read directly (`initialPage` with `{tenantdomain}`, `https`, `port`, `hostname`) |
| `config/config.json` | `bundles`, `externals`, `localizedResources` honored — entrypoint paths rewritten from `./lib/` to `./src/` |
| `config/write-manifests.json` | `cdnBasePath` used for release base URLs |
| `sharepoint/` assets | Unchanged |
| `@microsoft/sp-*` dependencies | Externalized — keep only if your code imports that runtime (e.g. `@microsoft/sp-http`) |
| Localized strings (`import strings from 'XxxWebPartStrings'`) | Resolved from `localizedResources` (default `en-us`) |
| Lazy `import()` chunks, `*.module.scss`, HTML imports, `require('*.json')` | Supported |

## Same manifest for Heft/Gulp and RSPFX

`config/config.json`, `config/package-solution.json`, and `src/*/*.manifest.json` work unchanged for Heft/Gulp and RSPFX.

You can keep Heft for production and use RSPFX for dev — `rspfx dev` synthesizes config from manifests.

See [hybrid-dev.md](hybrid-dev.md).

## Automated path

Preview, then apply:

```sh
rspfx migrate --dry-run   # preview — no writes
rspfx migrate             # rewrites configs, writes bundler config, backs up to .rspfx/migrate-backup.json
bun install      # or pnpm install / npm install / yarn — toolchain deps drop out, @mbsks/rspfx-plugin added
rspfx dev                 # verify workbench at https://localhost:4321
rspfx package             # → sharepoint/solution/<name>.sppkg
```

`rspfx migrate` writes `vite.config.ts` by default.

Use `--bundler rspack` or `--bundler rsbuild` to scaffold `rspack.config.ts` / `rsbuild.config.ts` instead.

After migrate, `bun run build` (or `pnpm build` / `npm run build` / `yarn build`) and `rspfx build` run the chosen bundler internally — no extra setup.

> **Tip:** Commit or stash before migrating so `git diff` shows exact changes.

No `src/` files are touched except the two documented rewrites (entrypoints and `pkg:` SCSS).

Dry-run is free — run it even if you plan a manual migration.

### Reverting

```sh
rspfx migrate --revert    # restores from .rspfx/migrate-backup.json
```

Or with a clean branch:

```sh
git restore .
git clean -fd .rspfx
bun install      # or pnpm install / npm install / yarn
```

Both restore the Heft/Gulp toolchain.

Delete the generated `vite.config.ts` / `rspack.config.ts` / `rsbuild.config.ts` if present.

> **Tip:** `--dry-run` shows what would change for custom layouts without writing.

`--revert` is the undo for the automated path — prefer `git restore` if you committed first.

## What is removed

- `gulpfile.js` and Heft rig — `gulp serve`, `heft test`, `heft clean`, `heft package-solution` are gone (restored by revert).
- Toolchain devDependencies — `@rushstack/heft`, `@microsoft/spfx-heft-plugins`, `@microsoft/spfx-web-build-rig`, `@microsoft/rush-stack-compiler-*`, `@microsoft/sp-build-web`, `gulp`, `webpack`, loaders, polyfills, rig eslint configs, `@types/webpack-env`.
- Heft-only configs — `config/rig.json`, `config/typescript.json`, `config/sass.json`, `config/deploy-azure-storage.json`, `config/spfx-customize-webpack.js`.
- Heft scripts — `start`, `eject-webpack` (replaced by `rspfx dev`).

## What `rspfx migrate` does

Idempotent, never installs, backs up to `.rspfx/migrate-backup.json`.

1. `package.json` — drops toolchain devDependencies, adds `rspfx` scripts (`dev`, `build`, `package`, `analyze`, `doctor`, `clean`), relaxes `engines.node` to `>=20`, adds `@mbsks/rspfx-plugin`.

2. `config/config.json` — rewrites entrypoints `./lib/webparts/<name>/<Name>WebPart.js` → `./src/webparts/<name>/<Name>WebPart.ts`, renames bundle keys to match web part folder names (default layout requires bundle name == `src/webparts/<name>` folder; decouple via `paths` if needed).

3. SCSS — rewrites `@import 'pkg:<pkg>/<path>'` (sass-loader ≥16.5 syntax) to a relative `node_modules` path.

4. Deletes Heft-only config files listed above.

5. Writes bundler config (`vite.config.ts` with `rspfxVite`, or `rspack.config.ts` / `rsbuild.config.ts`) and a plain `tsconfig.json` if the old one extended a rig.

## Manual checklist

Only needed if you skip `rspfx migrate`.

Prefer `rspfx migrate --dry-run` first — it shows what would change even for custom layouts.

### 1. Prune dependencies

Keep runtime deps (framework, Fluent UI, PnPjs).

Keep `@microsoft/sp-*` only if your code imports that runtime.

Remove Heft/webpack/gulp packages and toolchain `resolutions`/`overrides` that pinned them — keep security overrides for runtime deps.

### 2. Add bundler config (optional)

Zero-config works for standard layouts — `rspfx dev` and `rspfx build` synthesize config from manifests.

For explicit control (Vite default):

```ts
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default {
  plugins: [
    rspfxVite({
      name: 'my-app',
      framework: 'react',      // vanilla | react | solid | preact | vue | svelte
      spfxVersion: '1.22',     // 1.20 | 1.21 | 1.22 | 1.23 | 1.24
      dev: { tenantUrl: 'https://contoso.sharepoint.com' }
    })
  ]
};
```

For Rspack/Rsbuild use `RspfxPlugin` / `rspfxRsbuild` — see [commands.md](commands.md).

`@mbsks/rspfx-plugin` is a devDependency; its core has no dependencies.

### 3. Rewrite entrypoints

Official projects point at Heft output; RSPFX compiles source directly:

```jsonc
// before
"entrypoint": "./lib/webparts/searchResults/SearchResultsWebPart.js"
// after
"entrypoint": "./src/webparts/searchResults/SearchResultsWebPart.ts"
```

Bundle key must equal the web part folder in the default layout.

That key becomes `loaderConfig.entryModuleId` — see [project-structure.md](project-structure.md).

For custom layouts set `paths.webpartsDir` / `paths.configDir` and the bundle key is authoritative.

### 4. Delete Heft-only files

Remove `config/rig.json`, `config/typescript.json`, `config/sass.json`, `config/deploy-azure-storage.json`, `config/spfx-customize-webpack.js`, and `gulpfile.js` if present.

If `spfx-customize-webpack.js` had custom aliases, check if still needed — most Rspack resolves are automatic.

### 5. Fix `pkg:` SCSS imports

`sass-loader` <16.5 does not understand `@import 'pkg:@fluentui/...'`.

Rewrite to:

```scss
@import '../../../node_modules/@fluentui/react/dist/sass/References.scss';
```

### 6. Verify

```sh
rspfx doctor
rspfx dev    # workbench at https://localhost:4321 — check each web part, property panes, console
```

Bundle 404s usually mean a bundle-name mismatch (step 3).

### 7. Package

```sh
rspfx package   # → sharepoint/solution/<name>.sppkg
```

Verify the `.sppkg` contains `AppManifest.xml` and `ClientSideAssets/` when `includeClientSideAssets` is true.

See [building-packages.md](building-packages.md) for output details and [reference/FORMATS.md](../reference/FORMATS.md) for ZIP layout.

### 8. Migrate CI

```yaml
- run: bun install --frozen-lockfile   # or pnpm install --frozen-lockfile / npm ci / yarn --frozen-lockfile
- run: rspfx doctor
- run: rspfx package
- upload: sharepoint/solution/*.sppkg
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `entrypoint not found` | `config.json` still points at `./lib/...` — rewrite to `./src/...` |
| `Can't resolve 'XxxWebPartStrings'` | `localizedResources` missing or pattern not `lib/.../{locale}.js` |
| Manifest references missing `<bundle>.js` | Bundle name ≠ folder name — rename key or set `paths` |
| `@import 'pkg:…'` fails | Rewrite as in step 5 |
| `Module parse failed` on `.html` | Rebuild CLI — HTML handled as `asset/source` |
| Type errors on `*.module.scss` | RSPFX uses swc (no typecheck); add `declare module '*.module.scss'` for IDE |
| `engines` warnings | Relax `engines.node` to `>=20` |

## After migration

Migrate keeps the detected `spfxVersion`.

To change target (e.g. `1.22` → `1.24`), edit one field and update:

```sh
# in vite.config.ts / rspack.config.ts / rsbuild.config.ts
# spfxVersion: '1.24'
bun update @mbsks/rspfx-plugin   # or pnpm update / npm update / yarn upgrade
```

See [upgrading-spfx-version.md](upgrading-spfx-version.md) and [compatibility.md](compatibility.md).

Full matrix: [compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix).

## Comparison vs official

| Task | Official SPFx | RSPFX |
|---|---|---|
| Dev | `gulp serve` / `heft start --clean` | `rspfx dev` (workbench at `https://localhost:4321`, local preview at `http://localhost:4321`) |
| Hot reload | `spfx-fast-serve` | `rspfx dev --refresh` |
| Build | `gulp bundle --ship` | `rspfx build` (or `bun` / `pnpm` / `npm` / `yarn` `run build` — zero-config) |
| Package | `gulp package-solution --ship` | `rspfx package` |
| Upload | manual / Azure storage script | `rspfx deploy` |
| Bundle report | `webpack-bundle-analyzer` | `rspfx analyze` |
| Clean | `gulp clean` | `rspfx clean` |
| Preflight | — | `rspfx doctor` |
| Revert | — | `rspfx migrate --revert` or `git restore` |

See [building-packages.md](building-packages.md) for outputs and [migration-case-study.md](migration-case-study.md) for a real 42k-line migration (~2 hours including fixes).
