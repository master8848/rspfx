# Compatibility

RSPFX produces the same artifact formats as official SPFx tooling — tenants, workbenches, and app catalogs accept them without changes. Format ground truth lives in [reference/FORMATS.md](../reference/FORMATS.md) (harvested from official npm packages; provenance per section).

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

## Verified vs verified-by-reference

| Item | Status |
|---|---|
| AMD wrapper + CSS inlining + manifest bytes | Verified — parity suite builds same fixture via Rspack/Vite/Rsbuild, asserts capture line + AMD header, byte-equal manifests, no `.css` files |
| manifests.js / component schema / sppkg layout / Library / Extension | Verified — real tenant install (see [real-tenant-validation.md](real-tenant-validation.md)); provenance in [reference/FORMATS.md](../reference/FORMATS.md) |
| sp-* ids | Stable 1.20–1.23; fallback `reference/sp-component-ids.json` |

Never assume a format — on discrepancy verify against an unzipped official `.sppkg`.

## SPFx version matrix

Single source of truth: `packages/core/src/versions.ts:13` (`SPFX_VERSIONS`, `SPFX_DEFAULT_TARGET`, `SPFX_TARGETS`, `spfxNpmVersion()`). See Microsoft docs: [SPFx compatibility](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/compatibility) and [Release 1.23](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.23) ([1.22](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.22), [1.21](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.21), [1.20](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.20)).

| Target | Status | Official toolchain | Official Node | RSPFX Node | npmVersion |
|---|---|---|---|---|---|
| `1.20` | Supported | gulp + webpack | 18 / 20 | 20+ | `1.20.0` |
| `1.21` | Supported | gulp + webpack | 18 / 20 | 20+ | `1.21.0` |
| `1.22` | Supported | gulp + webpack | 18 / 20 | 20+ | `1.22.0` |
| `1.23` | Supported, default | Heft | 20.19+ / 22+ | 20+ | `1.23.0` |
| `1.24` | Preview | Heft | 20.19+ / 22+ | 20+ | `1.24.0` |

Component `version` for `"type": "component"` deps is read from `node_modules/@microsoft/sp-*/dist/*.manifest.json` at build time, fallback `reference/sp-component-ids.json`.

Pin target via `spfxVersion` in `vite.config.ts` / `rsbuild.config.ts` / `rspack.config.ts` and keep `@microsoft/sp-*` prefix equal to `spfxVersion`. See [upgrading-spfx-version.md](upgrading-spfx-version.md).

> Tip: after changing `spfxVersion`, run `bun update @mbsks/rspfx-plugin` (or `pnpm update` / `npm update` / `yarn upgrade`) `&& rspfx build` — no manifest or bundler patching needed. RSPFX adjusts `loaderConfig`, `chunkLoadingGlobal`, `manifests.js`, and `.sppkg` layout.

## RSPFX line support

Every RSPFX release supports the full `SPFxTargets` above.

| RSPFX line | `1.20` | `1.21` | `1.22` | `1.23` |
|---|---|---|---|---|
| `0.0.14` (`latest`) | ✓ | ✓ | ✓ | ✓ default |
| `0.0.13` | ✓ | ✓ | ✓ | ✓ |

History lives in [CHANGELOG.md](../CHANGELOG.md). If a future RSPFX drops a target, its `CHANGELOG.md` entry notes it and `isSpfxTarget()` rejects it.

## Node requirements

RSPFX requires Node 20+ for every target (`package.json` `engines.node >=20`). Official SPFx ranges differ per target; RSPFX normalizes to one range. `rspfx doctor` passes on Node 20/22/24. See Microsoft docs: [Set up your development environment](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/set-up-your-development-environment).

## What RSPFX handles per version

Change `spfxVersion` — artifacts adjust automatically.

| Area | What RSPFX does |
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

Official upgrades bump generator, Heft rig, and every `sp-*` pin — RSPFX keeps it in one field (`spfxVersion`) and one bump (`bun update` / `pnpm update` / `npm update` / `yarn upgrade` `@mbsks/rspfx-plugin`).

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

SPFx `1.23` deprecated the hosted workbench (retires Dec 1 2026, replaced by Debug Toolbar). RSPFX `manifests.js` + workbench URL format is unchanged.

Non-negotiables: sp-* never bundled; output naming identical to official; `.sppkg` installs via app catalog → site → workbench; dev works like official `serve`; no `webpack`/`Heft`/`gulp` in runtime output (see `ARCHITECTURE.md` §7).
