# Compatibility Statement

RSPFX produces artifacts that official SPFx tooling produces — same formats, same
semantics — so existing tenants, workbenches, and app catalogs accept them without
changes. Format ground truth lives in [reference/FORMATS.md](../reference/FORMATS.md),
harvested from official npm packages; provenance is marked per section there.

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

Rules: **never assume** a format — verify against an unzipped official `.sppkg`
on any discrepancy; sp-* dependency ids/versions are harvested from the
referenced package's own `node_modules` manifest at build time, never hardcoded.

## SPFx version matrix

| Target | Status |
|---|---|
| 1.20 | Supported — component IDs stable across versions; versions come from `node_modules` |
| 1.21 | Supported — same |
| 1.22 | Supported — same |
| 1.23 | Supported, default — Heft-era; formats unchanged (verified-by-reference from 1.23.2 packages) |

Component IDs for sp-* packages are stable across 1.20–1.23; the `version`
field of each `"type": "component"` entry is read from the installed
`node_modules/@microsoft/sp-*/dist/*.manifest.json` at build time, with the
`reference/sp-component-ids.json` table as fallback. Pin the target via the
plugin options (`spfxVersion` in `rspack.config.ts` / `vite.config.ts`) and
keep `@microsoft/sp-*` deps in sync.

SPFx 1.24 is in public preview (beta.1, July 2026; GA expected September 2026)
and is **not** yet a supported target. The matrix above is defined in
`packages/core/src/versions.ts` (single source of truth, `SPFX_VERSIONS`); see
[docs/supporting-a-new-spfx-version.md](supporting-a-new-spfx-version.md) for
the process of adding a new target, [roadblocks.md](roadblocks.md) for takeover blockers, and [real-tenant-validation.md](real-tenant-validation.md) for the tenant gate validation steps.

SPFx 1.23 deprecated the hosted workbench (`workbench.aspx`); it retires
December 1, 2026, replaced by the SPFx Debug Toolbar. RSPFX dev-serve output is
unaffected — it still emits the same `manifests.js` + workbench URL format.

Non-negotiables (from ARCHITECTURE.md §7): sp-* never bundled in production
output; output naming identical to official; the `.sppkg` must install via app
catalog → site collection → workbench; dev works like official `serve`; no
webpack/Heft/gulp strings anywhere in runtime or build output.
