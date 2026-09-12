# Deployment guide

TL;DR: You build your project, package a `.sppkg`, and upload it to the app catalog. Then you approve permissions and add the web part to a page.

This guide shows the path from code to a live web part. For exact outputs, see [../reference/architecture.md](../reference/architecture.md).

## Pipeline overview

```sh
rspfx build     # -> dist/ + release/manifests + release/assets
rspfx package   # -> sharepoint/solution/<name>.sppkg
rspfx deploy    # -> upload .sppkg to app catalog via REST
```

| Command | Output | Use |
|---|---|---|
| `rspfx build` | `dist/<bundle>.js` and release manifests | CI and analysis |
| `rspfx package` | `sharepoint/solution/<name>.sppkg` | ship |
| `rspfx package --no-build` | same `.sppkg` from existing `release/` | incremental |
| `rspfx deploy` | packages and posts to catalog | automated upload |

`npm run build` and `npm run package` proxy to the same commands.

<Steps>

## Step 1: Build

Install deps with a frozen lockfile, check your setup, then build:

```sh
bun install --frozen-lockfile
rspfx doctor
rspfx build
```

For a debuggable build, run `rspfx build --no-minify --sourcemap`. You can also run the bundler directly with `npx vite build` or `npx rspack build`.

Build emits `dist/<bundle>.js`, `release/manifests/<id>.manifest.json`, and `release/assets/*`.

For most web parts, keep `includeClientSideAssets: true` and `cdnBasePath: ""`. This embeds assets in the package and needs no external CDN.

## Step 2: Package

Create the `.sppkg` zip:

```sh
rspfx package
unzip -l sharepoint/solution/<name>.sppkg | head -20
```

Expect `AppManifest.xml`, `feature_<id>.xml`, `WebPart_<id>.xml`, and `ClientSideAssets/` when assets are included.

## Step 3: Choose a catalog

| Catalog | URL pattern | Scope |
|---|---|---|
| Tenant app catalog | `https://{tenant}.sharepoint.com/sites/appcatalog` | all sites |
| Site app catalog | `https://{tenant}.sharepoint.com/sites/<site>/_layouts/15/tenantAppCatalog.aspx` | one site |

Set `skipFeatureDeployment` in `config/package-solution.json`:

- `true` - tenants see Deploy on upload. The solution is available on all sites. Required for Sync to Teams.
- `false` - each site owner must add the app per site. Use for staged rollouts.

## Step 4: Upload to the app catalog

**Manual upload:**

1. Open `https://{tenant}.sharepoint.com/sites/appcatalog` then `Apps for SharePoint`.
2. Drag the `.sppkg` file in. Confirm Replace if the version exists.
3. Check Enable this app and add it to all sites when `skipFeatureDeployment` is true.
4. Click Deploy. The catalog shows Deployed.

**Automated upload with `rspfx deploy`:**

```sh
export RSPFX_ACCESS_TOKEN='<bearer-token>'
export RSPFX_APP_CATALOG_URL='https://contoso.sharepoint.com/sites/appcatalog'
rspfx deploy
```

Catalog URL comes from `config.deploy.appCatalogSiteUrl`, then `RSPFX_APP_CATALOG_URL`. Token comes from `RSPFX_ACCESS_TOKEN`. Without a token, the command prints manual steps and exits with code 0. Store the token as a CI secret.

See [../reference/commands.md](../reference/commands.md).

## Step 5: Approve API permissions

If `config/package-solution.json` has `webApiPermissionRequests`, approve them:

1. Open `https://{tenant}-admin.sharepoint.com/_layouts/15/online/AdminHome.aspx#/webApiPermissionManagement`.
2. Find the pending request and click Approve.

Until approved, Graph and AAD clients return 403.

## Step 6: Add the web part to a page

1. Go to a test site, then `Site Contents` then `Add an app` then your solution. Skip this when `skipFeatureDeployment` is true.
2. Edit a page. Click `+` and search for your web part title. Add it and publish.
3. Check DevTools Network. Bundle URLs should point to `.../ClientSideAssets/<bundle>.js` or your CDN URL.

## Step 7: Sync to Teams and Outlook

When `teams/manifest.json` exists at package time, the catalog shows Sync to Teams.

1. Click Sync to Teams in the catalog, or upload in Teams Admin Center.
2. Set the app to Allowed in Teams Admin Center.
3. Users find it in `Teams` then `Apps` then `Built for your org`. With `personal` scope, it also appears in new Outlook after sync.

For details, see [Teams and Outlook install](./project-setup/teams-outlook-install.md).

</Steps>

## CDN notes

| `includeClientSideAssets` | `cdnBasePath` | Result |
|---|---|---|
| `true` | `""` | Bundles embedded in `.sppkg` under `ClientSideAssets/`. No CDN needed. |
| `false` | `""` | No `ClientSideAssets`. Load fails unless you host files. Avoid this. |
| `false` or `true` | `"https://cdn.contoso.com/<name>/"` | Manifests point to that URL. Upload `release/assets/*` to the CDN. |

`cdnBasePath` must end with `/`. Use the first row unless you need an external CDN.

## Troubleshoot

| Symptom | Fix |
|---|---|
| Bundle 404 in workbench or page | bundle name does not match `entryModuleId` |
| `External X could not be resolved` | remove the externals entry or install `X` |
| `Can't resolve XxxWebPartStrings` | check `localizedResources` pattern includes `{locale}` |
| `paths.zippedPackage` missing | check `package-solution.json` has `solution.id`, `solution.name`, `paths.zippedPackage` |
| Sync to Teams missing | check `teams/` existed at package time and `includeClientSideAssets` is true |

For internals, see [../reference/architecture.md](../reference/architecture.md).
