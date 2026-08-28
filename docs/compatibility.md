# Compatibility Statement

RSPFX produces artifacts that official SPFx tooling produces — same formats, same semantics — so existing tenants, workbenches, and app catalogs accept them without changes.

Format ground truth lives in [reference/FORMATS.md](../reference/FORMATS.md), harvested from official npm packages; provenance is marked per section there.

## Guaranteed

| Artifact | Format guarantee |
|---|---|
| Debug manifests | `temp/manifests.js` matches the official template (`window.__MANIFESTS__` array + `getManifests` reviver, `self.debugManifests = a`, `define([], () => a)`); project manifests base URLs `https://localhost:4321/dist/`, sp-* manifests rewritten to `https://localhost:4321/node_modules/<pkg>/dist/` |
| Production bundle wrapper | AMD named module: `define('<componentId>_<version>', ["@microsoft/sp-core-library", ...], function(...){...})`; `chunkLoadingGlobal: webpackJsonp_<uniqueName>`; externals resolve to the named deps; output `[name].js` matches `loaderConfig.scriptResources` paths |
| Component manifest schema | `componentType`, `manifestVersion: 2`, `preconfiguredEntries`, `properties`, `safeWithCustomScriptDisabled`, `loaderConfig` with `internalModuleBaseUrls` / `entryModuleId` / `scriptResources` (`component` / `path` / `localizedPath` dependency types) |
| Library component (`componentType: Library`) | `componentType: Library`, `manifestVersion: 2`, `alias`, `version: "*"` (replaced from `package.json`), no `preconfiguredEntries`/`extensionType`, `loaderConfig` same `entryModuleId`/`scriptResources`; `.sppkg` emits `<featureId>/Library_<componentId>.xml` `Type="Library"` with single-quoted `ComponentManifest` and no `<Module>`/`Location`/`Instance` (`packages/sppkg-builder/src/xml.ts:181`, `packages/manifest-generator/src/component-manifests.ts:43`, `packages/compiler-rspack/src/config.ts:234`) |
| `.sppkg` layout | DEFLATE zip: `[Content_Types].xml` (ordered `xml` text/xml first via `packages/sppkg-builder/src/xml.ts:111`), `_rels/.rels` → `/AppManifest.xml`, `AppManifest.xml` + `_rels/AppManifest.xml.rels`, `feature_<id>.xml` + `.config.xml` + `_rels/feature_<id>.xml.rels` (slash `Target`), `<featureId>/WebPart_<componentId>.xml` with the manifest JSON stringified into the `ComponentManifest` attribute, `ClientSideAssets.xml` + `.config.xml` + `_rels/ClientSideAssets.xml.rels` + `ClientSideAssets/` files when `includeClientSideAssets` — `ProductID` raw GUID, `IsDomainIsolated` includes `false`, `DeveloperProperties` 5 keys, `CategoryID`, `Screenshots`, `AppPartConfig` `randomUUID` per [reference/FORMATS.md](../reference/FORMATS.md) §4; validated via app catalog `IsValidAppPackage:true` |
| Asset URL pseudo-URL | Production with `includeClientSideAssets`: every manifest `internalModuleBaseUrls = ['HTTPS://SPCLIENTSIDEASSETLIBRARY/']` — SharePoint rewrites at install |
| Workbench debug URL | `<tenant>/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=<percent-encoded manifests.js URL>` |
| `config/` files | `package-solution.json` (solution/features/paths), `serve.json` (`initialPage` with `{tenantdomain}` token, `https`, `port`, `hostname`), `write-manifests.json` (`cdnBasePath`) are read with official semantics |

## Verified vs. verified-by-reference

| Item | Status |
|---|---|
| AMD bundle wrapper (`define('<id>_<version>', [...])`) | **Verified** — byte-compatible for all three bundlers: the parity suite (`packages/plugin/tests/parity.test.ts`) builds the same fixture through Rspack, Vite, and Rsbuild and asserts the script-URL capture line (`(function(){window["__rspfx_script_url_<name>"]=`) + AMD define header per bundler, byte-equal manifests and release asset name sets, and no separate `.css` files (CSS is inlined into the JS bundle on every bundler). Per-bundler bundle internals still differ (Rollup vs Rspack runtime codegen) while the manifest/release structure matches byte-for-byte (see FORMATS §2) |
| manifests.js template, component manifest schema, sppkg zip layout, SPCLIENTSIDEASSETLIBRARY rewriting, workbench URL params, Library/Extension packaging | **Verified** — manifests.js/component/sppkg validated in real tenant (see [docs/real-tenant-validation.md](real-tenant-validation.md)); reference provenance in [reference/FORMATS.md](../reference/FORMATS.md) from `@microsoft/spfx-heft-plugins@1.23.2`, `sp-build-web@1.23.2`, `sp-webpart-base@1.23.2` |
| Extension (`componentType: Extension`) and Library (`componentType: Library`) | **Verified** — extension and library compile/discovery, manifests.js, and sppkg (`Extension_<id>.xml`, `Library_<id>.xml` `packages/sppkg-builder/src/xml.ts:181`) installed via app catalog and rendered in workbench; parity suite covers Library and Extension entries |
| sp-* component IDs | Stable across versions (FORMATS §6); fallback table in `reference/sp-component-ids.json` |

