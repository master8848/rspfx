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
svelte), language (typescript / javascript), styling (css / scss / tailwind),
Fluent UI (y/n), SPFx target (1.20 / 1.21 / 1.22), and package manager. Then it
scaffolds the project and installs dependencies.

Non-interactive (useful for CI):

```sh
rspfx new my-app \
  --framework react \
  --language ts \
  --styling scss \
  --fluent \
  --spfx-version 1.22 \
  --pm pnpm \
  --yes
```

`--no-install` skips dependency installation.

### Project layout

```
my-app/
├── rspfx.config.ts              # the single config file (name, framework, dev, build, ...)
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
└── playground/                  # playground host (index.html, main.ts)
```

`rspfx.config.ts` uses `defineConfig`:

```ts
import { defineConfig } from '@mbsks/rspfx-core';

export default defineConfig({
  name: 'my-app',
  framework: 'react',
  spfxVersion: '1.22',
  dev: { tenantUrl: 'https://contoso.sharepoint.com' },
});
```

Key defaults: `dev.port` **4321**, `dev.https` true, `dev.fastRefresh` false,
`dev.openBrowser` true, `dev.workbench` true, `build.outDir` **dist**,
`build.releaseDir` **release**.

## 3. Development workflow

```sh
rspfx dev
```

This starts the Rspack dev server (bundles on `localhost:8080`) and the HTTPS
manifest server on **`https://localhost:4321`**, then opens the workbench in your
browser.

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

- Set `dev.tenantUrl` in `rspfx.config.ts`, or
- Set the `SPFX_SERVE_TENANT_DOMAIN` env var (replaces the `{tenantdomain}` token
  in `config/serve.json`'s `initialPage`), or
- Override per-run: `rspfx dev --tenant https://contoso.sharepoint.com`.

### HTTPS certificate trust

The `:4321` server uses a **self-signed certificate** generated and cached in
**`~/.rspfx/certs`** (created on first run; trust instructions are printed once).
Trust it so the workbench can fetch `https://localhost:4321` without errors:

- **macOS:** open Keychain Access → *System* → import the cert from
  `~/.rspfx/certs` → set to *Always Trust*, or:
  `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.rspfx/certs/<cert>` (the exact filename is printed by the CLI).
- **Windows:** `certutil -addstore Root <cert>` (or via `certlm.msc` → Trusted
  Root Certification Authorities → Import).

Run `rspfx doctor` to verify the cert is in place and trusted.

### Editing

Save a source file → incremental rebuild → refresh event pushed over the
websocket → the page updates. `rspfx dev --refresh` upgrades to state-preserving
fast refresh where the framework supports it (see [fast-refresh.md](fast-refresh.md)).

To stop: `Ctrl+C`. `rspfx dev --no-browser` skips auto-opening the browser.

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
via REST using `config.deploy` (tenantUrl / username / password /
appCatalogSiteUrl) or the env vars `RSPFX_TENANT`, `RSPFX_USERNAME`,
`RSPFX_PASSWORD`. Without credentials it prints the manual upload steps instead.

## 5. Doctor

```sh
rspfx doctor
```

Runs the same checks the dev/package pipeline depends on:

- Node version ≥ 20, pnpm/npm/yarn present
- `rspfx.config.ts` loads and resolves (`resolveConfig` defaults)
- Required config files exist (`config/package-solution.json`, `config/serve.json`)
- Ports 4321 / 8080 free
- `~/.rspfx/certs` exists and is trusted
- `node_modules` dependencies present; sp-* versions resolvable
- `dist`/`release` writable

Exit code is **1** if any check fails — usable in CI.
