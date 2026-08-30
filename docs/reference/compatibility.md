# Compatibility

RSPFx produces the same artifact formats as official SPFx tooling — tenants, workbenches, and app catalogs accept them without changes. Format ground truth lives in [reference/FORMATS.md](../reference/FORMATS.md) (harvested from official npm packages; provenance per section).

## Guaranteed

| Artifact | Format guarantee |
|---|---|
| Debug manifests | `temp/manifests.js` (`window.__MANIFESTS__` + `getManifests` reviver, `self.debugManifests = a`, `define([], () => a)`); project manifests `https://localhost:4321/dist/`, sp-* `https://localhost:4321/node_modules/<pkg>/dist/` |
| Bundle wrapper | AMD `define('<componentId>_<version>', ["@microsoft/sp-core-library", ...], function(...){...})`, `chunkLoadingGlobal: webpackJsonp_<uniqueName>`, output `[name].js` matches `loaderConfig.scriptResources` |
| Component manifest | `componentType`, `manifestVersion: 2`, `preconfiguredEntries`, `properties`, `safeWithCustomScriptDisabled`, `loaderConfig` with `internalModuleBaseUrls` / `entryModuleId` / `scriptResources` (`component` / `path` / `localizedPath`) |
| Library (`componentType: Library`) | `alias`, `version: "*"`, no `preconfiguredEntries`/`extensionType`, `loaderConfig` same shape; `.sppkg` emits `Library_<id>.xml` `Type="Library"` single-quoted, no `Module`/`Location`/`Instance` |
| `.sppkg` layout | DEFLATE zip: `[Content_Types].xml` (`xml` first), `_rels/.rels` → `/AppManifest.xml`, `AppManifest.xml` + rels, `feature_<id>.xml` + `.config.xml` + rels, `<featureId>/WebPart_<id>.xml` (manifest JSON in `ComponentManifest` attr), `ClientSideAssets.xml` + `ClientSideAssets/` when `includeClientSideAssets` — `ProductID` raw GUID, `IsDomainIsolated` includes `false`, per [reference/FORMATS.md](../reference/FORMATS.md) §4 |
| Asset URL | `includeClientSideAssets`: `internalModuleBaseUrls = ['HTTPS://SPCLIENTSIDEASSETLIBRARY/']` |
| Workbench URL | `<tenant>/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=<encoded https://localhost:4321/temp/manifests.js>` |
| `config/` files | `package-solution.json`, `serve.json` (`initialPage` with `{tenantdomain}`), `write-manifests.json` (`cdnBasePath`) — official semantics |

## Verification

| Item | Status |
|---|---|
| AMD wrapper + CSS inlining + manifest bytes | Verified — parity suite builds same fixture via Rspack/Vite/Rsbuild, asserts capture line + AMD header, byte-equal manifests, no `.css` files |
| manifests.js / component schema / sppkg layout / Library / Extension | Verified — real tenant install (see [real-tenant-validation.md](real-tenant-validation.md)); provenance in [reference/FORMATS.md](../reference/FORMATS.md) |
| sp-* ids | Stable 1.20–1.24; fallback `reference/sp-component-ids.json` |

Never assume a format — on discrepancy verify against an unzipped official `.sppkg`.

## SPFx version matrix

Single source of truth: `packages/core/src/versions.ts:13` (`SPFX_VERSIONS`, `SPFX_DEFAULT_TARGET`, `SPFX_TARGETS`, `spfxNpmVersion()`). See Microsoft docs: [SPFx compatibility](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/compatibility) and [Release 1.23](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.23) ([1.22](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.22), [1.21](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.21), [1.20](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.20)).

| Target | Status | Official toolchain | Official Node | RSPFx Node | npmVersion |
|---|---|---|---|---|---|
| `1.20` | Supported | gulp + webpack | 18 / 20 | 20+ | `1.20.0` |
| `1.21` | Supported | gulp + webpack | 18 / 20 | 20+ | `1.21.0` |
| `1.22` | Supported | gulp + webpack | 18 / 20 | 20+ | `1.22.0` |
| `1.23` | Supported, default | Heft | 20.19+ / 22+ | 20+ | `1.23.0` |
| `1.24` | Preview | Heft | 20.19+ / 22+ | 20+ | `1.24.0` |
| `1.14`–`1.19` | Dev-only (planned) | gulp + webpack | 16 / 18 | 20+ | — |