Rules: **never assume** a format — verify against an unzipped official `.sppkg` on any discrepancy; sp-* dependency ids/versions are harvested from the referenced package's own `node_modules` manifest at build time, never hardcoded.

## SPFx version matrix

Single source of truth: `packages/core/src/versions.ts:13` (`SPFX_VERSIONS`, `SPFX_DEFAULT_TARGET`, `SPFX_TARGETS`, `spfxNpmVersion()`).

| Target | Status | Official toolchain | Official Node | RSPFX Node | npmVersion |
|---|---|---|---|---|---|
| `1.20` | Supported | gulp + webpack | 18 / 20 | 20+ | `1.20.0` |
| `1.21` | Supported | gulp + webpack | 18 / 20 | 20+ | `1.21.0` |
| `1.22` | Supported | gulp + webpack | 18 / 20 | 20+ | `1.22.0` |
| `1.23` | Supported, default | Heft | 20.19+ / 22+ | 20+ | `1.23.0` |

SPFx `1.24` is in public preview (beta.1, July 2026; GA expected September 2026) and is **not** yet a supported target.

Component IDs for `sp-*` packages are stable across `1.20`–`1.23`; the `version` field of each `"type": "component"` entry is read from the installed `node_modules/@microsoft/sp-*/dist/*.manifest.json` at build time, with the `reference/sp-component-ids.json` table as fallback (`packages/manifest-generator/src/sp-dependencies.ts`, `packages/manifest-generator/src/data/component-ids.ts`).

Pin the target via the plugin options (`spfxVersion` in `vite.config.ts` / `rsbuild.config.ts` / `rspack.config.ts`) and keep `@microsoft/sp-*` deps in sync when you have them (`apps/cli/src/commands/doctor.ts:202` checks `sp-*` prefix `<spfxVersion>.`).

See [upgrading-spfx-version.md](upgrading-spfx-version.md) for the step-by-step upgrade, zero-install notes, and what changes per version.

## RSPFX and SPFx compatibility

Every RSPFX release supports the full `SPFxTargets` list above — there is no per-release SPFx subset.

| RSPFX line | SPFx `1.20` | `1.21` | `1.22` | `1.23` |
|---|---|---|---|---|
| `0.0.14` (`latest`) | ✅ | ✅ | ✅ | ✅ (default) |
| `0.0.13` | ✅ | ✅ | ✅ | ✅ |
| `<0.0.13` | ✅ | ✅ | ✅ | ✅ (added at `0.0.x`; `1.23` formats harvested from `1.23.2` packages) |

History lives in [CHANGELOG.md](../CHANGELOG.md) (one `## [X.Y.Z]` per version, tag `vX.Y.Z`); this matrix is current state only.

If a future RSPFX drops an old target, it will be noted in that version's `CHANGELOG.md` entry and `packages/core/src/versions.ts:13` will remove the entry so `isSpfxTarget()` rejects it.

## Node.js requirements per SPFx target

RSPFX requires Node 20+ for every SPFx target (`package.json:9` `engines.node >=20`, `apps/cli/src/commands/doctor.ts:159` checks `node >= 20`).

Official SPFx Node ranges differ per target (Heft-era `1.23` wants Node 20.19+ / 22; gulp-era `1.20`–`1.22` accepted Node 18) — RSPFX normalizes to one range so you don't switch Node when you switch `spfxVersion`.

Use any manager (`nvm`, `volta`, `fnm`) pinned to Node 20+; `rspfx doctor` passes on Node 20, 22, and 24.

For the repo itself Bun is recommended; consumers can use npm/yarn/pnpm/bun.

## What RSPFX handles automatically per SPFx version

Change `spfxVersion` — RSPFX adjusts the artifacts; you do not patch manifests or bundler config by hand.

