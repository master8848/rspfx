# Deployment guide

Step-by-step production deployment from build to catalog to page to Teams/Outlook. For what each command produces see [building-packages.md](building-packages.md); for scaffolding and manifest naming see [project-structure.md](project-structure.md); for Teams-specific install see [teams-outlook-install.md](teams-outlook-install.md).

## Command pipeline

```
rspfx build      → dist/ + release/manifests + release/assets   (no .sppkg)
rspfx package    → sharepoint/solution/<name>.sppkg            (implies build)
rspfx deploy     → upload .sppkg to app catalog via REST       (implies package)
```

| Command | Produces | When to use |
|---|---|---|
| `pnpm build` / `npm run build` | `dist/<bundle>.js` + `release/manifests/*.manifest.json` + `release/assets/*` | CI intermediate, bundle analysis (`rspfx analyze`) — package.json `build` script runs `rspfx build` |
| `pnpm package` / `npm run package` | `sharepoint/solution/<name>.sppkg` (DEFLATE zip) — path from `config/package-solution.json:355` `paths.zippedPackage` (default `sharepoint/solution/<name>.sppkg`) | Ship — upload the `.sppkg` |
| `rspfx package` | Same as `pnpm package` (same codepath). `rspfx package --no-build` skips compile and packages existing `release/` | Incremental packaging |
| `rspfx deploy` | Packages then `POST` to app catalog REST (`/_api/web/tenantappcatalog/Add`); bearer token `RSPFX_ACCESS_TOKEN`, catalog URL `RSPFX_APP_CATALOG_URL` or `config.deploy.appCatalogSiteUrl` | Automated upload; without token prints manual steps and exits 0 |

National clouds use the same pipeline — only the catalog hostname differs (`*.sharepoint.com` vs `*.sharepoint.cn` / `*.sharepoint.de` etc.).

## 1. Build

```sh
pnpm install --frozen-lockfile
rspfx doctor              # preflight — Node ≥20, config loads, sp-* versions match, port free
rspfx build               # minified, no sourcemap by default
# or for a debuggable staging build:
rspfx build --no-minify --sourcemap
# native bundler (identical output — plugin assembles release after prod compile):
npx rspack build --mode production
npx vite build
npx rsbuild build
```

What it emits (`packages/dev-runtime/src/release.ts:39` `assembleRelease()`):

- `dist/<bundle>.js` — AMD `define('<id>_<version>', ["@microsoft/sp-core-library",…],…)` with `webpackJsonp_<uniqueName>` chunk global; lazy `import()` → `chunk.*.js`.
- `release/manifests/<id>.manifest.json` — `version: "*"` replaced by `package.json` version (pre-release stripped), `loaderConfig.entryModuleId = bundleName`, `scriptResources` populated, `internalModuleBaseUrls` from `config/write-manifests.json` `cdnBasePath` (empty → `[]`, non-empty → `[cdnBasePath/]`).
- `release/assets/*` — copy of `dist/` (no `.map`/`.manifest.json`) for `includeClientSideAssets:true` embedding.

## 2. Package

```sh
rspfx package
# equivalent:
pnpm package

# verify:
unzip -l sharepoint/solution/<name>.sppkg | head -20
# expect: [Content_Types].xml, _rels/.rels → /AppManifest.xml, AppManifest.xml, _rels/AppManifest.xml.rels, feature_<id>.xml + .config.xml + _rels/feature_<id>.xml.rels, <featureId>/WebPart_<id>.xml (or Extension_<id>.xml), ClientSideAssets.xml + .config.xml + _rels/ClientSideAssets.xml.rels + ClientSideAssets/<bundle>.js when includeClientSideAssets
```

`.sppkg` layout (`packages/sppkg-builder/src/sppkg-builder.ts:239` `buildPackage()`, [reference/FORMATS.md](../reference/FORMATS.md) §4):

