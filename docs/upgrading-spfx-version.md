# Upgrading the SPFx target version

Use one field to move between SPFx targets (`1.20 ↔ 1.23`) and keep the same manifests, bundles, and `.sppkg` flow.

This is a tutorial — for the supported targets and guarantees see [compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix) and for the maintainer procedure to add a new target see [supporting-a-new-spfx-version.md](supporting-a-new-spfx-version.md).

## Zero-install upgrades

Official SPFx upgrades require updating `@microsoft/generator-sharepoint`, `@rushstack/heft`, `@microsoft/rush-stack-compiler-*`, `@microsoft/spfx-heft-plugins` / `sp-build-web`, and every `@microsoft/sp-*` pin plus `heft.json` / `rig.json` extends.

RSPFX upgrades require no new `@microsoft/*` installs for most web parts.

`@microsoft/sp-*` is externalized — the toolchain never bundles it and SharePoint resolves its built-in copies via `"type": "component"` (`reference/FORMATS.md` §1, `packages/manifest-generator/src/component-manifests.ts:130`).

You only install `@microsoft/sp-*` if your code imports that runtime (e.g. `import { SPHttpClient } from '@microsoft/sp-http'`).

## Step-by-step: change spfxVersion

The version lives in one place — the bundler plugin options (`packages/core/src/versions.ts:13` is the single source of truth, `SPFX_TARGETS` = `1.20`, `1.21`, `1.22`, `1.23`, default `1.23`).

### 1. Edit the plugin options

Pick the file your project uses — `vite.config.ts` / `rsbuild.config.ts` / `rspack.config.ts`:

```ts
// vite.config.ts
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.23' })] };
```

```ts
// rspack.config.ts
import { RspfxPlugin, rspfxResolve } from '@mbsks/rspfx-plugin';
export default { mode: 'development', resolve: rspfxResolve(), plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react', spfxVersion: '1.23' })] };
```

```ts
// rsbuild.config.ts
import { defineConfig } from '@rsbuild/core';
import { rspfxRsbuild } from '@mbsks/rspfx-plugin';
export default defineConfig({ plugins: [rspfxRsbuild({ name: 'my-app', framework: 'react', spfxVersion: '1.23' })] });
```

Change `'1.22'` to `'1.23'` (or any value from `SPFX_TARGETS`).

If your project has no bundler config (zero-config), the CLI synthesizes `spfxVersion` from `config/config.json` + `package.json` and runs Vite, Rsbuild, or Rspack directly — add a config file with `spfxVersion` to pin a different target, or keep zero-config to stay on the default.

`rspfx migrate` writes `spfxVersion` for you: explicit `--spfx-version 1.23` wins, otherwise it detects `1.x` from `@microsoft/sp-core-library` in `package.json`, otherwise falls back to `SPFX_DEFAULT_TARGET` (`apps/cli/src/commands/migrate.ts:351`).

### 2. Update the RSPFX toolchain

```sh
bun update @mbsks/rspfx-plugin
# or: edit package.json then bun install / npm install / pnpm install
```

All `packages/*` + `apps/cli` share one version (`package.json:3`, `scripts/publish.mjs:17`).

