# Deployment guide

From build to app catalog to page to Teams/Outlook.

Build outputs are covered in [building-packages.md](building-packages.md); ZIP layout in [reference/FORMATS.md](../reference/FORMATS.md); file paths in [project-structure.md](project-structure.md).

## Pipeline

```
rspfx build     → dist/ + release/manifests + release/assets   (no .sppkg)
rspfx package   → sharepoint/solution/<name>.sppkg            (implies build)
rspfx deploy    → upload .sppkg to app catalog via REST        (implies package)
```

| Command | Produces | When |
|---|---|---|
| `bun run build` / `rspfx build` | `dist/<bundle>.js` + `release/manifests/*.manifest.json` + `release/assets/*` | CI intermediate, `rspfx analyze` |
| `bun run package` / `rspfx package` | `sharepoint/solution/<name>.sppkg` from `paths.zippedPackage` | Ship |
| `rspfx package --no-build` | Same `.sppkg` from existing `release/` | Incremental |
| `rspfx deploy` | Packages then `POST` to catalog | Automated upload |

National clouds use the same pipeline — only the catalog hostname differs.

> **Tip:** For most web parts leave `includeClientSideAssets: true` and `cdnBasePath: ""` — simplest, no external CDN.

## 1. Build

```sh
bun install --frozen-lockfile
rspfx doctor              # Node ≥20, config loads, sp-* versions match, port free
rspfx build               # minified, no sourcemap by default
# debuggable:
rspfx build --no-minify --sourcemap
# native bundler (identical output):
npx rspack build --mode production
npx vite build
npx rsbuild build
```

Emits `dist/<bundle>.js` (AMD `define('<id>_<version>', …)`), `release/manifests/<id>.manifest.json` (with `entryModuleId` and `internalModuleBaseUrls`), and `release/assets/*`.

See [building-packages.md](building-packages.md).

## 2. Package

```sh
rspfx package   # or bun run package
unzip -l sharepoint/solution/<name>.sppkg | head -20
```

Expect `[Content_Types].xml`, `_rels/.rels`, `AppManifest.xml`, `feature_<id>.xml`, `<featureId>/WebPart_<id>.xml` (or `Extension_` / `Library_`), and `ClientSideAssets/` when `includeClientSideAssets` is true.