| Zip entry | Source | When |
|---|---|---|
| `[Content_Types].xml` | Generated — ordered via `packages/sppkg-builder/src/xml.ts:111` `DEFAULT_CONTENT_TYPES_ORDERED` (`xml` text/xml, `rels`, `webpart`, `htm`, `html`, `aspx`, `resx`, `js`, `json`, `png`, `jpg`, `bmp`, `gif`, `txt`) | Always |
| `_rels/.rels` → `/AppManifest.xml` | Generated | Always |
| `AppManifest.xml` + `_rels/AppManifest.xml.rels` | `config/package-solution.json` `solution.*` + `paths.zippedPackage`, plus `features` → rels, `webApiPermissionRequests` → `RequestedWebApiPermission` (`ProductID` raw GUID, `IsDomainIsolated` String(boolean), `DeveloperProperties` 5 keys, `CategoryID`, `Screenshots`) | Always |
| `feature_<featureId>.xml` + `.config.xml` + `_rels/feature_<featureId>.xml.rels` | `solution.features[]` (or auto-feature when `features` empty) — `Id` is `randomUUID()` | Always |
| `<featureId>/WebPart_<componentId>.xml` | `release/manifests/<id>.manifest.json` JSON stringified into `ComponentManifest` attribute | Always |
| `<featureId>/Extension_<componentId>.xml` | Same, for `componentType: Extension` — `Type="Extension"`, `Location="ClientSideExtension.<extensionType>"` | When extensions present |
| `ClientSideAssets.xml` + `ClientSideAssets/<bundle>.js` + `teams/*` | `release/assets/*` + `teams/` (auto-detected) rewritten with `internalModuleBaseUrls = ['HTTPS://SPCLIENTSIDEASSETLIBRARY/']` | Only when `solution.includeClientSideAssets:true` **and** production build |
| `Resources.resx` + `Resources.<lang>.resx` | `sharepoint/Resources*.resx` parsed, `"$Resources:Key"` in `solution.metadata` → `<LocalizedString CultureName="...">` per locale (`default` for `Resources.resx`) | When `sharepoint/Resources*.resx` exists |

Microsoft docs: SPFx publish overview https://learn.microsoft.com/en-us/sharepoint/dev/spfx/publish-to-marketplace-overview · Solution package https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/package-and-deploy · App catalog https://learn.microsoft.com/en-us/sharepoint/use-app-catalog

## 3. Choose catalog and `skipFeatureDeployment`

Two catalog types — upload to only one per deployment:

| Catalog | URL pattern | Scope | When |
|---|---|---|---|
| **Tenant App Catalog** | `https://{tenant}.sharepoint.com/sites/appcatalog` (admin view: `https://{tenant}-admin.sharepoint.com/_layouts/15/tenantAppCatalog.aspx`) | Every site collection can Add an app | Default — recommended |
| **Site Collection App Catalog** | `https://{tenant}.sharepoint.com/sites/<site>/_layouts/15/tenantAppCatalog.aspx` (enable via `Site Settings → Site collection features → Site Collection App Catalog` or `Set-SPOSite -EnableAppCatalog $true`) | Single site only | Isolated rollout |

`config/package-solution.json` `solution.skipFeatureDeployment`:

- `true` (scaffold default) — tenant admins see **Deploy** on upload; clicking it makes the solution **available to all sites immediately** without per-site `Add an app`. Users just add the web part to a page. Required for `Sync to Teams` to appear.
- `false` — upload creates an `Add` entry per site; each site owner must go to `Site Contents → Add an app → <solution>` before the web part appears. Use for staged rollouts.

Microsoft docs: Tenant vs site catalog https://learn.microsoft.com/en-us/sharepoint/dev/general-development/site-collection-app-catalog · `skipFeatureDeployment` https://learn.microsoft.com/en-us/sharepoint/dev/spfx/tenant-scoped-deployment · App catalog management https://learn.microsoft.com/en-us/sharepoint/use-app-catalog

## 4. Upload to app catalog

### Manual upload

1. Open the catalog site: `https://{tenant}.sharepoint.com/sites/appcatalog` → `Site Contents` → `Apps for SharePoint` (or Admin center → `SharePoint Admin Center → App Catalog → Apps for SharePoint`).
2. Drag-drop `sharepoint/solution/<name>.sppkg` (or `Upload → Choose Files`). If a previous version exists, confirm **Replace**.
3. In the enable dialog, check **Enable this app and add it to all sites** (≡ `skipFeatureDeployment:true`) and — if `webApiPermissionRequests` present — note the **API access** prompt appears later in SharePoint Admin → `API access`.
4. Click **Deploy** (or **Enable**). Catalog list shows the app as `Deployed`/`Enabled`.

PowerShell alternative (tenant-scoped):

```powershell
Connect-PnPOnline -Url https://contoso-admin.sharepoint.com -Interactive
Add-PnPApp -Path ./sharepoint/solution/my-app.sppkg -Publish -SkipFeatureDeployment -Overwrite
```

### Automated upload — `rspfx deploy`

`rspfx deploy` (`apps/cli/src/commands/deploy.ts:16`) reads:

