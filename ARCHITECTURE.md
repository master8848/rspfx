# RSPFX — Architecture & Implementation Plan

**Status: v0.0.14 shipped. See `docs/architecture.md` for the short orientation.**

RSPFX replaces Heft + webpack + gulp. Vite is the default bundler. Rsbuild and Rspack also work. No bundler config is required for standard layouts — `config/config.json` and your manifests are enough.

Angular is not supported. See `docs/roadmap.md`.

---

## 1. Diagram

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

`crates/*` (`rspfx-sppkg`, `rspfx-manifest`, `rspfx-rspack-plugin`) are optional Rust with JS fallback.

**Dev:**

```
Save → rebuild → tick /__rspfx_hot.json → browser reloads.

Local (default, no tenant): HTTP :4321 — preview at / + mock /_api.
SharePoint (tenant set): HTTPS :4321 — /temp/manifests.js, /dist/*.js, sp-* proxy. Workbench is the main surface.
```

**Prod:**

```
src/ → bundler → dist/ → manifest-generator → release/ → sppkg-builder → sharepoint/solution/<name>.sppkg → app catalog → workbench.
```

---

## 2. Dependency graph

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
            │dev-runtime │  (local + sharepoint modes, reload, preview)
            └─────┬──────┘
                  ▼
            ┌─────────┐
            │ plugin  │  (RSpfxPlugin / rspfxVite / rspfxRsbuild)
            └────┬────┘
                  ▼
              rspfx CLI (composes everything)
