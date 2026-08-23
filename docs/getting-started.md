# Getting Started

RSPFX builds SharePoint web parts with Rspack instead of gulp + webpack — you get the same `.sppkg` SharePoint expects, in seconds.

## 1. Install

Requirements: **Node 20+** and **pnpm** (npm and yarn also work).

```sh
npm i -g @mbsks/rspfx-cli
rspfx --version
```

## 2. Create a project

```sh
rspfx new my-app
```

This walks you through a few prompts — framework (React, Vue, Svelte, etc.), language, styling, and SPFx version — then scaffolds the project and installs dependencies.

Non-interactive (useful for CI):

```sh
rspfx new my-app \
  --framework react \
  --language ts \
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
│   └── webparts/<name>/
│       ├── <name>.manifest.json # component manifest (id, preconfiguredEntries, properties)
│       ├── <name>WebPart.ts     # web part class (extends framework base class, e.g. BaseReactWebPart from @mbsks/rspfx-framework-react)
│       ├── components/          # framework component(s)
│       └── styles/              # *.module.scss | css
├── config/
│   ├── package-solution.json    # solution metadata (id, version, features)
│   ├── serve.json               # dev server: initialPage, https, port, hostname
│   └── write-manifests.json     # release base URL (cdnBasePath)
├── sharepoint/assets/           # optional solution assets
└── local/                       # optional — mock REST seed (local/data.json) for the dev local preview
```

Every path above is a default — you can move folders by setting `paths` in the plugin options (for example `paths.srcDir` or `paths.webpartsDir`). See [building-packages.md](building-packages.md) and the full map in [project-structure.md](project-structure.md).

Your project config lives directly in the bundler config:

```ts
// rspack.config.ts (or vite.config.ts with rspfxVite)
import { RspfxPlugin } from '@mbsks/rspfx-plugin';

export default {
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

The CLI reads this config and uses its options — no extra config file needed.

## 3. Development workflow

```sh
rspfx dev
```

This starts the dev server on `http://localhost:4321` (default `--mode local`): it serves a local preview page at `/` — no SharePoint tenant needed — plus the compiled bundles under `/dist/*` and the debug manifests at `/temp/manifests.js`.

A mock SharePoint REST API runs at `/_api` (lists, items, current user, context digests — see [commands.md](commands.md)); seed it with a `local/data.json` file in the project root.

For takeover blockers and the real-tenant gate see [roadblocks.md](roadblocks.md) and [real-tenant-validation.md](real-tenant-validation.md).

When a tenant is configured — via `dev.tenantUrl` in the config, the `SPFX_SERVE_TENANT_DOMAIN` env var, or `rspfx dev --tenant …` — or with `--mode sharepoint`, it serves over `https://localhost:4321` (self-signed cert) and opens the workbench.

### The workbench URL

The browser opens:

```
<tenantUrl>/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=<url-encoded>
```

- `debug=true` + `noredir=true` switch SharePoint into debug manifest mode.
- `debugManifestsFile` points at the debug manifests bundle —
  `https://localhost:4321/temp/manifests.js`. It is **percent-encoded** in the URL.
  The workbench loads your web part bundles from `https://localhost:4321/dist/*`.

### Telling RSPFX your tenant

The workbench lives on your SharePoint tenant, so RSPFX needs to know it:

- Set `dev.tenantUrl` in `rspack.config.ts`, or
- Set `SPFX_SERVE_TENANT_DOMAIN` (replaces `{tenantdomain}` in `config/serve.json`), or
- Pass `rspfx dev --tenant https://contoso.sharepoint.com` for one run.

### HTTPS certificate trust (SharePoint mode only)

**Local preview** (default): plain HTTP on `http://localhost:4321` — no certificate needed.

**SharePoint workbench**: HTTPS on `https://localhost:4321` — uses a self-signed cert cached in `~/.rspfx/certs` (825-day, created on first run; trust steps are printed once).

> **Warning: dev-only, machine-wide trust.** Importing trusts the cert for all browsers/users on the machine. Use only on a development machine. To remove: macOS `sudo security remove-trusted-cert ~/.rspfx/certs/cert.pem` or Keychain Access → System → delete; Windows `certutil -delstore Root <thumbprint>` or `certlm.msc` → Trusted Root → remove. See `~/.rspfx/certs/cert.pem.trust.txt` for the exact filename printed by the CLI.

Trust it so the SharePoint workbench can fetch `https://localhost:4321` without errors:

