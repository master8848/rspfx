# Project structure

File-path reference for the CLI. For commands see [commands.md](commands.md); for pipeline see [architecture.md](architecture.md); for APIs see [internal-api.md](internal-api.md).

## Tree

```
my-app/
├── vite.config.ts | rspack.config.ts | rsbuild.config.ts  # optional — synthesized if missing
├── package.json / tsconfig.json / .env / .gitignore
├── assets/favicon.svg                                      # dev-only, served at /assets/favicon.svg
├── config/package-solution.json / serve.json / write-manifests.json / config.json
├── src/webparts/<name>/<name>.manifest.json + <name>WebPart.ts|tsx
├── src/extensions/<name>/<name>.manifest.json + <Pascal>Extension.ts
├── src/libraries/<name>/<name>.manifest.json + <Pascal>Library.ts
├── teams/manifest.json + *_color.png + *_outline.png        # when teams.enabled
├── sharepoint/assets/ + Resources.resx                      # optional
├── dist/ / release/manifests/ / release/assets/ / temp/manifests.js
├── sharepoint/solution/<name>.sppkg
└── .rspfx/ + .rspack-cache/ + ~/.rspfx/certs/
```

Relocatable roots (`src`, `src/webparts`, `src/extensions`, `src/libraries`, `config`) have defaults in core and are overridden via `paths` in plugin options. See [internal-api.md](internal-api.md) for `resolvePathDefaults()` and `readProject()`.

## File table

| Path | Purpose | Required | Created |
|---|---|---|---|
| `vite.config.ts` / `rspack.config.ts` / `rsbuild.config.ts` | Bundler config host (`rspfxVite()` / `RspfxPlugin` / `rspfxRsbuild()`). Synthesized from manifests if missing. Add to any starter (`create-vite`, `better-t-stack`, TanStack Router, etc.). | No | `npm create vite@latest` + `rspfxVite()` or `rspfx new` / `rspfx migrate` |
| `package.json` | `name`/`version` (AMD `_<version>` source). | Yes | Scaffolded |
| `tsconfig.json` | `strict`, `bundler`, `jsx` per framework. | Yes | Scaffolded |
| `.env` | Dotenv loaded before `serve.json` expansion. | No | User-provided |
| `assets/favicon.svg` | Dev-only favicon at `/assets/favicon.svg`. | No | Scaffolded |
| `config/package-solution.json` | Solution `id`/`version`/`features`/`paths.zippedPackage`. | Yes | Auto-created if missing |
| `config/serve.json` | `initialPage` (`{tenantdomain}`), `https`/`port`/`hostname`. Precedence: CLI flags → `serve.json` → `dev.*` → defaults (`:4321`/`localhost`/`https`). | Yes | Auto-created |
| `config/write-manifests.json` | `cdnBasePath` for `release/manifests` URLs. | Yes | Auto-created |
| `config/config.json` | `bundles` / `externals` / `localizedResources` (`{locale}.js`). Scan fallback if `bundles` absent. | No | Auto-created |
| `src/webparts/<name>/<name>.manifest.json` | `id`/`alias`/`componentType: WebPart`/`version: "*"`. | One per web part | Scaffolded |
| `src/webparts/<name>/<name>WebPart.ts` | Entrypoint (`index.ts` wins — see naming rules). | One per folder | Scaffolded |
| `src/extensions/<name>/<name>.manifest.json` | `componentType: Extension`, `extensionType`. | One per extension | Scaffolded |
| `src/libraries/<name>/<name>.manifest.json` | `componentType: Library`, `alias`, `version: "*"` | One per library | Scaffolded |
| `teams/manifest.json` | Teams v1.13 manifest (when `teams.enabled`). | No | Auto-created |
| `sharepoint/Resources.resx` | Localized metadata (`$Resources:Key` → `LocalizedString`). | No | User-provided |
| `local/data.json` | Mock `/_api` seed for local preview. | No | User-provided |
| `dist/` | AMD bundles `[name].js` + chunks + locale modules. | Build output | `rspfx build` |
| `release/manifests/` + `release/assets/` | Production manifests + assets for packaging. | Build output | `assembleRelease()` |
| `temp/manifests.js` | Debug manifests served at `/temp/manifests.js`. | Dev output | Dev server |
| `sharepoint/solution/<name>.sppkg` | DEFLATE zip (path from `paths.zippedPackage`). | Package output | `rspfx package` |
| `~/.rspfx/certs/` | Self-signed certs for `https://localhost:4321`. | Dev certs | `ensureCertificates()` |

