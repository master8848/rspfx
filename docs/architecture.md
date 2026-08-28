# Architecture

Short orientation. Full plan is [`ARCHITECTURE.md`](../ARCHITECTURE.md).

## Overview

RSPFX replaces Heft + webpack + gulp. Pick your bundler — Vite (default), Rsbuild, or Rspack. No bundler config needed for standard layouts; the CLI builds options from `config/config.json` + `package.json`. See Microsoft docs: [SharePoint Framework overview](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/sharepoint-framework-overview) and [SharePoint Framework toolchain](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/sharepoint-framework-toolchain).

`crates/*` are optional Rust with JS fallback.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              rspfx CLI                                 │
│   new │ migrate │ dev │ dev --refresh │ build │ package │ deploy     │
│   doctor │ analyze │ clean                                              │
└────────┬───────────────────────────────────────────────────────────────┘
         │
         ├───────────────┬──────────────────┬─────────────────┬──────────┐
         ▼               ▼                  ▼                 ▼          ▼
   ┌───────────┐  ┌────────────┐   ┌──────────────┐   ┌────────────┐  ┌──────────┐
   │  bundler  │  │ manifest-  │   │   sppkg-     │   │dev-runtime │  │templates │
   │Vite/Rsbuild│  │ generator  │   │   builder    │   │            │  │          │
   │  / Rspack  │  └─────┬──────┘   └──────┬───────┘   └─────┬──────┘  └──────────┘
   └─────┬─────┘        │                 │                 │
         ▼              ▼                 ▼                 ▼
   Vite/Rsbuild/   manifests.js      solution.sppkg   ┌─────────────┐
     Rspack        (component         (valid ZIP)    │ dev server  │
     bundles       manifests)                        │  on :4321   │
                                                    └──────┬──────┘
                                                           │ HTTP (local) / HTTPS (sharepoint)
┌────────────────────  RUNTIME (SharePoint tenant / local preview)  ──────────┐
│  Workbench (_layouts/15/workbench.aspx)                                     │
│    └─ debugManifestsFile ──▶ https://localhost:4321/temp/manifests.js      │
│         └─ loaderConfig ──▶ https://localhost:4321/dist/*.js               │
│              (dev)   or  relative paths inside installed .sppkg (prod)     │
│  Local preview (no tenant): http://localhost:4321/ → local-runtime.js     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Depends on | What it does |
|---|---|---|
| `core` | — | Types, `HeadlessAdapter`, `defineConfig`. Zero deps. |
| `webpart-base` | `core` + `@microsoft/sp-webpart-base` | `HeadlessWebPart`, `defineWebPart`. |
| `diagnostics` | `core` | Logger, `RspfxError`. |
| `plugin-api` | `core`, `diagnostics` | `FrameworkPreset`, `HookBus`. |
| `compiler-rspack` | `core`, `plugin-api`, `diagnostics` | Rspack config, SWC, SCSS, cache, dev server. |
| `manifest-generator` | `core`, `diagnostics` | Component manifests, `manifests.js`. |
| `sppkg-builder` | `core`, `diagnostics` | `package-solution.json` → `.sppkg`. |
| `manifest-server` | `core`, `diagnostics` | Certs `~/.rspfx/certs`. |
| `dev-runtime` | `core`, `compiler-rspack`, `manifest-server`, `manifest-generator`, `diagnostics`, `plugin-api`, `sharepoint-runtime`, `framework-*` | Dev server, reload, preview + mock `/_api`, workbench URL. |
| `plugin` | `core`, `compiler-rspack`, `dev-runtime`, `manifest-generator`, `manifest-server`, `diagnostics`, `plugin-api`, `@rspack/core` | `RSpfxPlugin` / `rspfxVite` / `rspfxRsbuild`. |
| `framework-*` | `core`, `plugin-api`, `webpart-base` | Adapter + preset + thin shim. |
| `fluent-adapter` | `core`, `framework-react`, `webpart-base` | Fluent theme sync. |
| `sharepoint-runtime` | `core`, `diagnostics` | Local preview context, `local-runtime.js`. |
| `templates` | `core` | Scaffolds. |
| `cli` | everything | All commands. |

`@microsoft/sp-*` is externalized — no manual install for most web parts. Ids come from `node_modules` or `reference/sp-component-ids.json`.

