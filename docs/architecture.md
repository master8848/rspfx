# Architecture

Condensed from [ARCHITECTURE.md](../../ARCHITECTURE.md). The full document is the
authoritative plan; this page is the quick orientation.

## Overview

RSPFX is a complete SPFx-compatible build toolchain powered by **Rspack**, replacing
Heft + webpack + gulp. The CLI is the only package that composes everything else;
no dependency cycles.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              rspfx CLI                                 │
│   new │ dev │ dev --refresh │ playground │ build │ package │ deploy    │
│   doctor │ analyze │ clean                                              │
└────────┬───────────────────────────────────────────────────────────────┘
         │
         ├───────────────┬──────────────────┬─────────────────┬──────────┐
         ▼               ▼                  ▼                 ▼          ▼
   ┌───────────┐  ┌────────────┐   ┌──────────────┐   ┌────────────┐  ┌──────────┐
   │compiler-  │  │ manifest-  │   │ sppkg-       │   │ dev-runtime│  │templates │
   │rspack     │  │ generator  │   │ builder      │   │            │  │          │
   └─────┬─────┘  └─────┬──────┘   └──────┬───────┘   └─────┬──────┘  └──────────┘
         │              │                 │                 │
         ▼              ▼                 ▼                 ▼
     Rspack        manifests.js      solution.sppkg   ┌─────────────┐
     (the ONLY      (component         (valid ZIP)    │manifest-    │
      bundler)      manifests)                        │server :4321 │
                                                      └──────┬──────┘
                                                             │ HTTPS
┌────────────────────  RUNTIME (SharePoint tenant)  ─────────────────────┐
│  Workbench (_layouts/15/workbench.aspx)                                │
│    └─ debugManifestsFile ──▶ https://localhost:4321/temp/manifests.js │
│         └─ loaderConfig ──▶ https://localhost:8080/bundles/*.js        │
│              (dev)   or  relative paths inside installed .sppkg (prod) │
└────────────────────────────────────────────────────────────────────────┘
```

## Package map

| Package | Layer | Depends on | Owns |
|---|---|---|---|
| `core` | foundation | — | SPFx interfaces, `BaseWebPart`, `WebPartContextLike`, `Environment`, `Version`, `defineConfig` |
| `diagnostics` | foundation | core | logger, `RspfxError`, telemetry, benchmarks |
| `plugin-api` | foundation | core, diagnostics | `FrameworkAdapter`, `FrameworkPreset`, compiler/package hooks, plugin registry |
| `compiler-rspack` | build | plugin-api, diagnostics | Rspack config factory, swc TS/JSX, SCSS/CSS-modules, assets, caching, framework plugin stubs |
| `manifest-generator` | build | core, diagnostics | component manifests, manifests.js, loaderConfig, sp-* dependency discovery |
| `sppkg-builder` | build (priority 1) | manifest-generator, core | package-solution.json → AppManifest/features/ZIP `.sppkg` |
| `manifest-server` | dev | core, diagnostics | `:4321` HTTPS server, manifests.js endpoint, node_modules proxy, certs |
| `dev-runtime` | dev | core, compiler-rspack, manifest-server, manifest-generator | serve emulation, websocket refresh, fast-refresh runtime, workbench URL |
| `framework-vanilla\|react\|solid\|preact\|vue\|svelte` | framework | core, plugin-api | DOM adapter + framework-specific refresh runtime |
| `framework-angular` | framework | — | **DEFERRED** (separate AOT compiler track) |
| `fluent-adapter` | optional | core, framework-react | `FluentWebPart`, theme sync |
| `sharepoint-runtime` | runtime | core | mock context, playground loader, sp-* bridges |
| `templates` | scaffolding | core | project + playground scaffolding |
| `cli` | app | everything | all commands, prompts |

Real `@microsoft/sp-*` packages come from npm (version pinned to the SPFx target);
the toolchain externalizes them and emits `"type": "component"` script-resource
entries so SharePoint resolves its own built-in copies.

Node-only framework plugin modules (`@rspack/plugin-react-refresh`,
`@rspack/plugin-preact-refresh`, `vue-loader`) are aliased by `createRspackConfig`
to build-time stubs in `packages/compiler-rspack/src/stubs/`, so framework
presets can reference them for compiler contributions without the browser bundle
ever including those modules.

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
            │dev-runtime │  (serve emulation, ws, fast-refresh runtime)
            └─────┬──────┘
                  ▼
             rspfx CLI (composition root)
```

Rules: `core` has zero dependencies; `compiler-rspack` knows nothing about
SharePoint; `manifest-server` + `dev-runtime` exist only in dev; the CLI composes
everything.

## Dev-mode flow

```
File save → Rspack incremental rebuild → refresh event (ws) → browser update

Manifest server (:4321, HTTPS, self-signed cert in ~/.rspfx/certs):
  GET /temp/manifests.js   → cumulative debug manifests (project + sp-*)
  GET /node_modules/*      → proxied sp-* package manifests/bundles
  GET /dist/*              → compiled bundles (writeToDisk)

Workbench loads:
  <tenantUrl>/_layouts/15/workbench.aspx?debug=true&noredir=true
    &debugManifestsFile=<enc>https://localhost:4321/temp/manifests.js
  → loaderConfig → https://localhost:8080/bundles/*.js (dev bundle server)
```

Workbench-first: `localhost:8080` is a bundle server only, never the primary
surface. `manifests.js` is regenerated after each rebuild (bundle names are
stable `[name].js` so loader entries stay valid).

## Production flow

```
src/ → compiler-rspack → dist/ (bundles + assets)
     → manifest-generator → release/manifests + release/assets
       (release base URLs: write-manifests.json cdnBasePath, or [] /
        HTTPS://SPCLIENTSIDEASSETLIBRARY/ when includeClientSideAssets)
     → sppkg-builder → sharepoint/solution/<name>.sppkg
       (ZIP: AppManifest.xml, feature_<id>.xml(.config/.rels),
        <featureId>/WebPart_<componentId>.xml, ClientSideAssets/ bundles)
     → app catalog install → workbench page → loads
```

Non-negotiables: sp-* never bundled (always `externals` + `"type": "component"`
entries with ids/versions from the targeted SPFx version's node_modules); bundle
wrapper is the AMD `define('<id>_<version>', [...])` form; output naming
`[name].js` matches `loaderConfig.scriptResources`; the `.sppkg` must be a
byte-valid zip installable via app catalog.