```

Rules:

- `core` has no runtime dependencies.
- `webpart-base` owns `@microsoft/sp-webpart-base`. `core` never imports it.
- `compiler-rspack` knows nothing about SharePoint.
- `manifest-server` + `dev-runtime` only run in dev. Certs only; serving is in the bundler dev server.
- `plugin` carries `RspfxConfig` via `RSPFX_PLUGIN_MARKER`.
- CLI composes everything. No cycles.

---

## 3. Packages

| Package | Depends on | What it does |
|---|---|---|
| `core` | — | Types, `HeadlessAdapter`, `defineConfig`, `RSPFX_PLUGIN_MARKER`. Zero deps. |
| `webpart-base` | `core` + `@microsoft/sp-webpart-base` | `HeadlessWebPart`, `defineWebPart`. |
| `diagnostics` | `core` | Logger, `RspfxError`, `formatError`. |
| `plugin-api` | `core`, `diagnostics` | `FrameworkPreset`, `HookBus`. |
| `compiler-rspack` | `core`, `plugin-api`, `diagnostics` | Rspack config, SWC, SCSS, assets, cache, `startDevServer`. |
| `manifest-generator` | `core`, `diagnostics` | Component manifests, `manifests.js`, sp-* ids. |
| `sppkg-builder` | `core`, `diagnostics` | `package-solution.json` → `.sppkg` ZIP. |
| `manifest-server` | `core`, `diagnostics` | Certs in `~/.rspfx/certs`. |
| `dev-runtime` | `core`, `compiler-rspack`, `manifest-server`, `manifest-generator`, `diagnostics`, `plugin-api`, `sharepoint-runtime`, `framework-*` | Dev server, reload (`/__rspfx_hot.json`), preview page + mock `/_api`, workbench URL. |
| `plugin` | `core`, `compiler-rspack`, `dev-runtime`, `manifest-generator`, `manifest-server`, `diagnostics`, `plugin-api`, `@rspack/core` | `RSpfxPlugin` / `rspfxVite` / `rspfxRsbuild`. |
| `framework-vanilla/react/solid/preact/vue/svelte` | `core`, `plugin-api`, `webpart-base` | Adapter + preset + thin web part shim. |
| `fluent-adapter` | `core`, `framework-react`, `webpart-base` | Fluent theme sync. |
| `sharepoint-runtime` | `core`, `diagnostics` | Local preview context, `local-runtime.js`, sp-* bridges. |
| `templates` | `core` | Project scaffolds. |
| `cli` | everything | `new`/`migrate`/`dev`/`build`/`package`/`deploy`/`doctor`/`analyze`/`clean`. |

`@microsoft/sp-*` is externalized. Most web parts need no manual install. SharePoint resolves `"type": "component"` entries (ids from `node_modules` or `reference/sp-component-ids.json`).

**Config:** CLI looks for `vite.config.ts` / `rsbuild.config.ts` / `rspack.config.ts` (vite first) via `jiti`, finds `RSPFX_PLUGIN_MARKER`, reads `options`. If missing, it builds the same options from `config/config.json` + `package.json` + `src/*/*.manifest.json`. `rspfx migrate` writes the file, backs up to `.rspfx/migrate-backup.json`.

---

## 4. Risks

| # | Risk | Fix |
|---|---|---|
| R1 | AMD wrapper must be `define('<id>_<version>', …)` | Captured real `.sppkg`, fixture test compares bytes. |
| R2 | sp-* ids drift (1.20–1.23) | Harvest from `node_modules`, fallback `reference/sp-component-ids.json`. |
| R3 | Rspack/ Vite output gaps | Verified spike + `chunkLoadingGlobal` + public-path sentinel. |
| R4 | Silent dev failure (cert/port) | `rspfx doctor` + cert cache `~/.rspfx/certs`. |
| R5 | Fast refresh per framework | Framework owns runtime, fallback is full reload. |

---

## 5. Unknowns — all resolved

Wrapper format, ZIP layout, `manifests.js` shape, `output.library: 'amd'` behavior, `:4321` sp-* proxy, `package-solution.json` → `feature.xml`, `serve.json`/`write-manifests.json` shapes, workbench URL params, SCSS paths — all captured from real builds and documented in `reference/FORMATS.md`.

---

## 6. How it was built

```
Phase 0  Capture real SPFx output → fixtures              ✅
Phase 1  core, diagnostics, plugin-api                    ✅
Phase 2  Packaging core (proves .sppkg installs)          ✅
Phase 3  Compiler (SWC, SCSS, assets)                     ✅
Phase 4  CLI: new / build / package / doctor              ✅
Phase 5  Dev mode (local + sharepoint)                    ✅
Phase 6  Fast refresh                                     ✅
Phase 7  All frameworks + Fluent + headless split         ✅
Phase 8  Vite/Rsbuild parity + typed HookBus + migrate    ✅
Phase 9  Benchmarks + docs (0.0.14)                       ✅
```

---

## 7. Must not break

1. `sp-*` never bundled — `externals` + `"type": "component"`.
2. Output is `<entry>.js` matching `loaderConfig.scriptResources`.
3. Layout matches official SPFx (`src/webparts/*/`, `config/`, `sharepoint/`). Bundler config is optional.
4. `.sppkg` is a valid ZIP installable via app catalog.
5. Manifest fields kept: `preconfiguredEntries`, `manifestVersion: 2`, `loaderConfig.scriptResources`.
6. Dev matches `gulp serve`: workbench primary in sharepoint mode, `/temp/manifests.js`, poll reload, `--browser` only opens.
7. Extensions supported via `discoverWebParts`.
8. Node 20+, any package manager. `bun` is repo default.
9. No webpack/Heft/gulp in output.

---

## 8. Roadmap

| Milestone | Done? |
|---|---|
| M0 Capture + spike | ✅ |
| M1 Packaging core | ✅ |
| M2 Build + package CLI | ✅ |
| M3 Dev mode | ✅ |
| M4 Fast refresh | ✅ |
| M5 All frameworks + Fluent | ✅ |
| M6 Angular | Removed |
| M7 Benchmarks | ✅ `reference/baseline-0.0.14.json` |
| M8 Vite/Rsbuild parity | ✅ |
| M9 Refresh for all frameworks | ✅ |

---

## 9. Next

- `0.0.14` is `latest` (`v0.0.14`). Consumers on `^0.0.13` must opt in.
- Next releases are `0.0.x` patches (`scripts/publish.mjs` defaults to patch).
- History lives in `CHANGELOG.md` only. `docs/` is current state.