Framework loaders (`vue-loader`, `@rspack/plugin-react-refresh`) are aliased to stubs so they never ship to the browser.

## Dependency graph

```
                    ┌──────────┐
                    │   core   │  (zero dependencies)
                    └────┬─────┘
          ┌──────────────┼─────────────────┬──────────────────┐
          ▼              ▼                 ▼                  ▼
   ┌────────────┐  ┌────────────┐  ┌─────────────┐   ┌──────────────┐
   │diagnostics │  │ plugin-api │  │sharepoint-  │   │framework-*   │
   └────────────┘  └────────────┘  │runtime      │   └──────┬───────┘
                    ▲              └─────────────┘          ▼
                    │                              ┌──────────────────────┐
   ┌────────────┐  │                              │fluent-adapter        │
   │compiler-   │──┘                              │(optional, React-only) │
   │rspack      │                                 └──────────────────────┘
   └─────┬──────┘
         ▼
   ┌────────────┐    ┌─────────────┐    ┌──────────────┐
   │manifest-   │───▶│sppkg-builder│◀───│manifest-     │
   │generator   │    │             │    │server        │
   └────────────┘    └─────────────┘    └──────────────┘
         ▲                  ▲                  ▲
         └─────────┬────────┴──────────────────┘
                   ▼
            ┌────────────┐
            │dev-runtime │
            └─────┬──────┘
                  ▼
            ┌─────────┐
            │ plugin  │  (carries RspfxConfig)
            └────┬────┘
                  ▼
             rspfx CLI
```

`core` has no deps. `webpart-base` owns `sp-webpart-base`. `compiler-rspack` knows nothing about SharePoint. `manifest-server` + `dev-runtime` only run in dev.

## Config

The CLI looks for `vite.config.ts` / `rsbuild.config.ts` / `rspack.config.ts` via `jiti` (vite first), finds `RSPFX_PLUGIN_MARKER`, reads `options`. If missing, it builds the same from `config/config.json` + `package.json` + `src/*/*.manifest.json`.

Use `rspfx migrate` to write the file (`--revert` to undo, backup in `.rspfx/migrate-backup.json`).

Validated via `tryResolveConfig` before the cache version is computed.

## Dev mode

```
Save → rebuild → tick /__rspfx_hot.json → reload.
```

Local (no tenant): `http://localhost:4321/` — preview at `/` + mock `/_api`, HTTP, no cert.

SharePoint (tenant set): `https://localhost:4321` — `/temp/manifests.js`, `/dist/*.js`, `node_modules/*` via `ensureCertificates()` (`~/.rspfx/certs`, 825-day self-signed).

Workbench loads `https://<tenant>/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=<encoded https://localhost:4321/temp/manifests.js>` — see Microsoft docs: [Use the Workbench](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/tools/workbench) and [Serve your web part in a workbench](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/web-parts/get-started/serve-your-web-part-in-a-workbench).

`rspfx dev` warns if the cert is missing/expiring/untrusted (CORS / `NET::ERR_CERT_AUTHORITY_INVALID`) and `rspfx doctor` checks `cert exists` / `cert valid` / `key.pem 0600` / `cert trusted` (see [getting-started.md#cert-trust](getting-started.md#cert-trust) and [commands.md#rspfx-doctor](commands.md#rspfx-doctor)).

`manifests.js` is regenerated each rebuild. Bundle names are stable `[name].js`.

> Tip: `:4321` is the single dev port. Local preview is `http://localhost:4321/` (no tenant, no cert). Workbench mode is `https://localhost:4321/temp/manifests.js` (tenant set, cert required). The workbench URL is printed by `rspfx dev` — open it directly.

## Production

```
src/ → bundler → dist/ → manifest-generator → release/ → sppkg-builder → sharepoint/solution/<name>.sppkg
```

Release URLs come from `write-manifests.json` `cdnBasePath`, or `[]` / `HTTPS://SPCLIENTSIDEASSETLIBRARY/` when `includeClientSideAssets`.

sp-* is `externals` + `"type": "component"`. Wrapper is `define('<id>_<version>', …)`. Output is `[name].js`. `.sppkg` is a valid ZIP.

## Same manifest

`config/config.json`, `config/package-solution.json`, `src/*/*.manifest.json` work for both Heft/Gulp and RSPFX. See [migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx](migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx).
