# Deployment reference

This page lists the technical deployment options for RSPFx: CDN behavior matrix, `skipFeatureDeployment` scope, catalog URLs, environment variables, CI steps, and troubleshooting.

For the step-by-step deployment workflow see `docs/deployment.md`.

For build outputs see `docs/building-packages.md` and ZIP layout `reference/FORMATS.md`.

## Pipeline

```
rspfx build     → dist/ + release/manifests + release/assets   (no .sppkg)
rspfx package   → sharepoint/solution/<name>.sppkg            (implies build)
rspfx deploy    → upload .sppkg to app catalog via REST        (implies package)
```

| Command | Produces | Flags |
|---|---|---|
| `rspfx build` | `dist/<bundle>.js` + `release/manifests/*.manifest.json` + `release/assets/*` | `--no-minify`, `--sourcemap` |
| `rspfx package` | `sharepoint/solution/<name>.sppkg` from `paths.zippedPackage` | `--no-build` |
| `rspfx deploy` | Packages then `POST` to catalog | requires `RSPFX_ACCESS_TOKEN` + `RSPFX_APP_CATALOG_URL` |

`config/package-solution.json` `paths.zippedPackage` is authoritative; `paths` in plugin options override defaults `paths.srcDir`, `paths.webpartsDir`, etc. (`packages/core/src/config.ts:54`).

## Catalog scope and skipFeatureDeployment

| Catalog | URL pattern | Scope |
|---|---|---|
| **Tenant App Catalog** | `https://{tenant}.sharepoint.com/sites/appcatalog` | Every site — recommended |
| **Site Collection App Catalog** | `https://{tenant}.sharepoint.com/sites/<site>/_layouts/15/tenantAppCatalog.aspx` | Single site only |

| `skipFeatureDeployment` | Behavior |
|---|---|
| `true` (scaffold default) | Catalog shows **Deploy**; solution available on all sites without per-site **Add an app**; required for **Sync to Teams** |
| `false` | Each site owner must `Site Contents → Add an app → <solution>`; use for staged rollouts |

See `config/package-solution.json` `solution.skipFeatureDeployment` and `solution.features` (`feature_<id>.xml` + `.config.xml`).

## CDN matrix

| `includeClientSideAssets` | `cdnBasePath` | Manifest `internalModuleBaseUrls` | `.sppkg` `ClientSideAssets/` | Action |
|---|---|---|---|---|
| `true` (default) | `""` | `['HTTPS://SPCLIENTSIDEASSETLIBRARY/']` | Bundles embedded | None — SharePoint serves from catalog |
| `false` | `""` | `[]` or empty | No `ClientSideAssets/` | Fails unless self-hosted; avoid |
| `false` or `true` | `"https://cdn.contoso.com/<name>/"` | `["https://cdn.contoso.com/<name>/"]` | Embedded but ignored when CDN set | Upload `release/assets/*` to that CDN |
| `true` + non-empty `cdnBasePath` | Non-empty | CDN URL wins | Embedded | CDN URL used |

`cdnBasePath` is `config/write-manifests.json` `cdnBasePath`; toolchain appends trailing `/` if missing (`packages/manifest-generator/src/component-manifests.ts:52`). Schema: `https://developer.microsoft.com/json-schemas/spfx-build/write-manifests.schema.json`.

## Environment variables

Single home is `docs/commands.md#environment-variables`; deployment uses:

| Variable | Use |
|---|---|
| `RSPFX_ACCESS_TOKEN` | Bearer token for `rspfx deploy` (`apps/cli/src/commands/deploy.ts:120`); 120 s timeout |
| `RSPFX_APP_CATALOG_URL` | Catalog URL `https://{tenant}.sharepoint.com/sites/appcatalog` |
| `RSPFX_LOG_LEVEL` | `error \| warn \| info \| debug \| trace` |
| `SPFX_SERVE_TENANT_DOMAIN` | Fallback for `dev.tenantUrl` in `serve.json` `{tenantdomain}` expansion |

Resolution for catalog URL: `config.deploy.appCatalogSiteUrl` → `RSPFX_APP_CATALOG_URL` → prompt. Without `RSPFX_ACCESS_TOKEN`, `rspfx deploy` prints manual steps and exits 0.

`config/serve.json` string values support dotenv + shell expansion: `${VAR}`, `${VAR:-default}`, `$VAR`, and `{tenantdomain}` replaced by `dev.tenantUrl` / `SPFX_SERVE_TENANT_DOMAIN` / `--tenant` (`packages/core/src/config.ts:138`).

## CI

```yaml
steps:
  - run: bun install --frozen-lockfile   # or pnpm install --frozen-lockfile / npm ci / yarn --frozen-lockfile
  - run: rspfx doctor
  - run: rspfx package
  - upload: sharepoint/solution/*.sppkg
  # or automated:
  # - run: RSPFX_ACCESS_TOKEN=${{ secrets.SPFX_TOKEN }} RSPFX_APP_CATALOG_URL=https://contoso.sharepoint.com/sites/appcatalog rspfx deploy
```

Cache `node_modules` and `.rspack-cache` between runs. `rspfx doctor` exits 1 on failure (`apps/cli/src/commands/doctor.ts`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No web part or extension bundles found` | `src/webparts/<name>/` missing `*.manifest.json` or entrypoint — see `docs/project-structure.md` |
| Bundle 404 in workbench / page | Bundle name vs `entryModuleId` mismatch — default: folder name = bundle key (`packages/dev-runtime/src/project.ts:737`) |
| `External 'X' could not be resolved` | `externals` key not in `node_modules` — remove or add `X` |
| `Can't resolve 'XxxWebPartStrings'` | `localizedResources` pattern must contain `{locale}` (`packages/manifest-generator/src/component-manifests.ts:52`) |
| `paths.zippedPackage` missing | `package-solution.json` must have `solution.id`, `solution.name`, `paths.zippedPackage` |
| Catalog **Sync to Teams** missing | `teams/` not at package time, or `includeClientSideAssets: false`, or `skipFeatureDeployment: false` |
| `Invalid Teams manifest` | `teams/manifest.json` `id` ≠ component `id`, or `validDomains` missing `*.sharepoint.com` (`packages/templates/src/index.ts:62`) |
| App in Teams but not Outlook | Wait 10–120 min sync, check `personal` scope, add `*.outlook.office.com` to `validDomains` |
| API 403 | Approve in Admin `API access` (`webApiPermissionRequests` → `AppManifest.xml`) |
| `DEPLOY_TIMEOUT` | Catalog throttling or large `.sppkg` — retry (120 s timeout) |
| `{tenantdomain}` literal in URL | No tenant configured — set `dev.tenantUrl` or `SPFX_SERVE_TENANT_DOMAIN` or `--tenant` |
| `IsValidAppPackage: false` | SharePoint OPC parser rejected package — verify `AppManifest.xml` GUID formatting and ZIP rels — see `reference/FORMATS.md` §4 (`packages/sppkg-builder/src/xml.ts:359`) |

For `.sppkg` entry ordering see `reference/FORMATS.md` §4.