Component `version` for `"type": "component"` deps is read from `node_modules/@microsoft/sp-*/dist/*.manifest.json` at build time, fallback `reference/sp-component-ids.json`.

Pin target via `spfxVersion` in `vite.config.ts` / `rsbuild.config.ts` / `rspack.config.ts` and keep `@microsoft/sp-*` prefix equal to `spfxVersion`. See [upgrading-spfx-version.md](upgrading-spfx-version.md).

SPFx `1.14`–`1.19` dev-only support is planned: `rspfx dev` (local preview + workbench) via `@mbsks/rspfx-plugin-dev`; build/package stay on the official toolchain until promoted.

> Tip: after changing `spfxVersion`, run `bun update @mbsks/rspfx-plugin` (or `pnpm update` / `npm update` / `yarn upgrade`) `&& rspfx build` — no manifest or bundler patching needed. RSPFx adjusts `loaderConfig`, `chunkLoadingGlobal`, `manifests.js`, and `.sppkg` layout.

## RSPFx line support

Every RSPFx release supports the full `SPFxTargets` above.

| RSPFx line | `1.20` | `1.21` | `1.22` | `1.23` |
|---|---|---|---|---|
| `0.0.14` (`latest`) | ✓ | ✓ | ✓ | ✓ default |
| `0.0.13` | ✓ | ✓ | ✓ | ✓ |

History lives in [CHANGELOG.md](../CHANGELOG.md). If a future RSPFx drops a target, its `CHANGELOG.md` entry notes it and `isSpfxTarget()` rejects it.

## Node requirements

RSPFx requires Node 20+ for every target (`package.json:8` `engines.node >=20`). Official SPFx ranges differ per target; RSPFx normalizes to one range. `rspfx doctor` (`apps/cli/src/commands/doctor.ts:159`) passes on Node 20/22/24 and fails on 14/16/18. See Microsoft docs: [Set up your development environment](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/set-up-your-development-environment).

### Vite Node matrix

`@mbsks/rspfx-plugin` (`packages/plugin/package.json:43`) `devDependencies` `vite ^5.4.0 || ^7 || ^8` and `peerDependencies` `vite ^5 || ^6 || ^7 || ^8` (`packages/plugin-dev/package.json:38` same); framework peers (`@vitejs/plugin-react`, etc.) require `vite ^7 || ^8`.

| Vite (npm) | Bundler | Official `engines.node` | RSPFx `doctor` | Use with RSPFx |
|---|---|---|---|---|
| `5.4.21` (`package.json:39` root) | Rollup 4 | `^18.0.0 \|\| >=20` | ✓ 20+ | Default, works on 20+ |
| `6.x` | Rollup | `^18 \|\| >=20` | ✓ 20+ | Allowed via peer `^6` |
| `7.3.6` (example `vite@7`) | Rollup 4 | `^20.19.0 \|\| >=22.12.0` | ✓ 20.19+/22+ | Requires 20.19+ |
| `8.2.2` (plugin self + `vite@8`) | Rolldown 1.2.4 | `^20.19.0 \|\| >=22.12.0` | ✓ 20.19+/22+ (warns on 20.0) | Requires 20.19+, ideal 22 LTS |

`packages/plugin/src/vite.ts:55` `getViteVersion`/`getViteMajor`/`isVite8OrLater` branches Rollup (`output.format:'amd'`) vs Rolldown (`format:'es'` → `esToAmd` in `transformEntryBundle:391`).

Node 14/16 cannot run Vite 5+ (`vite` `engines` fails, `jiti`/`selfsigned` in `packages/manifest-server/src/index.ts:132` need `node:fs/promises`, `AsyncLocalStorage`).

### Older SPFx Node history (official) vs RSPFx

Official SPFx used lower Nodes per era; RSPFx always requires Node 20+ even when serving older targets via `spfxVersion` or dev-only hybrid (`apps/cli/src/commands/dev.ts:60` `detectOfficialProject`).

