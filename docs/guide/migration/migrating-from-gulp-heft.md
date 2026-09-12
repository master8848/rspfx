# Migrating from gulp and Heft

TL;DR: Move an existing SPFx project by dropping gulp and Heft files, rewriting entrypoints, and adding a bundler config. Run `rspfx migrate` to automate it. To try without migrating, see [Try mode](../try-mode.md).

This is the definitive guide to SPFx replace Webpack, SPFx eject webpack, SPFx custom Webpack, and the SPFx Heft custom toolchain replacement — the SPFx custom build pipeline that replaces webpack + Heft + gulp. See [Migration case study](./migration-case-study.md) for a real example.

See also [Why RSPFx](../why-rspfx.md#search-terms--spfx-vite-replacement-and-alternative-bundlers) for "SPFx Vite", "SPFx Vite replacement", "SPFx alternative bundler", "SharePoint Framework Vite", "SharePoint Framework alternative build tool", "SPFx Rspack", and "SPFx esbuild" search terms.

Read [Why not to migrate](./why-not-to-migrate.md) first if you are unsure. For a zero-risk trial that keeps gulp and Heft, start with [Try mode](../try-mode.md).

## What you keep

| Item | Status |
|---|---|
| `src/webparts/<name>/` | unchanged |
| `config/package-solution.json` | read directly |
| `config/serve.json` | read directly |
| `config/config.json` | honored - entrypoints rewritten from `./lib/` to `./src/` |
| `config/write-manifests.json` | `cdnBasePath` honored |
| `sharepoint/` assets | unchanged |
| `@microsoft/sp-*` | externalized - keep only if you import that runtime |
| Localized strings | resolved via `localizedResources` |
| Lazy `import()` chunks, SCSS modules, HTML, JSON | supported |

## Shared manifests for both toolchains

`config/config.json`, `config/package-solution.json`, and `src/*/*.manifest.json` work for Heft and RSPFx. You can keep Heft for prod and use `rspfx dev` for dev before you migrate. See [Hybrid dev](./hybrid-dev.md).

## Automated path

Preview, then apply:

```sh
rspfx migrate --dry-run
rspfx migrate
bun install
rspfx dev
rspfx package
```

`rspfx migrate` writes `vite.config.ts` by default. Use `--bundler rspack` or `--bundler rsbuild` for those files.

After migrate, `bun run build` and `rspfx build` run the chosen bundler. Dry run touches no files. The command backs up to `.rspfx/migrate-backup.json`.

### Revert

```sh
rspfx migrate --revert
```

Or:

```sh
git restore .
git clean -fd .rspfx
bun install
```

Delete the generated `vite.config.ts`, `rspack.config.ts`, or `rsbuild.config.ts` if present.

## What gets removed

- `gulpfile.js` and Heft rig - `gulp serve`, `heft test`, `heft clean` go away.
- Toolchain dev deps - `heft`, `spfx-heft-plugins`, `spfx-web-build-rig`, `rush-stack-compiler-*`, `sp-build-web`, `gulp`, `webpack`, loaders.
- Heft configs - `config/rig.json`, `config/typescript.json`, `config/sass.json`, `config/deploy-azure-storage.json`, `config/spfx-customize-webpack.js`.
- Heft scripts - `start`, `eject-webpack`.

## What `rspfx migrate` does

The command is idempotent. It never installs.

1. `package.json` - drops toolchain dev deps, adds `rspfx` scripts, relaxes `engines.node` to `>=20`, adds `@mbsks/rspfx-plugin`.
2. `config/config.json` - rewrites entrypoints `./lib/webparts/<name>/<Name>WebPart.js` to `./src/webparts/<name>/<Name>WebPart.ts` and renames bundle keys to folder names.
3. SCSS - rewrites `@import 'pkg:<pkg>/<path>'` to a relative `node_modules` path.
4. Deletes Heft only config files.
5. Writes bundler config and a plain `tsconfig.json` if the old one extended a rig.

<Steps>

## Manual checklist when you skip `rspfx migrate`

### Step 1: Prune deps

Keep runtime deps. Keep `@microsoft/sp-*` only if you import that runtime. Remove Heft, webpack, and gulp packages and their `resolutions` or `overrides`.

### Step 2: Add bundler config

Zero config works for standard layouts. For explicit control with Vite:

```ts
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default {
  plugins: [
    rspfxVite({
      name: 'my-app',
      framework: 'react',
      spfxVersion: '1.22',
      dev: { tenantUrl: 'https://contoso.sharepoint.com' }
    })
  ]
};
```

For Rspack or Rsbuild use `RspfxPlugin` or `rspfxRsbuild`. See [../../reference/commands.md](../../reference/commands.md).

### Step 3: Rewrite entrypoints

Change Heft output paths to source paths:

```jsonc
// before
"entrypoint": "./lib/webparts/searchResults/SearchResultsWebPart.js"
// after
"entrypoint": "./src/webparts/searchResults/SearchResultsWebPart.ts"
```

Bundle key must equal the web part folder in default layout. That key becomes `loaderConfig.entryModuleId`.

### Step 4: Delete Heft only files

Remove `config/rig.json`, `config/typescript.json`, `config/sass.json`, `config/deploy-azure-storage.json`, `config/spfx-customize-webpack.js`, and `gulpfile.js` if present.

### Step 5: Fix `pkg:` SCSS imports

Rewrite:

```scss
@import '../../../node_modules/@fluentui/react/dist/sass/References.scss';
```

### Step 6: Verify

Run:

```sh
rspfx doctor
rspfx dev
```

Bundle 404s often mean a bundle name mismatch from step 3.

### Step 7: Package

Run:

```sh
rspfx package
```

Check the `.sppkg` has `AppManifest.xml` and `ClientSideAssets/` when `includeClientSideAssets` is true. See [../../reference/architecture.md](../../reference/architecture.md).

### Step 8: Migrate CI

Update CI to:

```yaml
- run: bun install --frozen-lockfile
- run: rspfx doctor
- run: rspfx package
- upload: sharepoint/solution/*.sppkg
```

</Steps>

## Troubleshoot

| Symptom | Fix |
|---|---|
| `entrypoint not found` | rewrite `config.json` from `./lib/...` to `./src/...` |
| `Can't resolve XxxWebPartStrings` | check `localizedResources` |
| Manifest missing `<bundle>.js` | bundle name must equal folder name or set `paths` |
| `@import 'pkg:…'` fails | rewrite as in step 5 |
| Type errors on `*.module.scss` | add `declare module '*.module.scss'` |

## After migration

Migrate keeps the detected `spfxVersion`. To change it, edit `spfxVersion: '1.24'` and run `bun update @mbsks/rspfx-plugin`.

See [Upgrading SPFx version](./upgrading-spfx-version.md) and [../../reference/compatibility.md](../../reference/compatibility.md).