You do not need to edit `@microsoft/sp-*` versions unless your code imports them — see [Zero-install upgrades](#zero-install-upgrades).

If you do have `sp-*` deps (e.g. `@microsoft/sp-http`), keep them in sync with `spfxVersion`: `spfxVersion: '1.23'` expects `1.23.x` pins (`apps/cli/src/commands/doctor.ts:202` checks `sp-*` prefix `<spfxVersion>.`).

`rspfx new` pins `sp-*` to `spfxNpmVersion(target)` at scaffold time (`packages/templates` via `packages/core/src/versions.ts:27`).

### 3. Rebuild and verify

```sh
rspfx doctor
rspfx build
rspfx package
```

`rspfx doctor` validates Node 20+, `spfxVersion` / `sp-*` prefix, framework package, ports, and certs (`apps/cli/src/commands/doctor.ts:28`).

`rspfx build` emits `dist/<bundle>.js` with `define('<id>_<version>', …)` (`packages/compiler-rspack/src/config.ts:234`) and `release/manifests/*.manifest.json` with harvested `id`/`version` per external.

Inspect `sharepoint/solution/<name>.sppkg` and upload to the app catalog — see [compatibility.md](compatibility.md) and [building-packages.md](building-packages.md).

No other files need hand-editing — `config/config.json` entrypoints, `config/package-solution.json`, and `src/*/*.manifest.json` stay unchanged.

## What RSPFX handles automatically per version

You change the number — RSPFX adjusts the artifacts (verified against `reference/FORMATS.md` harvested from `@microsoft/spfx-heft-plugins@1.23.2`, `sp-build-web@1.23.2`, `sp-webpart-base@1.23.2`):

| Area | Handled | How |
|---|---|---|
| Manifest schema (`componentType`, `manifestVersion: 2`, `preconfiguredEntries`, `loaderConfig`, `safeWithCustomScriptDisabled`) | Yes | `packages/manifest-generator/src/component-manifests.ts:80` preserves/adds `loaderConfig` (`internalModuleBaseUrls`, `entryModuleId`, `scriptResources`) |
| `loaderConfig` CDN base (`write-manifests.json` `cdnBasePath` vs `HTTPS://SPCLIENTSIDEASSETLIBRARY/` vs `[]`) | Yes | `packages/dev-runtime/src/release.ts:39` `assembleRelease` reads `cdnBasePath`; `packages/sppkg-builder` rewrites to pseudo-URL when `includeClientSideAssets` |
| Bundle wrapper `define('<id>_<version>', …)` + `chunkLoadingGlobal: webpackJsonp_<uniqueName>` + `publicPath: auto` | Yes | `packages/compiler-rspack/src/config.ts:234` and `packages/plugin/src/vite.ts:412`, `packages/plugin/src/rsbuild.ts:414` emit byte-compatible headers per bundler (`packages/plugin/tests/parity.test.ts`) |
| `manifests.js` template (`self.debugManifests`, `define([], () => a)`, `window.__MANIFESTS__`) | Yes | `packages/manifest-generator/src/manifests-js.ts` matches official template (`reference/FORMATS.md` §3) |
| `.sppkg` ZIP layout (`AppManifest.xml`, `feature_<id>.xml`, `ClientSideAssets`, `Content_Types`, rels) | Yes | `packages/sppkg-builder/src/sppkg-builder.ts:105` + `packages/sppkg-builder/src/xml.ts:111` per `reference/FORMATS.md` §4 |
| `sp-*` component `id` / `version` for `"type": "component"` deps | Yes | Harvested at build time from `node_modules/@microsoft/sp-*/dist/*.manifest.json` (`packages/manifest-generator/src/sp-dependencies.ts`), fallback `reference/sp-component-ids.json` + `packages/manifest-generator/src/data/component-ids.ts` — stable across `1.20`–`1.23` |
| Workbench debug URL (`debugManifestsFile` + `noredir`) | Yes | `packages/dev-runtime/src/serve.ts:134` builds `/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=…` |
| New component types / schema additions (future targets) | On target addition | New targets are added in `packages/core/src/versions.ts:13` (one entry) per [supporting-a-new-spfx-version.md](supporting-a-new-spfx-version.md); until then `isSpfxTarget()` rejects unknown `spfxVersion` |

You never hardcode sp-* `id`/`version` — the fallback table is only for projects without `sp-*` installed.

## Node.js requirements per SPFx target

| SPFx target | Official toolchain Node | RSPFX Node |
|---|---|---|
| `1.20` | Node 18 / 20 (gulp + webpack) | Node 20+ |
| `1.21` | Node 18 / 20 (gulp) | Node 20+ |
| `1.22` | Node 18 / 20 (gulp) | Node 20+ |
| `1.23` | Node 20.19+ / 22+ (Heft) | Node 20+ |

RSPFX normalizes to Node 20+ for every target (`package.json:9` `engines.node >=20`, `apps/cli/src/commands/doctor.ts:159` `node >= 20`).

You do not need to switch Node when you switch `spfxVersion` — keep Node 20+ and Bun/npm/yarn/pnpm as you prefer.

If you use `nvm`/`volta`, pin Node 20+ in `.nvmrc` / `volta` and `rspfx doctor` will pass.

## Migrating from official SPFx, then upgrading

Moving an existing Heft/Gulp project and then changing its SPFx target is two steps — migrate first, upgrade second.

### 1. Migrate the project

```sh
npm i -g @mbsks/rspfx-cli
cd my-existing-spfx-app
rspfx migrate --dry-run
rspfx migrate --bundler vite   # or --bundler rspack | --bundler rsbuild
bun install
rspfx dev
rspfx package
```

`rspfx migrate` rewrites `config/config.json` entrypoints `./lib/…WebPart.js` → `./src/…WebPart.ts`, drops Heft/gulp/webpack devDeps, adds `@mbsks/rspfx-plugin` and `rspfx` scripts, deletes `config/rig.json` / `config/typescript.json` / `config/sass.json` / `config/deploy-azure-storage.json` / `config/spfx-customize-webpack.js`, backs up to `.rspfx/migrate-backup.json`, and writes `vite.config.ts` with detected `spfxVersion` (`apps/cli/src/commands/migrate.ts:351`).

See [migrating-from-gulp-heft.md](migrating-from-gulp-heft.md) for the full checklist, `pkg:` SCSS rewrites, and `rspfx migrate --revert` / `git restore` to undo; see [migration-from-spfx.md](migration-from-spfx.md) for the short overview and [migration-case-study.md](migration-case-study.md) for a real 4-web-part migration.

Keep `gulpfile.js` + `config/rig.json` alongside `vite.config.ts` if you want dual-toolchain switching (`config/config.json`, `config/package-solution.json`, `src/*/*.manifest.json` stay shared).

### 2. Upgrade the SPFx target

Follow [Step-by-step: change spfxVersion](#step-by-step-change-spfxversion) above — edit `spfxVersion` in the generated config, `bun update`, `rspfx build`.

Do not edit `spfxVersion` before migrating — let `rspfx migrate` detect it first, then upgrade in a second commit so `git diff` stays reviewable.

### 3. Verify after both steps

```sh
rspfx doctor
rspfx build
rspfx package
# upload sharepoint/solution/<name>.sppkg to app catalog → site → workbench
```

`rspfx doctor` warns when `sp-*` pins disagree with `spfxVersion` (`apps/cli/src/commands/doctor.ts:202`).

## Downgrading and pinning

Downgrade the same way — set `spfxVersion: '1.20'` and `bun update`.

Pin a project to an older target by committing `spfxVersion` — the value is authoritative; `RSPFX_TARGETS` validation rejects unknown targets at `rspfx new` / `rspfx migrate` (`apps/cli/src/commands/new.ts:98`, `apps/cli/src/commands/migrate.ts:214`, `packages/core/src/versions.ts:23`).

## Troubleshooting version upgrades

| Symptom | Cause / fix |
|---|---|
| `Unknown spfx version '1.xx'` | `spfxVersion` must be one of `SPFX_TARGETS` (`packages/core/src/versions.ts:13`) — see [compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix) |
| `sp-* dependency versions` check fails in `rspfx doctor` | Installed `@microsoft/sp-*` prefix `<spfxVersion>.` mismatches `spfxVersion` — align the pins or remove the `sp-*` deps if you don't import them (`apps/cli/src/commands/doctor.ts:202`) |
| `UNRESOLVED_EXTERNAL` for `@microsoft/sp-…` | Project has `sp-*` dep but no manifest under `node_modules/<pkg>/dist/*.manifest.json` and not in `reference/sp-component-ids.json` — `bun install` or remove the `externals` entry |
| `manifestVersion` / loader errors at install | Old `.sppkg` cached — `rspfx clean` then `rspfx package` |
| `entryModuleId` 404 in workbench (`<bundle>.js` not found) | Bundle name ≠ `entryModuleId` — default layout requires folder `src/webparts/<name>` == bundle key; see [project-structure.md](project-structure.md) |
| Need the previous official build after an upgrade | `git restore . && git clean -fd .rspfx && bun install` or `rspfx migrate --revert` when `gulpfile.js` is still present |

For adding a brand-new SPFx version to RSPFX itself (maintainer-side), follow [supporting-a-new-spfx-version.md](supporting-a-new-spfx-version.md).