| Area | What RSPFX does |
|---|---|
| Manifest schema (`componentType`, `manifestVersion: 2`, `preconfiguredEntries`, `loaderConfig`, `safeWithCustomScriptDisabled`) | `packages/manifest-generator/src/component-manifests.ts:80` generates `loaderConfig` (`internalModuleBaseUrls`, `entryModuleId`, `scriptResources`) matching `reference/FORMATS.md` §1 |
| CDN URLs (`write-manifests.json` `cdnBasePath` ↔ `HTTPS://SPCLIENTSIDEASSETLIBRARY/` ↔ `[]`) | `packages/dev-runtime/src/release.ts:39` `assembleRelease` reads `cdnBasePath`; `packages/sppkg-builder` rewrites to pseudo-URL when `includeClientSideAssets` (`reference/FORMATS.md` §4) |
| Bundle wrapper (`define('<id>_<version>', …)` + `chunkLoadingGlobal: webpackJsonp_<uniqueName>` + `publicPath: auto`) | `packages/compiler-rspack/src/config.ts:234` (Rspack), `packages/plugin/src/vite.ts:412` / `packages/plugin/src/rsbuild.ts:414` (Vite/Rsbuild) — verified byte-compatible per bundler in `packages/plugin/tests/parity.test.ts` |
| `manifests.js` template (`self.debugManifests`, `define([], () => a)`, `window.__MANIFESTS__`, sp-* base URL rewrite) | `packages/manifest-generator/src/manifests-js.ts` matches `reference/FORMATS.md` §3 |
| `.sppkg` ZIP layout (`AppManifest.xml`, `feature_<id>.xml`, `ClientSideAssets`, `[Content_Types].xml` ordering, rels) | `packages/sppkg-builder/src/sppkg-builder.ts:105` + `packages/sppkg-builder/src/xml.ts:111` per `reference/FORMATS.md` §4 |
| `sp-*` `id` / `version` for `"type": "component"` deps | Harvested from `node_modules/@microsoft/sp-*/dist/*.manifest.json` at build time (`packages/manifest-generator/src/sp-dependencies.ts`); fallback `reference/sp-component-ids.json` → `packages/manifest-generator/src/data/component-ids.ts` |
| Workbench debug URL (`?debug=true&noredir=true&debugManifestsFile=`) | `packages/dev-runtime/src/serve.ts:134` builds `<tenant>/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=<encoded https://localhost:4321/temp/manifests.js>` |
| Future schema / component-type changes | Added centrally in `packages/core/src/versions.ts:13` per [supporting-a-new-spfx-version.md](supporting-a-new-spfx-version.md); until added, `isSpfxTarget()` rejects unknown `spfxVersion` |

## Zero-install upgrades

Most web parts need no `@microsoft/sp-*` install — the toolchain externalizes them (`reference/FORMATS.md` §1, `packages/compiler-rspack/src/config.ts:234` `externals`) and emits `"type": "component"` so SharePoint resolves its built-in copies.

Upgrading SPFx (`1.20 → 1.23`) does not require installing new `@microsoft/sp-*` versions unless your code imports that runtime (e.g. `@microsoft/sp-http`, `@microsoft/sp-listview-extensibility`).

Official upgrades bump the generator, Heft rig, `rush-stack-compiler-*`, `spfx-heft-plugins` / `sp-build-web`, and every `sp-*` pin — RSPFX keeps the version in one field (`spfxVersion`) and one bump (`bun update @mbsks/rspfx-plugin`).

If you do have `sp-*` deps, keep their `major.minor` prefix equal to `spfxVersion` — `rspfx doctor` warns when they diverge (`apps/cli/src/commands/doctor.ts:202`) and `rspfx new` pins `spfxNpmVersion(target)` at scaffold (`packages/core/src/versions.ts:27`).

## Switching targets (consumer)

Full tutorial: [upgrading-spfx-version.md](upgrading-spfx-version.md).

One-line switch — edit the plugin options in the bundler config that your project uses (`vite.config.ts` with `rspfxVite`, `rsbuild.config.ts` with `rspfxRsbuild`, or `rspack.config.ts` with `RspfxPlugin`):

```ts
// vite.config.ts — vite.config.ts with rspfxVite
// change one value
spfxVersion: '1.23'
```

Then bump the toolchain and rebuild:

```sh
bun update @mbsks/rspfx-plugin   # or edit package.json and bun install
rspfx build                       # dist/ + release/ now targets 1.23
```

Compare official: update `@microsoft/generator-sharepoint`, `@rushstack/heft`, `@microsoft/rush-stack-compiler-*` rigs, `@microsoft/spfx-heft-plugins` / `sp-build-web`, and every `@microsoft/sp-*` pin plus `heft.json` / `rig.json` extends.

RSPFX keeps the version in one place (`packages/core/src/versions.ts:13` is the single source of truth; see [supporting-a-new-spfx-version.md](supporting-a-new-spfx-version.md) for the maintainer-side checklist).

SPFx `1.23` deprecated the hosted workbench (`workbench.aspx`); it retires December 1, 2026, replaced by the SPFx Debug Toolbar.

RSPFX dev-serve output is unaffected — it still emits the same `manifests.js` + workbench URL format.

Non-negotiables (from `ARCHITECTURE.md` §7): sp-* never bundled in production output; output naming identical to official; the `.sppkg` must install via app catalog → site collection → workbench; dev works like official `serve`; no `webpack`/`Heft`/`gulp` strings anywhere in runtime or build output.
