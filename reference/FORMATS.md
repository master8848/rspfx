# SPFx Format Reference (harvested from official @microsoft packages)

Ground truth harvested from npm packages:
`@microsoft/spfx-heft-plugins@1.23.2`, `@microsoft/sp-build-web@1.23.2`,
`@microsoft/sp-webpart-base@1.23.2` (+ all sp-* 1.23.2). Never assume these
formats; if a discrepancy appears, verify against an unzipped official `.sppkg`.

## 1. Component manifest (built)

Source manifest (`src/webparts/<name>/<name>.manifest.json`) + build-time additions:

```jsonc
{
  "$schema": "https://developer.microsoft.com/json-schemas/spfx/client-side-web-part-manifest.schema.json", // REMOVED at build time
  "id": "<componentId>",
  "alias": "MyWebPartWebPart",
  "componentType": "WebPart",
  "version": "*",                    // replaced by package.json version (pre-release suffix stripped)
  "manifestVersion": 2,
  "safeWithCustomScriptDisabled": true,
  "supportedHosts": ["SharePointWebPart", "TeamsPersonalApp", "TeamsTab", "SharePointFullPage"],
  "preconfiguredEntries": [{
    "groupId": "5c31a052-22b4-4f36-8f7d-4b4d8c7c2e7a",
    "group": { "default": "Other" },
    "title": { "default": "MyWebPart" },
    "description": { "default": "..." },
    "officeFabricIconFontName": "Page",
    "properties": { "description": "..." }
  }],
  "loaderConfig": {                   // ADDED at build time
    "internalModuleBaseUrls": ["https://localhost:4321/dist/"], // debug; release: cdnBasePath or ['HTTPS://SPCLIENTSIDEASSETLIBRARY/'] or []
    "entryModuleId": "<bundleName>",  // = webpart folder name
    "scriptResources": {
      "<bundleName>": { "type": "path", "path": "<bundleName>.js" },   // or localizedPath
      "@microsoft/sp-core-library": { "type": "component", "id": "7263c7d0-1d6a-45ec-8d85-d4d1d234171b", "version": "1.23.2" },
      "@microsoft/sp-webpart-base":  { "type": "component", "id": "974a7777-0990-4136-8fa6-95d80114c2e0", "version": "1.23.2" }
    }
  }
}
```

- Localized entry: `{ "type": "localizedPath", "paths": { "default": {path,integrity}, "en-US": {...} } }`.
- `preloadComponents` (array of component ids) preserved from source (sp-webpart-base has it).
- Output file name: `<componentId>.manifest.json`. In `release/manifests/` it is the
  RELEASE variant (release base urls). In `dist/` it is the DEBUG variant.
- External (sp-*) dependency versions come from the referenced package's own manifest
  `version` field (read from node_modules at build time — do not hardcode).

## 2. Bundle format (webpack → Rspack equivalents)

Official webpack output config (harvested from WebpackConfigurationGenerator):

```js
entry: { [bundleName]: { import, library: { type: 'amd', name: '<componentId>_<version>' } } }
externals: [ 'pkg1', 'pkg2', ... ]           // package names; sp-* + config externals
output: {
  filename: '[name].js',                     // prod: '[name]_[contenthash].js'
  chunkFilename: 'chunk.[name].js',
  libraryTarget: 'amd',
  chunkLoadingGlobal: 'webpackJsonp_<uniqueName>',
  crossOriginLoading: 'anonymous',
  devtoolModuleFilenameTemplate: 'webpack:///../[resource-path]',
  hashFunction: 'md5'
}
optimization: { moduleIds: 'deterministic', sideEffects: true, removeEmptyChunks: true, avoidEntryIife: false }
```

Generated bundle head (VERIFIED with Rspack spike — byte-compatible):

```js
define('<componentId>_<version>', ["@microsoft/sp-core-library", ...], function(__external_1, ...){
 return (() => {
   // webpack runtime + modules
   // externals become: module.exports = __external_1;
```

- `define` = AMD named define; dependency names = external package names.
- `uniqueName` = single component: `<componentId>_<version>`; multiple bundles: full hash of all ids.
- publicPath: no static value; `output.publicPath: 'auto'` (Rspack equivalent of SetPublicPathCurrentScriptPlugin).

## 3. manifests.js (dev debug manifests)