| Era | SPFx | Official toolchain | Official Node | RSPFx Node | Notes |
|---|---|---|---|---|---|
| 2017–2019 | `1.1`–`1.8` | gulp + webpack 3/4 | `8` / `10` | 20+ (dev-only, not build) | `rush-stack-compiler-2.x/3.0` |
| 2020 | `1.9`–`1.10` | gulp + webpack 4 | `10` / `12` | 20+ dev-only | `rush-stack-compiler-3.3` |
| 2021 | `1.11` (`spfx-2021-contoso-tracker`) | gulp + webpack 4 | `12` / `14` | 20+ dev-only | `rush-stack-compiler-3.9`, `node@14.20.0` reported fails with `builtin:vite-transform` `Tsconfig not found .../includes/base.json` |
| 2021–2022 | `1.12`–`1.14` | gulp + webpack 5 (heft preview) | `14` / `16` | 20+ dev-only | `rush-stack-compiler-3.9/4.1` |
| 2022–2023 | `1.15`–`1.19` | gulp + webpack 5 / Heft | `16` / `18` | 20+ dev-only (planned `1.14`–`1.19`) | `heft.json`, `rig` extends |
| 2023+ | `1.20`–`1.24` | gulp/Heft as above | `18/20` or `20.19+/22+` | 20+ (`0.0.14` `latest`) | Full build+dev support |

If you must keep Node 14/16 for an unmigrated `1.11`–`1.19` gulp project, keep the official toolchain for `gulp bundle && gulp package-solution`; use `nvm`/`volta` with Node 20+ only for `vite dev` (`@mbsks/rspfx-plugin-dev` `packages/plugin-dev/src/vite.ts:80` `checkNodeVersion`) or `rspfx dev` hybrid (`docs/hybrid-dev.md:1`). `rspfx migrate` (`apps/cli/src/commands/migrate.ts:546`) relaxes `engines.node` to `>=20` and rewrites `tsconfig.json` (`packages/templates/src/index.ts:223`) that extends `rush-stack-compiler` to plain config.

Vite config ESM: Vite 8 `configLoader: 'native'` warns `ESM syntax in a file loaded as CommonJS (vite.config.ts:1:1)` when `vite.config.ts` uses `import` but `package.json` lacks `"type":"module"` — rename to `vite.config.mts`/`vite.config.mjs` or add `"type":"module"` (`packages/plugin-dev/src/vite.ts:100` `checkViteConfigEsm`).

Use `nvm use 20` / `volta pin node@20` before `rspfx doctor`; pin CI to `node:20` or `node:22`.

## What RSPFx handles per version

Change `spfxVersion` — artifacts adjust automatically.

| Area | What RSPFx does |
|---|---|
| Manifest schema | Generates `loaderConfig` per [reference/FORMATS.md](../reference/FORMATS.md) §1 |
| CDN URLs | Reads `cdnBasePath`; rewrites to pseudo-URL when `includeClientSideAssets` |
| Bundle wrapper | `define('<id>_<version>', …)` + `chunkLoadingGlobal` — verified per bundler |
| `manifests.js` | Matches template §3 |
| `.sppkg` layout | Per §4 |
| sp-* `id`/`version` | Harvested at build time |
| Workbench URL | `?debug=true&noredir=true&debugManifestsFile=` |

## Zero-install upgrades

Most web parts need no `@microsoft/sp-*` — externalized and SharePoint resolves `"type": "component"`.

Upgrading `1.20 → 1.23` needs no new `sp-*` unless your code imports that runtime.

Official upgrades bump generator, Heft rig, and every `sp-*` pin — RSPFx keeps it in one field (`spfxVersion`) and one bump (`bun update` / `pnpm update` / `npm update` / `yarn upgrade` `@mbsks/rspfx-plugin`).

Keep `major.minor` of any installed `sp-*` equal to `spfxVersion` — `rspfx doctor` warns on drift.

## Switching targets

```ts
// vite.config.ts with rspfxVite
spfxVersion: '1.23'
```

```sh
bun update @mbsks/rspfx-plugin   # or pnpm update / npm update / yarn upgrade
rspfx build
```

Full tutorial: [upgrading-spfx-version.md](upgrading-spfx-version.md).

SPFx `1.23` deprecated the hosted workbench (retires Dec 1 2026, replaced by Debug Toolbar). RSPFx `manifests.js` + workbench URL format is unchanged.

Non-negotiables: sp-* never bundled; output naming identical to official; `.sppkg` installs via app catalog → site → workbench; dev works like official `serve`; no `webpack`/`Heft`/`gulp` in runtime output (see `ARCHITECTURE.md` §7).
