# Getting Started

## 1. Install

Requirements: **Node 20+** and **pnpm** (npm/yarn also work).

```sh
npm i -g @mbsks/rspfx-cli
rspfx --version
```

## 2. Create a project

```sh
rspfx new my-app
```

Runs interactively: prompts for framework (vanilla / react / solid / preact / vue /
svelte), language (typescript / javascript), styling (css / scss),
Fluent UI (y/n), SPFx target (1.20 / 1.21 / 1.22 / 1.23), and package manager. Then it
scaffolds the project and installs dependencies.

Non-interactive (useful for CI):

```sh
rspfx new my-app \
  --framework react \
  --language ts \
  --fluent \
  --spfx-version 1.22 \
  --pm pnpm \
  --yes
```

`--no-install` skips dependency installation.

### Project layout

```
my-app/
├── rspack.config.ts              # the bundler config hosting the RspfxPlugin (name, framework, dev, build, ...)
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   └── webparts/<name>/
│       ├── <name>.manifest.json # component manifest (id, preconfiguredEntries, properties)
│       ├── <name>WebPart.ts     # web part class (extends BaseClientSideWebPart from @microsoft/sp-webpart-base)
│       ├── components/          # framework component(s)
│       └── styles/              # *.module.scss | css
├── config/
│   ├── package-solution.json    # solution metadata (id, version, features)
│   ├── serve.json               # dev server: initialPage, https, port, hostname
│   └── write-manifests.json     # release base URL (cdnBasePath)
├── sharepoint/assets/           # optional solution assets
└── local/                       # optional — mock REST seed (local/data.json) for the dev local preview
```

Every path above is a default — `paths` in the plugin options (`srcDir`,
`webpartsDir`, `configDir`) relocates the source, web parts, and config folders;
see [building-packages.md](building-packages.md).

The project config lives in your bundler config as a plugin instance — the
`RspfxPlugin` from `@mbsks/rspfx-plugin` in `rspack.config.ts` (the default;
`rspfxVite` in `vite.config.ts` for Vite-based projects):

```ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';

export default {
  mode: 'development',
  plugins: [
    new RspfxPlugin({
      name: 'my-app',
      framework: 'react',
      spfxVersion: '1.23',
      dev: { tenantUrl: 'https://contoso.sharepoint.com' },
    }),
  ],
};
```

The CLI loads the bundler config via jiti, finds the plugin by its marker
symbol, and uses its options. Key defaults: `dev.port` **4321**, `dev.https`
true, `dev.fastRefresh` false, `dev.openBrowser` false, `dev.workbench` true,
`build.outDir` **dist**, `build.releaseDir` **release**. The `version` option
overrides package.json for the AMD library names and manifests.

## 3. Development workflow

```sh
rspfx dev
```

This starts the dev server on **`http://localhost:4321`** (default `--mode
local`): it serves a **local preview page at `/`** — no SharePoint tenant
needed — plus the compiled bundles under `/dist/*` and the debug manifests at
`/temp/manifests.js`. A mock SharePoint REST API runs at `/_api` (lists, items,
current user, context digests — see [commands.md](commands.md)); seed it with a
`local/data.json` file in the project root.

When a tenant is configured (`dev.tenantUrl`, `SPFX_SERVE_TENANT_DOMAIN`, or
`rspfx dev --tenant …`), or with an explicit `--mode sharepoint`, it instead
serves over **`https://localhost:4321`** (self-signed cert) and opens the
workbench in your browser.

### The workbench URL

The browser opens:

```
<tenantUrl>/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=<url-encoded>
```

- `debug=true` + `noredir=true` switch SharePoint into debug manifest mode.
- `debugManifestsFile` points at the debug manifests bundle —
  `https://localhost:4321/temp/manifests.js`. It is **percent-encoded** in the URL.
  The workbench loads your web part bundles from `https://localhost:4321/dist/*`.

### Telling rspfx your tenant

The workbench page is on your SharePoint tenant, so rspfx needs to know it:

- Set `dev.tenantUrl` in the plugin options in `rspack.config.ts`, or
- Set the `SPFX_SERVE_TENANT_DOMAIN` env var (replaces the `{tenantdomain}` token
  in `config/serve.json`'s `initialPage`), or
- Override per-run: `rspfx dev --tenant https://contoso.sharepoint.com`.

### HTTPS certificate trust (SharePoint mode only)

The `:4321` server in **SharePoint mode** (tenant configured via `dev.tenantUrl`, `SPFX_SERVE_TENANT_DOMAIN`, or `--tenant`) uses a **self-signed certificate** generated and cached in **`~/.rspfx/certs`** (825-day, 2048-bit, created on first run; trust instructions are printed once). Local mode (`rspfx dev --mode local`, the default when no tenant is configured) is plain HTTP on `http://localhost:4321` and needs no certificate.

> **Warning: dev-only, machine-wide trust.** Importing trusts the cert for all browsers/users on the machine. Use only on a development machine. To remove: macOS `sudo security remove-trusted-cert ~/.rspfx/certs/cert.pem` or Keychain Access → System → delete; Windows `certutil -delstore Root <thumbprint>` or `certlm.msc` → Trusted Root → remove. See `~/.rspfx/certs/cert.pem.trust.txt` for the exact filename printed by the CLI.

Trust it so the SharePoint workbench can fetch `https://localhost:4321` without errors:

- **macOS:** open Keychain Access → *System* → import the cert from `~/.rspfx/certs` → set to *Always Trust*, or: `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.rspfx/certs/<cert>` (the exact filename is printed by the CLI).
- **Windows:** `certutil -addstore Root <cert>` (or via `certlm.msc` → Trusted Root Certification Authorities → Import).

`rspfx doctor` verifies the rest of the dev environment (config, port, dependencies) — cert trust itself is the browser's job.

### Editing

Save a source file → incremental rebuild → the reload client embedded in
`/temp/manifests.js` detects the new build and reloads the workbench page
automatically, so you never have to press F5. The dev build is **unminified**
with readable module names and full source maps; only `rspfx build` optimizes
and minifies. `rspfx dev --refresh` upgrades to state-preserving fast refresh
where the framework supports it (see [fast-refresh.md](fast-refresh.md)).

To stop: `Ctrl+C`. The browser is never auto-opened unless you pass `rspfx dev --browser` or set `dev.openBrowser: true` in the config.

## 4. Build, package, deploy

```sh
rspfx build      # production compile: dist/ bundles + release/ manifests & assets
rspfx package    # assemble sharepoint/solution/<name>.sppkg (implies build)
```

The `.sppkg` is a DEFLATE zip containing `AppManifest.xml`, feature XML,
component-manifest-bearing elements files, and — when `includeClientSideAssets` is
true in `config/package-solution.json` — your bundles under `ClientSideAssets/`,
with manifest base URLs rewritten to the `HTTPS://SPCLIENTSIDEASSETLIBRARY/`
pseudo-URL that SharePoint resolves at install time.

Install it:

1. **Upload** `sharepoint/solution/<name>.sppkg` to the **app catalog** site
   (*SharePoint Admin Center → App Catalog → Apps for SharePoint*).
2. **Deploy** it (click *Deploy*, or set `skipFeatureDeployment` in
   package-solution.json to auto-deploy).
3. On any site: *Add an app* → your solution → *Add to page*.

`rspfx deploy` automates the upload: it packages and uploads to the app catalog
via REST using `config.deploy.appCatalogSiteUrl` (or the `RSPFX_APP_CATALOG_URL`
env var) with a bearer access token from `RSPFX_ACCESS_TOKEN`. Without a token
it prints the manual upload steps instead.

## 5. Doctor

```sh
rspfx doctor
```

Runs the same checks the dev/package pipeline depends on:

- Node version ≥ 20
- `package.json` present; the bundler config (`rspack.config.ts` /
  `vite.config.ts`) loads and resolves (plugin options → `resolveConfig`
  defaults)
- Framework package resolvable; sp-* dependency versions match `spfxVersion`
- Web part bundles discovered (`config.json` bundles or `src/webparts/*`
  scanning)
- Configured dev port (`dev.port`, default 4321) free
- `build.outDir` writable

Exit code is **1** if any check fails — usable in CI.