File served at `https://<host>:<port>/temp/manifests.js`. Template (from ManifestsFileBuilder):

```js
(()=>{
  // ... publicPath detection from document.currentScript → e.p
  const MANIFESTS_ARRAY_PROXY = <JSON array of manifests>;   // placeholder substituted
  const a = {
    _metadata: <metadata|undefined>,
    getManifests: function() {
      // reviver: "paths" objects {l,p,s} (compressed) or normal
      // baseUrl = DEPLOYED_ASSET_PATH_OVERRIDE || e.p ; locale from ?market=/?locale=
      // sets loaderConfig.internalModuleBaseUrls = [baseUrl] if empty
    }
  };
  self.debugManifests = a;
  define([], () => a);
})();
```

Manifest array = project manifests (base urls `https://localhost:4321/dist/`) +
sp-* node_modules manifests with base urls rewritten to
`https://localhost:4321/node_modules/<pkg>/dist/` (prepended, trailing slash ensured).

## 4. .sppkg ZIP layout (JSZip, DEFLATE, level 9)

```
[Content_Types].xml
_rels/.rels                      → /AppManifest.xml
AppManifest.xml                  → <App xmlns="http://schemas.microsoft.com/sharepoint/2012/app/manifest" Name ProductID SharePointMinVersion="16.0.0.0" IsClientSideSolution="true" [Version] [SkipFeatureDeployment] [IsDomainIsolated]> <Properties>...</App>
_rels/AppManifest.xml.rels       → /feature_<featureId>.xml, /ClientSideAssets.xml, /Resources.resx
feature_<featureId>.xml          → <Feature xmlns="http://schemas.microsoft.com/sharepoint/" Title Description Id Version Scope="Web" Hidden="FALSE"/>
feature_<featureId>.xml.config.xml → <AppPartConfig ...><Id>randomUUID</Id></AppPartConfig>
_rels/feature_<featureId>.xml.rels → /feature_<featureId>.xml.config.xml, /<featureId>/WebPart_<componentId>.xml
<featureId>/WebPart_<componentId>.xml → <Elements xmlns="http://schemas.microsoft.com/sharepoint/"><ClientSideComponent Name Id ComponentManifest='{json}' Type="WebPart"/><Module Name Url="_catalogs/wp" List="113"/></Elements>
ClientSideAssets.xml             → assets feature (only when includeClientSideAssets)
ClientSideAssets.xml.config.xml  → <AppPartConfig ...><Id>randomUUID</Id></AppPartConfig>
_rels/ClientSideAssets.xml.rels  → /ClientSideAssets.xml.config.xml, /ClientSideAssets/<file>
ClientSideAssets/<file>          → bundles + assets (component JS, maps excluded)
```

- ComponentManifest JSON is stringified into the XML attribute (single-quoted, entities escaped) — see `packages/sppkg-builder/src/xml.ts:188` `buildElementsXml()`.
- With `includeClientSideAssets` (production only), every manifest `loaderConfig.internalModuleBaseUrls = ['HTTPS://SPCLIENTSIDEASSETLIBRARY/']` (SharePoint rewrites at install).
- `[Content_Types].xml` is ordered via `packages/sppkg-builder/src/xml.ts:111` `DEFAULT_CONTENT_TYPES_ORDERED` (`xml` → `text/xml`, `rels` → `application/vnd.openxmlformats-package.relationships+xml`, `webpart` → `text/xml`, `htm` → `text/html`, `html` → `text/html`, `aspx` → `text/xml`, `resx` → `text/xml`, `js` → `application/javascript`, `json` → `application/json`, `png` → `image/png`, `jpg` → `image/jpeg`, `bmp` → `image/bmp`, `gif` → `image/gif`, `txt` → `application/octet-stream`; extra extensions appended sorted via `packages/sppkg-builder/src/xml.ts:88` `CONTENT_TYPE_BY_EXTENSION`).
- `AppManifest.xml` `ProductID` is the raw `solution.id` GUID without braces (`packages/sppkg-builder/src/xml.ts:240`); `IsDomainIsolated` is emitted as `String(boolean)` when defined including `false` (`packages/sppkg-builder/src/xml.ts:258`); `DeveloperProperties` is `JSON.stringify` of 5 keys `name, websiteUrl, privacyUrl, termsOfUseUrl, mpnId` even when empty (`packages/sppkg-builder/src/xml.ts:269`); `Title` falls back to `solution.name` when `solution.title` is absent (`packages/sppkg-builder/src/xml.ts:261`); `categories` emit one `CategoryID` with comma-joined values (`packages/sppkg-builder/src/xml.ts:284`); `Screenshots` emits `Screenshot/Filename` per `metadata.screenshotPaths` (`packages/sppkg-builder/src/xml.ts:296`); `AppPartConfig` `Id` is `randomUUID()` (`packages/sppkg-builder/src/xml.ts:172`); `escapeXmlText` escapes `&quot;`/`&apos;` (`packages/sppkg-builder/src/xml.ts:31`).
- OPC package: zip root contains `[Content_Types].xml` and `_rels/.rels`; `_rels/.rels` has `Type="http://schemas.microsoft.com/sharepoint/2012/app/relationships/package-manifest"` → `Target="/AppManifest.xml"` (`packages/sppkg-builder/src/sppkg-builder.ts:239`); all relationship `Target` values are prefixed with `/` (`packages/sppkg-builder/src/xml.ts:48` `createRelationshipsXml` equivalent); `AppManifest` relationships live in `_rels/AppManifest.xml.rels`, feature relationships in `_rels/feature_<id>.xml.rels`, asset relationships in `_rels/ClientSideAssets.xml.rels`; output path from `paths.zippedPackage` (e.g. `sharepoint/solution/<name>.sppkg`) and SharePoint validates `IsValidAppPackage:true` with `Title`/`AppProductID` populated.