- **macOS:** open Keychain Access → *System* → import the cert from `~/.rspfx/certs` → set to *Always Trust*, or: `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.rspfx/certs/<cert>` (the exact filename is printed by the CLI).
- **Windows:** `certutil -addstore Root <cert>` (or via `certlm.msc` → Trusted Root Certification Authorities → Import).
- **Chrome 142+:** when `https://*.sharepoint.com` fetches `https://localhost:4321` Chrome prompts Local Network Access — click Allow; if blocked, allow `localhost` at `chrome://settings/content/insecureContent` or the Local Network Access prompt (see `packages/dev-runtime/src/serve.ts:121` for the `https://localhost:4321/temp/manifests.js` origin).

`rspfx doctor` verifies the rest of the dev environment (config, port, dependencies) — cert trust itself is the browser's job.

### Load debug scripts dialog

SharePoint shows Load debug scripts once per browser session and stores the allowance in `sessionStorage` key `spfx-debug` on the workbench origin.

After you click Load debug scripts, the reload client in `packages/dev-runtime/src/reload.ts:57` uses `window.location.reload()` in the same tab so the `sessionStorage` allowance persists across rebuilds; the dialog does not reappear until the tab is closed or the session is cleared.

To clear the allowance, append `?reset=true` to the workbench URL (`.../workbench.aspx?reset=true`) or close the tab and reopen the workbench URL from `packages/dev-runtime/src/serve.ts:121` (`debugManifestsFile=https://localhost:4321/temp/manifests.js`).

The `debugManifestsFile` URL is stable with no `?t=` cache-bust; `?t=` is appended only to bundle URLs via `bundleUrlSuffix` in `packages/dev-runtime/src/serve.ts:197`, `packages/plugin/src/vite.ts:438` and `packages/plugin/src/rsbuild.ts:110`.

If the dialog reappears on every reload, the cause is outside rspfx: a new tab per reload (`window.open` instead of reload), an untrusted self-signed cert in `~/.rspfx/certs`, or a blocked Local Network Access permission in Chrome 142+ (allow `https://localhost:4321` when prompted).

`rspfx dev --browser` and `dev.openBrowser: true` in `packages/core/src/config.ts:12` open the workbench once via `packages/dev-runtime/src/browser.ts:3`; subsequent rebuilds reload the same tab, so the dialog is not repeated for that reason.

### Editing

Save a source file → incremental rebuild → the reload client embedded in `/temp/manifests.js` (`packages/dev-runtime/src/reload.ts:45`) detects the new build and calls `window.location.reload()` in the same tab, so you never have to press F5 and the `sessionStorage` debug allowance is kept (see [Load debug scripts dialog](#load-debug-scripts-dialog)).

The dev build is unminified with readable module names and full source maps; only `rspfx build` optimizes and minifies.

`rspfx dev --refresh` upgrades to state-preserving fast refresh where the framework supports it (see [fast-refresh.md](fast-refresh.md)).

To stop: `Ctrl+C`. The browser is never auto-opened unless you pass `rspfx dev --browser` or set `dev.openBrowser: true` in `packages/core/src/config.ts:12`; when enabled the workbench is opened once (`packages/dev-runtime/src/browser.ts:3`), later rebuilds reload the same tab.

## 4. Build, package, deploy

```sh
rspfx build      # production compile: dist/ bundles + release/ manifests & assets
rspfx package    # assemble sharepoint/solution/<name>.sppkg (implies build)
```

The `.sppkg` is a DEFLATE zip containing `AppManifest.xml`, feature XML, component-manifest-bearing elements files, and — when `includeClientSideAssets` is true in `config/package-solution.json` — your bundles under `ClientSideAssets/`, with manifest base URLs rewritten to the `HTTPS://SPCLIENTSIDEASSETLIBRARY/` pseudo-URL that SharePoint resolves at install time.

Install it:

1. **Upload** `sharepoint/solution/<name>.sppkg` to the **app catalog** site
   (*SharePoint Admin Center → App Catalog → Apps for SharePoint*).
2. **Deploy** it (click *Deploy*, or set `skipFeatureDeployment` in
   package-solution.json to auto-deploy).
3. On any site: *Add an app* → your solution → *Add to page*.

`rspfx deploy` automates the upload: it packages and uploads to the app catalog via REST using `config.deploy.appCatalogSiteUrl` or env var (see [docs/commands.md#rspfx-deploy](commands.md#rspfx-deploy) and AGENTS.md:47). Without a token it prints the manual upload steps instead. Full deployment guide with tenant/site catalog, CDN, API permissions, and Teams sync: [deployment.md](deployment.md).

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