## Naming rules

| Rule | Detail |
|---|---|
| Folder = bundleName | Scan mode: `src/webparts/<name>/` → `dist/<name>.js` → `loaderConfig.entryModuleId = "<name>"`. With explicit `config.json` `bundles`, the bundle key wins. |
| One `*.manifest.json` per folder | Convention `<name>.manifest.json`. Two files → `MULTIPLE_MANIFESTS` error. Zero → folder skipped. |
| Entrypoint | `index.ts`/`tsx` → `<name>WebPart.ts`/`tsx` → `<name>ApplicationCustomizer`/`FieldCustomizer`/`CommandSet`/`Extension` → `<name>Library.ts` → lone `*.ts`/`tsx` fallback. See [internal-api.md](internal-api.md) for `pickEntrypoint()`. |
| `id` + version | `id` is UUID, globally unique. `version: "*"` replaced with `package.json` version (pre-release stripped). AMD library is `<id>_<version>`. Must match `teams/manifest.json` `id`/`entityId` when Teams enabled. |
| Library / Extension | Library: `componentType: Library`, no `preconfiguredEntries`, packaged as `Library_<id>.xml`. Extension: `extensionType` required, packaged as `Extension_<id>.xml`. Discovery merges all three dirs. |

Full API signatures (`readProject`, `discoverWebParts`, `pickEntrypoint`) → [internal-api.md](internal-api.md). Format guarantees → [compatibility.md](compatibility.md). Bundling details → [building-packages.md](building-packages.md).

## Schema links

| Schema | URL | Learn companion |
|---|---|---|
| Web part manifest | https://developer.microsoft.com/json-schemas/spfx/client-side-web-part-manifest.schema.json | [Working with web part manifests](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/web-parts/basics/working-with-web-part-manifests) |
| Extension manifest | https://developer.microsoft.com/json-schemas/spfx/client-side-extension-manifest.schema.json | [Extensions overview](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/extensions/overview-extensions) |
| Library manifest | https://developer.microsoft.com/json-schemas/spfx/client-side-library-manifest.schema.json | [Library component overview](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/library-component-overview) |
| `config.json` | https://developer.microsoft.com/json-schemas/spfx-build/config.1.0.schema.json | [SharePoint Framework toolchain](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/sharepoint-framework-toolchain) |
| `package-solution.json` | https://developer.microsoft.com/json-schemas/spfx-build/package-solution.schema.json | [Package and deploy SPFx solutions](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/package-and-deploy) |
| `serve.json` | https://developer.microsoft.com/json-schemas/spfx-build/spfx-serve.schema.json | [Serve your web part in a workbench](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/web-parts/get-started/serve-your-web-part-in-a-workbench) |
| `write-manifests.json` | https://developer.microsoft.com/json-schemas/spfx-build/write-manifests.schema.json | [Host SPFx from Office 365 CDN](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/hosting-spfx-from-office-365-cdn) |
| Teams v1.13 | https://developer.microsoft.com/json-schemas/teams/v1.13/MicrosoftTeams.schema.json | [Integrate with Microsoft Teams](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/integrate-with-teams-introduction) |

> Tip: keep `src/webparts/<name>/<name>.manifest.json` and folder name identical. It avoids ordering surprises, keeps `entryModuleId` stable, and matches what `rspfx migrate` expects when rewriting `lib → src`.
