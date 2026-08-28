# Upgrading the SPFx target version

Move between SPFx targets (`1.20` ↔ `1.24`) by changing one field — same manifests, bundles, and `.sppkg` flow. See Microsoft docs: [Release 1.24](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.24) ([1.23](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.23), [1.22](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.22), [1.21](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.21), [1.20](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.20)) and [SPFx compatibility](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/compatibility).

For supported targets and Node ranges see [compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix); for the maintainer checklist to add a new target see [supporting-a-new-spfx-version.md](supporting-a-new-spfx-version.md).

## Zero-install upgrades

Official upgrades require bumping `@microsoft/generator-sharepoint`, `@rushstack/heft`, `@microsoft/rush-stack-compiler-*`, `@microsoft/spfx-heft-plugins` / `sp-build-web`, and every `@microsoft/sp-*` pin.

RSPFX upgrades need no new `@microsoft/*` installs for most web parts — `sp-*` is externalized and SharePoint resolves its built-in copies as `"type": "component"`.

Install `@microsoft/sp-*` only if your code imports that runtime (e.g. `@microsoft/sp-http`).

If you do have `sp-*` deps, keep their `major.minor` equal to `spfxVersion` — `rspfx doctor` warns on mismatch.

## One-line switch

Edit the bundler plugin options — the file your project uses:

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

Change `'1.23'` → `'1.24'` (must be a value from [compatibility.md](compatibility.md)).

Zero-config projects synthesize `spfxVersion` from manifests — add a config file to pin a different target.

`rspfx migrate` writes `spfxVersion` automatically: explicit `--spfx-version` wins, else detected from `@microsoft/sp-core-library`, else default `1.24`.

> **Tip:** One field, one update, one rebuild — `spfxVersion: '1.24'` + `bun update @mbsks/rspfx-plugin` (or `pnpm update` / `npm update` / `yarn upgrade`) + `rspfx build`.

## Steps

### 1. Edit `spfxVersion`

Change the single field as above.

### 2. Update toolchain

```sh
bun update @mbsks/rspfx-plugin   # or pnpm update / npm update / yarn upgrade
# or: edit package.json then bun install / pnpm install / npm install / yarn
```

All `packages/*` + `apps/cli` share one version.

### 3. Rebuild and verify

```sh
rspfx doctor
rspfx build
rspfx package
```

Inspect `sharepoint/solution/<name>.sppkg` and upload to app catalog.

No other files need editing — `config/config.json`, `config/package-solution.json`, `src/*/*.manifest.json` stay unchanged.

## What RSPFX handles per version

Change the number — RSPFX adjusts the rest:

| Area | What happens |
|---|---|
| Manifest schema (`componentType`, `manifestVersion: 2`, `loaderConfig`) | Generated with correct `internalModuleBaseUrls`, `entryModuleId`, `scriptResources` |
| CDN base (`write-manifests.json` `cdnBasePath` vs `HTTPS://SPCLIENTSIDEASSETLIBRARY/`) | Reads `cdnBasePath`; rewrites to pseudo-URL when `includeClientSideAssets` |
| Bundle wrapper (`define('<id>_<version>', …)` + `webpackJsonp_<uniqueName>`) | Byte-compatible per bundler — see [compatibility.md](compatibility.md) |
| `manifests.js` template | Matches official template |
| `.sppkg` ZIP layout | Per [reference/FORMATS.md](../reference/FORMATS.md) |
| `sp-*` component `id` / `version` | Harvested from `node_modules` at build, fallback to `reference/sp-component-ids.json` |
| Workbench URL | `/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=…` at `https://localhost:4321` |

Details: [compatibility.md](compatibility.md) and [reference/FORMATS.md](../reference/FORMATS.md).

## Comparison vs official

| Area | Official | RSPFX |
|---|---|---|
| SPFx version | Pins in generator + Heft rig + every `sp-*` | One field `spfxVersion` |
| Node | Switch per target (18 for 1.20–1.22, 20.19+ for 1.23) | Node 20+ for all — see [compatibility.md](compatibility.md) |
| Upgrade steps | Update generator, rig, compilers, plugins, `sp-*` | `spfxVersion` + `bun update` / `pnpm update` |
| Manifests | Rewritten by generator | Auto-adjusted |

## Migrating then upgrading

If moving an existing Heft/Gulp project and changing target, do it in two commits:

```sh
npm i -g @mbsks/rspfx-cli   # or pnpm add -g / yarn global add / bun add -g / deno install -g
cd my-existing-spfx-app
rspfx migrate --dry-run
rspfx migrate --bundler vite   # or rspack | rsbuild
bun install      # or pnpm install / npm install / yarn / deno install
rspfx dev
rspfx package
# then upgrade:
# edit spfxVersion → '1.24', bun update, rspfx build
```

Do not edit `spfxVersion` before migrating — let `rspfx migrate` detect it first.

Verify:

```sh
rspfx doctor
rspfx build
rspfx package
```

## Downgrading and pinning

Downgrade the same way — set `spfxVersion: '1.20'` and `bun update` (or `pnpm update` / `npm update` / `yarn upgrade`).

Pin by committing `spfxVersion` — unknown targets are rejected at `rspfx new` / `migrate`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Unknown spfx version '1.xx'` | Must be from [compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix) |
| `sp-*` version check fails | Align `sp-*` pins to `spfxVersion` prefix or remove `sp-*` deps if not imported |
| `UNRESOLVED_EXTERNAL` for `sp-*` | `bun install` (or `pnpm` / `npm` / `yarn`) or remove the `externals` entry |
| `manifestVersion` / loader errors | `rspfx clean` then `rspfx package` |
| `entryModuleId` 404 in workbench (`https://localhost:4321/dist/...` not found) | Bundle name ≠ `entryModuleId` — folder `src/webparts/<name>` == bundle key — see [project-structure.md](project-structure.md) |
| Need previous official build | `git restore . && git clean -fd .rspfx && bun install` (or `pnpm` / `npm` / `yarn`) or `rspfx migrate --revert` |
