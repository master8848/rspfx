# Compatibility Statement

RSPFX produces artifacts that official SPFx tooling produces — same formats, same
semantics — so existing tenants, workbenches, and app catalogs accept them without
changes. Format ground truth lives in [reference/FORMATS.md](../../reference/FORMATS.md),
harvested from official npm packages; provenance is marked per section there.

## Guaranteed

| Artifact | Format guarantee |
|---|---|
| Debug manifests | `temp/manifests.js` matches the official template (`window.__MANIFESTS__` array + `getManifests` reviver, `self.debugManifests = a`, `define([], () => a)`); project manifests base URLs `https://localhost:4321/dist/`, sp-* manifests rewritten to `https://localhost:4321/node_modules/<pkg>/dist/` |
| Production bundle wrapper | AMD named module: `define('<componentId>_<version>', ["@microsoft/sp-core-library", ...], function(...){...})`; `chunkLoadingGlobal: webpackJsonp_<uniqueName>`; externals resolve to the named deps; output `[name].js` matches `loaderConfig.scriptResources` paths |
| Component manifest schema | `componentType`, `manifestVersion: 2`, `preconfiguredEntries`, `properties`, `safeWithCustomScriptDisabled`, `loaderConfig` with `internalModuleBaseUrls` / `entryModuleId` / `scriptResources` (`component` / `path` / `localizedPath` dependency types) |
| `.sppkg` layout | DEFLATE zip: `[Content_Types].xml`, `_rels/.rels`, `AppManifest.xml` (+rels), `feature_<id>.xml` (+`.config.xml`, +`.rels`), `<featureId>/WebPart_<componentId>.xml` with the manifest JSON stringified into the `ComponentManifest` attribute, `ClientSideAssets.xml` feature + `ClientSideAssets/` files when `includeClientSideAssets` |
| Asset URL pseudo-URL | Production with `includeClientSideAssets`: every manifest `internalModuleBaseUrls = ['HTTPS://SPCLIENTSIDEASSETLIBRARY/']` — SharePoint rewrites at install |
| Workbench debug URL | `<tenant>/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=<percent-encoded manifests.js URL>` |
| `config/` files | `package-solution.json` (solution/features/paths), `serve.json` (`initialPage` with `{tenantdomain}` token, `https`, `port`, `hostname`), `write-manifests.json` (`cdnBasePath`) are read with official semantics |

## Verified vs. verified-by-reference

| Item | Status |
|---|---|
| AMD bundle wrapper (`define('<id>_<version>', [...])`) | **Verified** — byte-compatible with the Rspack spike (see FORMATS §2) |
| manifests.js template, component manifest schema, sppkg zip layout, SPCLIENTSIDEASSETLIBRARY rewriting, workbench URL params | **Verified by reference** — captured from `@microsoft/spfx-heft-plugins@1.23.2`, `sp-build-web@1.23.2`, `sp-webpart-base@1.23.2` npm packages (see provenance in FORMATS.md); final acceptance is a real-tenant install (M1 gate) |
| sp-* component IDs | Stable across versions (FORMATS §6); fallback table in `reference/sp-component-ids.json` |

Rules: **never assume** a format — verify against an unzipped official `.sppkg`
on any discrepancy; sp-* dependency ids/versions are harvested from the
referenced package's own `node_modules` manifest at build time, never hardcoded.

## SPFx version matrix

| Target | Status |
|---|---|
| 1.20 | Supported — component IDs stable across versions; versions come from `node_modules` |
| 1.21 | Supported — same |
| 1.22 | Supported, default — same |

Component IDs for sp-* packages are stable across 1.20/1.21/1.22; the `version`
field of each `"type": "component"` entry is read from the installed
`node_modules/@microsoft/sp-*/dist/*.manifest.json` at build time, with the
`reference/sp-component-ids.json` table as fallback. Pin the target in
`rspfx.config.ts` (`spfxVersion`) and keep `@microsoft/sp-*` deps in sync.

Non-negotiables (from ARCHITECTURE.md §7): sp-* never bundled in production
output; output naming identical to official; the `.sppkg` must install via app
catalog → site collection → workbench; dev works like official `serve`; no
webpack/Heft/gulp strings anywhere in runtime or build output.