## 5. Dev server (serve mode, heft-era SPFx — our reference behavior)

Single HTTPS server, port from `config/serve.json` (default **4321**), hostname default `localhost`:

- `/dist/*` → compiler dev middleware output (writeToDisk: true)
- `/` → static: project root (express.static, index:false) + node_modules sp-* dist folders
- `/temp/manifests.js` → cumulative debug manifests (generated at build end)
- CORS: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: HEAD, GET, OPTIONS`,
  `Access-Control-Allow-Private-Network: true`
- `hot: true`; websocket client `wss://<host>:<port>` (webSocketURL), overlay: false
- `open: initialPage` — browser auto-opened to serve.json `initialPage`
- serve.json: `{ "initialPage": "https://{tenantdomain}/_layouts/15/workbench.aspx", "https": true, "port": 4321, "hostname": "localhost" }`
  — `{tenantdomain}` token replaced by `SPFX_SERVE_TENANT_DOMAIN` env var

Workbench URL params (SPFxDebugPageUrl):
`?debug=true&noredir=true&debugManifestsFile=<url-encoded manifests.js url>`
(URLSearchParams — debugManifestsFile is percent-encoded).

## 6. SPFx component IDs (stable across versions; version field = pkg version)

See `reference/sp-component-ids.json`. Discovered manifests are in
`node_modules/@microsoft/sp-*/dist/*.manifest.json` (read at build time; fallback to table).

## 7. package-solution.json (config input)

```jsonc
{
  "solution": {
    "name": "my-app-client-side-solution",
    "id": "<guid>",
    "version": "1.0.0.0",
    "includeClientSideAssets": true,
    "isDomainIsolated": false,
    "skipFeatureDeployment": true,
    "developer": { "name": "", "websiteUrl": "", "privacyUrl": "", "termsOfUseUrl": "", "mpnId": "Undefined-0000" },
    "metadata": { "shortDescription": {"default":"..."}, "longDescription": {"default":"..."}, "categories": [], "screenshotPaths": [] },
    "features": [{
      "title": "my-app Feature",
      "description": "A feature which activates the Client-Side WebPart named 'my-app'",
      "id": "<guid>",
      "version": "1.0.0.0",
      "assets": { "elementManifests": [], "elementFiles": [] }
    }]
  },
  "paths": { "zippedPackage": "sharepoint/solution/my-app.sppkg" }
}
```

- Features without `componentIds` get ALL components; no features → one auto feature.
- `config/serve.json`: `{ "initialPage": "...", "https": true, "port": 4321, "hostname": "localhost" }`.
- `config/write-manifests.json`: `{ "cdnBasePath": "https://cdn.contoso.com/my-app/" }` (release base urls; empty → pseudo-url).