- Catalog URL: `config.deploy.appCatalogSiteUrl` → `RSPFX_APP_CATALOG_URL` env → interactive prompt.
- Bearer token: `RSPFX_ACCESS_TOKEN` — Microsoft Entra access token with `Sites.Manage.All` (or app-catalog write) scoped to the catalog site. 120 s timeout (`AbortSignal.timeout(120_000)`).

Without a token it prints the manual steps above and exits 0 (so CI without creds still succeeds). With a token it validates the catalog URL, `POST`s the `.sppkg`, and reports `DEPLOY_TIMEOUT` on timeout.

```sh
export RSPFX_ACCESS_TOKEN='<bearer-token>'
export RSPFX_APP_CATALOG_URL='https://contoso.sharepoint.com/sites/appcatalog'
rspfx deploy

# or per-run:
RSPFX_ACCESS_TOKEN=$RSPFX_ACCESS_TOKEN RSPFX_APP_CATALOG_URL=$RSPFX_APP_CATALOG_URL rspfx deploy
```

Env vars are read in `apps/cli/src/commands/deploy.ts:16`; no `RSPFX_TENANT`/`RSPFX_USERNAME`/`RSPFX_PASSWORD` vars are implemented ([real-tenant-validation.md](real-tenant-validation.md#tenant-credential-setup)).

## 5. Approve API permissions (if any)

If `config/package-solution.json` `solution.webApiPermissionRequests` is non-empty:

```jsonc
{ "solution": { "webApiPermissionRequests": [{ "resource": "Microsoft Graph", "scope": "Sites.Read.All" }] } }
```

those entries are emitted as `RequestedWebApiPermission` in `AppManifest.xml` (`packages/sppkg-builder/src/sppkg-builder.ts:223`). After uploading:

1. Go to `https://{tenant}-admin.sharepoint.com/_layouts/15/online/AdminHome.aspx#/webApiPermissionManagement`.
2. Find the pending request for `<solution> → Microsoft Graph / Sites.Read.All` → **Approve**.

Until approved, `MSGraphClient` / `AadHttpClient` calls return 403.

Microsoft docs: webApiPermissionRequests https://learn.microsoft.com/en-us/sharepoint/dev/spfx/use-aadhttpclient · API access approval https://learn.microsoft.com/en-us/sharepoint/dev/spfx/use-aadhttpclient#manage-permission-requests

## 6. CDN considerations

| `includeClientSideAssets` | `config/write-manifests.json` `cdnBasePath` | Behavior | When |
|---|---|---|---|
| `true` (default) | `""` (empty) | Bundles embedded under `ClientSideAssets/` in `.sppkg`; packaged manifests rewrite `internalModuleBaseUrls` to `HTTPS://SPCLIENTSIDEASSETLIBRARY/` — SharePoint serves from its asset library at install time. No external CDN needed. | **Recommended** — simplest |
| `false` | `""` | No `ClientSideAssets/` in `.sppkg`; `internalModuleBaseUrls = []`; manifests keep no base URL — load fails unless you serve manually. Avoid. | — |
| `false` or `true` | `"https://cdn.contoso.com/<name>/"` | `release/manifests` `internalModuleBaseUrls = ["https://cdn.contoso.com/<name>/"]`; packaged manifests keep that URL; **upload `release/assets/*` to that CDN** under the same prefix. | Externally hosted assets (Azure Storage, CDN) |
| `true` + non-empty `cdnBasePath` | Non-empty | Same as previous — CDN URL wins; `ClientSideAssets/` still embedded but manifests point to CDN, so CDN is authoritative. | Rare |

`cdnBasePath` must end with `/` (the toolchain appends one if missing, `packages/dev-runtime/src/release.ts:118`). Schema: https://developer.microsoft.com/json-schemas/spfx-build/write-manifests.schema.json · Microsoft docs: CDN hosting https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/hosting-spfx-from-office-365-cdn · SPFx serve/hosting https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/serve-and-host-spfx-solutions

## 7. Add to site and page

After catalog **Deploy**:

1. Navigate to any site: `https://{tenant}.sharepoint.com/sites/<test>` → `Site Contents` → `Add an app` → your solution → **Add** (skip when `skipFeatureDeployment:true` — already available).
2. Edit a page (`Site Pages → New → Edit`) → `+` → search the web part by its `preconfiguredEntries[0].title` (default `<Pascal>`) → **Add**.
3. Configure properties in the property pane (e.g. `description`) → **Republish**.

Verify no console errors; bundle URLs in DevTools → `Network` should be `https://{tenant}.sharepoint.com/sites/appcatalog/ClientSideAssets/<bundle>.js` (or CDN URL).

## 8. Teams and Outlook — sync from SharePoint

When `teams/manifest.json` was present at `rspfx package` time (auto-included under `ClientSideAssets/teams/`), the catalog entry shows **Sync to Teams** (`packages/sppkg-builder/src/sppkg-builder.ts:86`).

1. In the catalog `Apps for SharePoint` list, select the app → **Sync to Teams** (or `Teams Admin Center → Manage apps → Upload` after downloading the `.sppkg`).
2. In `Teams Admin Center → Manage apps`, find the app → set **Status: Allowed** and assign a **Permission policy** that allows it.
3. Users: `Teams → Apps → Built for your org` → find the app → **Add** (personal tab) or **Add to team** (configurable tab). When `staticTabs` has `personal` scope, the same app surfaces in **new Outlook** (`Outlook → Apps → Apps built for your org`) after 10–120 min Microsoft 365 app sync — Outlook classic is not supported.

Required `teams/manifest.json` fields:

- `id` and `staticTabs[0].entityId` MUST equal the SharePoint component `id` ([project-structure.md](project-structure.md#manifest-id-and-version-must-stay-in-sync)).
- `validDomains` must include at least `*.sharepoint.com`, `*.office.com`, `*.secure.aadcdn.microsoftonline-p.com`, `*.login.microsoftonline.com`, `spoprod-a.akamaihd.net` — scaffold list at `packages/templates/src/index.ts:485`. Add `*.outlook.office.com` manually for Outlook reliability.
- `contentUrl` is `https://{teamSiteDomain}{teamSitePath}/_layouts/15/TeamsLogon.aspx?SPFX=true&dest={teamSitePath}/_layouts/15/teamshostedapp.aspx%3FopenPropertyPane=true%26teams%26componentId=<id>%26forceLocale={locale}` with `%26`-encoded `&`.

Full reference: [teams-outlook-install.md](teams-outlook-install.md) · Microsoft docs: Teams SPFx https://learn.microsoft.com/en-us/sharepoint/dev/spfx/integrate-with-teams-introduction · Sync to Teams https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/sharepoint-teams-apps · Teams manifest schema https://learn.microsoft.com/en-us/microsoftteams/platform/resources/schema/manifest-schema

## 9. Update and rollback

- **Update**: bump `package.json` `version` + `config/package-solution.json` `solution.version` (4-part) → `rspfx package` → re-upload → **Replace** → **Deploy**. Clients pick up new `ClientSideAssets/` on next page load (manifest `version: "*"` → new version).
- **Rollback**: re-upload the previous `.sppkg` version (catalog keeps one version — re-upload overwrites).
- **Remove**: catalog `Apps for SharePoint` → select → **Remove** (also clear `Recycle Bin`); Teams Admin → **Block**. Pages that used the web part show a missing-web-part placeholder.

## 10. Env vars and tokens in `config/serve.json`

`config/serve.json` string values support dotenv + shell-style expansion (`packages/dev-runtime/src/project.ts:59` `expandEnvVars()` + `loadDotEnv()`):

| Syntax | Meaning | Example |
|---|---|---|
| `${VAR}` | Replace with `process.env[VAR]` or `""` if unset | `"initialPage": "https://${MY_TENANT}/_layouts/15/workbench.aspx"` |
| `${VAR:-default}` | Default if `VAR` unset or `""` | `"initialPage": "https://${SPFX_TENANT:-contoso.sharepoint.com}/_layouts/15/workbench.aspx"` |
| `${VAR-default}` | Same as `:-` (dash variant) | `"port": "${PORT-4321}"` |
| `$VAR` | Bare-dollar interpolation | `"hostname": "$HOSTNAME"` |
| `.env` file | `KEY=VALUE` lines loaded first (no override if `process.env[KEY]` already set) | `.env: SPFX_SERVE_TENANT_DOMAIN=contoso.sharepoint.com` |

Special token (independent of env expansion, resolved at workbench URL build time in `buildWorkbenchUrl()` at `packages/dev-runtime/src/serve.ts:102`):

- `{tenantdomain}` (case-insensitive) in `initialPage` → replaced by `dev.tenantUrl` / `SPFX_SERVE_TENANT_DOMAIN` / `--tenant` value. If it remains unreplaced, `buildWorkbenchUrl()` warns and returns `undefined` (no workbench URL in that dev session).

Resolution order (see [project-structure.md](project-structure.md) table): `.env` → `expandObject()` over parsed `serve.json` JSON → `resolveServeSettings()` merges CLI `--tenant`/`--port` over `serve.json` over `dev.*` plugin options over defaults.

Microsoft docs: serve.json schema https://developer.microsoft.com/json-schemas/spfx-build/spfx-serve.schema.json · Workbench debugging https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/debugging-sharepoint-framework-solutions

## 11. CI example

```yaml
steps:
  - run: pnpm install --frozen-lockfile
  - run: rspfx doctor           # fails fast — exit 1 blocks package
  - run: rspfx package          # build + package
  - upload: sharepoint/solution/*.sppkg   # artifact for manual catalog upload
  # or automated:
  # - run: RSPFX_ACCESS_TOKEN=${{ secrets.SPFX_TOKEN }} RSPFX_APP_CATALOG_URL=https://contoso.sharepoint.com/sites/appcatalog rspfx deploy
```

Cache `node_modules` and `.rspack-cache` between runs; production builds ignore the persistent cache by design ([building-packages.md](building-packages.md#ci-usage)).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `No web part or extension bundles found` on `rspfx package` | `src/webparts/<name>/` missing `*.manifest.json` or pickable entrypoint — see [project-structure.md](project-structure.md#web-part-naming-manifest-matching-rules) |
| Bundle 404 in workbench / page (`dist/<name>.js` or `ClientSideAssets/<bundle>.js` not found) | `bundleName` ≠ emitted file: folder name vs `config.json` bundle key vs `entryModuleId` mismatch. In default layout bundleName == folder name; with explicit `bundles`, key is authoritative |
| `External 'X' could not be resolved` | `config.json` `externals` key not found as `node_modules/X/dist/*.manifest.json` — remove the key or `npm i X` |
| `Module not found: Can't resolve 'XxxWebPartStrings'` | `config.json` `localizedResources` missing or not `lib/.../{locale}.js`-shaped — pattern must contain `{locale}` (`packages/dev-runtime/src/project.ts:608` `readLocalizedAliases`) |
| `INVALID_PACKAGE_CONFIG` / `paths.zippedPackage` missing | `config/package-solution.json` must have `solution.id`, `solution.name`, `paths.zippedPackage` non-empty string (`packages/sppkg-builder/src/sppkg-builder.ts:264`) |
| Catalog **Sync to Teams** missing | `teams/` not present at `rspfx package` time, or `includeClientSideAssets:false`, or `skipFeatureDeployment:false` — verify `unzip -l .sppkg` shows `ClientSideAssets/teams/` |
| `Invalid Teams manifest` on upload | `teams/manifest.json` `id` ≠ SharePoint component `id`, or `validDomains` missing `*.sharepoint.com`, or `manifestVersion` ≠ `1.13` |
| App in Teams but not Outlook | Wait sync window (10–120 min), check `staticTabs[0].scopes` includes `personal`, use new Outlook (not classic), add `*.outlook.office.com` to `validDomains` |
| API permission 403 | `webApiPermissionRequests` not yet approved in Admin `API access` — approve per §5 |
| `DEPLOY_TIMEOUT` after 120 s | Catalog throttling or large `.sppkg` — retry; `apps/cli/src/commands/deploy.ts:62` `AbortSignal.timeout(120_000)` |
| `{tenantdomain}` literal in workbench URL | No tenant domain configured — set `dev.tenantUrl` in `rspack.config.ts`, or `SPFX_SERVE_TENANT_DOMAIN` env, or `--tenant` flag |
| `IsValidAppPackage:false, AppProductID:null, Title:null` on upload | SharePoint OPC parser rejected the package — verify `AppManifest.xml` `ProductID` is raw GUID without braces (`packages/sppkg-builder/src/xml.ts:240`), `[Content_Types].xml` `xml` is `text/xml` and `txt` is `application/octet-stream` in ordered `packages/sppkg-builder/src/xml.ts:111` `DEFAULT_CONTENT_TYPES_ORDERED`, zip root has `[Content_Types].xml` + `_rels/.rels` → `/AppManifest.xml` with `_rels/AppManifest.xml.rels` and `_rels/feature_<id>.xml.rels` targets prefixed `/` (`packages/sppkg-builder/src/sppkg-builder.ts:239`), `IsDomainIsolated` emitted even when `false`, and `DeveloperProperties`/`Screenshots`/`CategoryID` match official heft 1.23.2 (see [reference/FORMATS.md](../reference/FORMATS.md) §4); validate via `apps/playground` catalog gate `Title` `rspfx-playground-client-side-solution` `AppProductID` `22222222-2222-4222-8222-222222222200` `IsValidAppPackage:true` |

For packing internals and zip entry validation see [building-packages.md](building-packages.md#what-rspfx-package-produces) and [real-tenant-validation.md](real-tenant-validation.md#validation-checklist).
