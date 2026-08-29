# Upgrading SPFx version

TL;DR: Switch SPFx targets by changing one field in your bundler config. Then update the toolchain and rebuild.

You keep the same manifests, bundles, and `.sppkg` flow across versions 1.20 to 1.24. See [../../reference/compatibility.md](../../reference/compatibility.md) for the version matrix.

## You may not need new `sp-*` deps

Official upgrades change many pins. RSPFx externalizes `sp-*` and SharePoint resolves its built in copies as `"type": "component"`.

For most web parts you install no new `@microsoft/sp-*`. Keep them only if your code imports that runtime, such as `@microsoft/sp-http`.

If you have `sp-*` deps, keep their `major.minor` equal to `spfxVersion`. `rspfx doctor` warns on drift.

## One line switch

Edit the plugin options in the file your project uses:

```ts
// vite.config.ts
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.24' })] };
```

```ts
// rspack.config.ts
import { RspfxPlugin, rspfxResolve } from '@mbsks/rspfx-plugin';
export default { mode: 'development', resolve: rspfxResolve(), plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react', spfxVersion: '1.24' })] };
```

```ts
// rsbuild.config.ts
import { defineConfig } from '@rsbuild/core';
import { rspfxRsbuild } from '@mbsks/rspfx-plugin';
export default defineConfig({ plugins: [rspfxRsbuild({ name: 'my-app', framework: 'react', spfxVersion: '1.24' })] });
```

Change `'1.23'` to `'1.24'`. Use a value from [../../reference/compatibility.md](../../reference/compatibility.md).

Zero config projects infer `spfxVersion` from manifests. Add a config file to pin a different target. `rspfx migrate` writes `spfxVersion` for you.

<Steps>

## Step 1: Edit `spfxVersion`

Change the single field as shown above.

## Step 2: Update toolchain

Update the RSPFx packages:

```sh
bun update @mbsks/rspfx-plugin
```

You can also edit `package.json` and run `bun install`. Use `pnpm update`, `npm update`, or `yarn upgrade` with other managers.

All `packages/*` and `apps/cli` share one version.

## Step 3: Rebuild and verify

Check setup, then build and package:

```sh
rspfx doctor
rspfx build
rspfx package
```

Inspect `sharepoint/solution/<name>.sppkg` and upload to the app catalog. No other file needs edits.

</Steps>

## What RSPFx adjusts per version

| Area | What RSPFx does |
|---|---|
| Manifest schema | emits correct `componentType`, `manifestVersion`, `loaderConfig`, and `internalModuleBaseUrls` |
| CDN base | reads `cdnBasePath` or uses `HTTPS://SPCLIENTSIDEASSETLIBRARY/` when `includeClientSideAssets` is true |
| Bundle wrapper | `define('<id>_<version>', …)` and `webpackJsonp_<uniqueName>` per bundler |
| `manifests.js` | matches official template |
| `.sppkg` ZIP | per [../../reference/architecture.md](../../reference/architecture.md) |
| `sp-*` component IDs | harvest from `node_modules` or fallback |
| Workbench URL | `/_layouts/15/workbench.aspx?debugManifestsFile=...` at `https://localhost:4321` |

## Migrate then upgrade

Do this in two commits:

```sh
npm i -g @mbsks/rspfx-cli
cd my-existing-spfx-app
rspfx migrate --dry-run
rspfx migrate --bundler vite
bun install
rspfx dev
rspfx package
# then edit spfxVersion to 1.24, bun update, rspfx build
```

Do not edit `spfxVersion` before migrate. Let migrate detect it first.

## Downgrade and pin

Downgrade the same way. Set `spfxVersion: '1.20'` and update. Commit `spfxVersion` to pin. Unknown targets fail at `rspfx new` and `migrate`.

## Troubleshoot

| Symptom | Fix |
|---|---|
| `Unknown spfx version` | use a value from [../../reference/compatibility.md](../../reference/compatibility.md) |
| `sp-*` version check fails | align pins to `spfxVersion` prefix or remove `sp-*` deps |
| `UNRESOLVED_EXTERNAL` for `sp-*` | run `bun install` or drop the externals entry |
| `entryModuleId` 404 | bundle name must equal folder `src/webparts/<name>` |
| Need old official build | `git restore . && git clean -fd .rspfx && bun install` |

For flags, see [../../reference/commands.md](../../reference/commands.md).