ZIP layout: [reference/FORMATS.md](../reference/FORMATS.md#4-sppkg-zip-layout-jszip-deflate-level-9).

## 3. Choose catalog and `skipFeatureDeployment`

| Catalog | URL pattern | Scope |
|---|---|---|
| **Tenant App Catalog** | `https://{tenant}.sharepoint.com/sites/appcatalog` | Every site — recommended |
| **Site Collection App Catalog** | `https://{tenant}.sharepoint.com/sites/<site>/_layouts/15/tenantAppCatalog.aspx` | Single site only |

`config/package-solution.json` `solution.skipFeatureDeployment`:

- `true` (scaffold default) — tenants see **Deploy** on upload; solution available on all sites without per-site `Add an app`; required for **Sync to Teams**.
- `false` — each site owner must `Site Contents → Add an app → <solution>`; use for staged rollouts.

Microsoft docs: [site collection app catalog](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/site-collection-app-catalog) · [tenant-scoped deployment](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/tenant-scoped-deployment) · [app catalog](https://learn.microsoft.com/en-us/sharepoint/use-app-catalog).

## 4. Upload to app catalog

### Manual

1. Open `https://{tenant}.sharepoint.com/sites/appcatalog` → `Site Contents` → `Apps for SharePoint`.
2. Drag-drop `sharepoint/solution/<name>.sppkg` — confirm **Replace** if version exists.
3. In the dialog check **Enable this app and add it to all sites** (when `skipFeatureDeployment: true`).
4. Click **Deploy** — catalog shows `Deployed` / `Enabled`.

PowerShell:

```powershell
Connect-PnPOnline -Url https://contoso-admin.sharepoint.com -Interactive
Add-PnPApp -Path ./sharepoint/solution/my-app.sppkg -Publish -SkipFeatureDeployment -Overwrite
```

### Automated — `rspfx deploy`

```sh
export RSPFX_ACCESS_TOKEN='<bearer-token>'        # Entra token with Sites.Manage.All
export RSPFX_APP_CATALOG_URL='https://contoso.sharepoint.com/sites/appcatalog'
rspfx deploy
```

- Catalog URL: `config.deploy.appCatalogSiteUrl` → `RSPFX_APP_CATALOG_URL` → prompt.
- Bearer token: `RSPFX_ACCESS_TOKEN` — 120 s timeout.
- Without a token prints manual steps and exits 0 (so CI without creds still succeeds).

See [commands.md](commands.md) and [real-tenant-validation.md](real-tenant-validation.md#tenant-credentials).

> **Tip:** Store the token as a CI secret; `rspfx deploy` works headless when both env vars are set.

## 5. Approve API permissions

If `config/package-solution.json` `solution.webApiPermissionRequests` is non-empty:

1. Go to `https://{tenant}-admin.sharepoint.com/_layouts/15/online/AdminHome.aspx#/webApiPermissionManagement`.
2. Find pending request → **Approve**.

Until approved, `MSGraphClient` / `AadHttpClient` return 403.

Docs: [use AadHttpClient](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/use-aadhttpclient).

## 6. CDN considerations

| `includeClientSideAssets` | `cdnBasePath` | Behavior |
|---|---|---|
| `true` (default) | `""` | Bundles embedded in `.sppkg` under `ClientSideAssets/`; manifests use `HTTPS://SPCLIENTSIDEASSETLIBRARY/` — SharePoint serves them; no external CDN needed |
| `false` | `""` | No `ClientSideAssets/` — load fails unless you self-host; avoid |
| `false` or `true` | `"https://cdn.contoso.com/<name>/"` | Manifests use that URL; upload `release/assets/*` to that CDN |
| `true` + non-empty `cdnBasePath` | Non-empty | CDN URL wins; `ClientSideAssets/` still embedded but manifests point to CDN |

`cdnBasePath` must end with `/` — toolchain appends one if missing.

Schema: [write-manifests](https://developer.microsoft.com/json-schemas/spfx-build/write-manifests.schema.json) · Docs: [CDN hosting](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/hosting-spfx-from-office-365-cdn).

> **Tip:** Stay on the first row unless you have an external CDN requirement — one fewer moving part.

## 7. Add to site and page

1. After catalog **Deploy**, go to `https://{tenant}.sharepoint.com/sites/<test>` → `Site Contents` → `Add an app` → your solution → **Add** (skip when `skipFeatureDeployment: true`).
2. Edit a page → `+` → search by `preconfiguredEntries[0].title` → **Add** → configure property pane → **Republish**.
3. Verify in DevTools → `Network` — bundle URLs should be `https://{tenant}.sharepoint.com/sites/appcatalog/ClientSideAssets/<bundle>.js` (or CDN URL).

## 8. Teams and Outlook

When `teams/manifest.json` was present at `rspfx package` time (auto-included under `ClientSideAssets/teams/`), the catalog shows **Sync to Teams**.

1. Catalog → select app → **Sync to Teams** (or Teams Admin Center → Manage apps → Upload).
2. Teams Admin Center → find app → **Allowed** + permission policy.
3. Users: `Teams → Apps → Built for your org` → **Add**; with `personal` scope the same app appears in new Outlook (`Outlook → Apps → Built for your org`) after 10–120 min sync.

Required `teams/manifest.json` fields:

- `id` and `staticTabs[0].entityId` must equal the SharePoint component `id` — see [project-structure.md](project-structure.md#naming-rules).
- `validDomains` must include `*.sharepoint.com`, `*.office.com`, etc. — scaffold list in `packages/templates`.
- `contentUrl` uses `TeamsLogon.aspx?SPFX=true&dest=teamshostedapp.aspx%3F...%26componentId=<id>`.

Full reference: [teams-outlook-install.md](teams-outlook-install.md) · Docs: [Teams SPFx](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/integrate-with-teams-introduction) · [Sync to Teams](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/sharepoint-teams-apps).

> **Tip:** For Outlook add `*.outlook.office.com` to `validDomains` manually — scaffold omits it.

## 9. Update and rollback

- **Update:** bump `package.json` `version` + `config/package-solution.json` `solution.version` (4-part) → `rspfx package` → re-upload → **Replace** → **Deploy**.
- **Rollback:** re-upload previous `.sppkg` (catalog keeps one version).
- **Remove:** catalog → **Remove** (clear Recycle Bin) + Teams Admin → **Block**; pages show missing-web-part placeholder.

## 10. Env vars and `serve.json` tokens

`config/serve.json` string values support dotenv + shell expansion — see [commands.md#environment-variables](commands.md#environment-variables) and [project-structure.md](project-structure.md).

Key tokens:

- `${VAR}` / `${VAR:-default}` / `$VAR` — replaced from env / `.env`.
- `{tenantdomain}` in `initialPage` — replaced by `dev.tenantUrl` / `SPFX_SERVE_TENANT_DOMAIN` / `--tenant`.

Dev server runs at `https://localhost:4321` (SharePoint mode) or `http://localhost:4321` (local preview) — see [getting-started.md](getting-started.md) and [commands.md](commands.md).

## 11. CI

```yaml
steps:
  - run: bun install --frozen-lockfile
  - run: rspfx doctor
  - run: rspfx package
  - upload: sharepoint/solution/*.sppkg
  # or automated:
  # - run: RSPFX_ACCESS_TOKEN=${{ secrets.SPFX_TOKEN }} RSPFX_APP_CATALOG_URL=https://contoso.sharepoint.com/sites/appcatalog rspfx deploy
```

Cache `node_modules` and `.rspack-cache` between runs.

## Comparison vs official

| Area | Official | RSPFX |
|---|---|---|
| Package path | `paths.zippedPackage` in `package-solution.json` | Same — read directly |
| CDN | `deploy-azure-storage.json` + `cdnBasePath` | `write-manifests.json` `cdnBasePath` only — simpler |
| Upload | Manual or PowerShell / PnP | `rspfx deploy` with bearer token, or manual |
| API permissions | Same `webApiPermissionRequests` → `AppManifest.xml` | Same |
| Teams sync | Same `teams/` auto-detection | Same |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No web part or extension bundles found` | `src/webparts/<name>/` missing `*.manifest.json` or entrypoint — see [project-structure.md](project-structure.md) |
| Bundle 404 in workbench / page | Bundle name vs `entryModuleId` mismatch — default: folder name = bundle key |
| `External 'X' could not be resolved` | `externals` key not in `node_modules` — remove or `npm i X` |
| `Can't resolve 'XxxWebPartStrings'` | `localizedResources` pattern must contain `{locale}` |
| `paths.zippedPackage` missing | `package-solution.json` must have `solution.id`, `solution.name`, `paths.zippedPackage` |
| Catalog **Sync to Teams** missing | `teams/` not at package time, or `includeClientSideAssets: false`, or `skipFeatureDeployment: false` |
| `Invalid Teams manifest` | `teams/manifest.json` `id` ≠ component `id`, or `validDomains` missing `*.sharepoint.com` |
| App in Teams but not Outlook | Wait 10–120 min sync, check `personal` scope, use new Outlook, add `*.outlook.office.com` |
| API 403 | Approve in Admin `API access` |
| `DEPLOY_TIMEOUT` | Catalog throttling or large `.sppkg` — retry (120 s timeout) |
| `{tenantdomain}` literal in URL | No tenant configured — set `dev.tenantUrl` or `SPFX_SERVE_TENANT_DOMAIN` or `--tenant` |
| `IsValidAppPackage: false` | SharePoint OPC parser rejected package — verify `AppManifest.xml` GUID formatting and ZIP rels — see [reference/FORMATS.md](../reference/FORMATS.md) |

For internals see [building-packages.md](building-packages.md) and [real-tenant-validation.md](real-tenant-validation.md).
