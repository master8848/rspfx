# RSPFX — Architecture & Implementation Plan

**Status: DRAFT — pending approval. No code written.**

A complete SPFx-compatible build toolchain powered by Rspack. Replaces Heft + webpack + gulp. Never depends on webpack, Heft, or gulp.

Scope decision (accepted): **Angular is removed from milestone 1.** Start with Vanilla + React + Solid, prove `.sppkg` generation against a real tenant, then expand. Angular's AOT pipeline is a separate compiler track, scheduled after the packaging core is proven.

---

## 1. Architecture diagram

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
     (the ONLY      (component         (valid ZIP)    │dev server   │
      bundler)      manifests)                        │on :4321     │
                                                      └──────┬──────┘
                                                             │ HTTPS
┌────────────────────  RUNTIME (SharePoint tenant)  ─────────────────────┐
│  Workbench (_layouts/15/workbench.aspx)                                │
│    └─ debugManifestsFile ──▶ https://localhost:4321/temp/manifests.js │
│         └─ loaderConfig ──▶ https://localhost:4321/dist/*.js          │
│              (dev)   or  relative paths inside installed .sppkg (prod) │
└────────────────────────────────────────────────────────────────────────┘
```

**Dev mode flow** (must match official `gulp serve` semantics):

```
File save → Rspack incremental rebuild → HMR/refresh event (ws) → browser update
Dev server on :4321 (HTTPS, self-signed cert from manifest-server's
ensureCertificates) serves:
  /temp/manifests.js            → merged debug manifests
  /dist/*.js                    → compiled bundles (writeToDisk)
  /node_modules/@microsoft/...  → sp-* package manifests/bundles (local resolution)
Workbench (tenants) is the primary dev environment — the dev server only serves
bundles and manifests; it is never the primary surface.
```

**Production flow:**

```
src/ → compiler-rspack → dist/ (bundles + assets)
     → manifest-generator → dist/ (component manifests, loader configs)
     → sppkg-builder → solution.sppkg (ZIP: manifests + bundles + package manifest)
     → SharePoint app catalog install → Workbench page → loads
```

---

## 2. Dependency graph

```
                    ┌──────────┐
                    │   core   │  (SPFx types, base classes, env, theme, context)
                    └────┬─────┘
          ┌──────────────┼─────────────────┬──────────────────┐
          ▼              ▼                 ▼                  ▼
   ┌────────────┐  ┌────────────┐  ┌─────────────┐   ┌──────────────┐
   │diagnostics │  │ plugin-api │  │sharepoint-  │   │framework-*   │
   │(log/error/ │  │(adapters,  │  │runtime      │   │(vanilla,     │
   │ telemetry) │  │ loaders,   │  │(sp-* shims, │   │ react, solid,│
   └────────────┘  │ hooks)     │  │ webpart id  │   │ preact, vue, │
                   └────────────┘  │ mapping)    │   │ svelte,      │
                   ▲               └─────────────┘   │ angular*)    │
                   │                                 └──────┬───────┘
   ┌────────────┐  │                                        │
   │compiler-   │──┘                                        ▼
   │rspack      │                              ┌───────────────────────┐
   └─────┬──────┘                              │fluent-adapter         │
         │ (consumes plugin-api)               │(optional, React-only) │
         ▼                                     └───────────────────────┘
   ┌────────────┐    ┌─────────────┐    ┌──────────────┐
   │manifest-   │───▶│sppkg-builder│◀───│manifest-     │
   │generator   │    │(PRIORITY #1)│    │server        │
   └────────────┘    └─────────────┘    └──────────────┘
         ▲                  ▲                  ▲
         └─────────┬────────┴──────────────────┘
                   ▼
            ┌────────────┐
            │dev-runtime │  (serve emulation, ws, fast-refresh runtime)
            └─────┬──────┘
                  ▼
             rspfx CLI (composition root; consumes everything, owns commands)
```

Rules:
- `core` has **zero** dependencies — no framework, no bundler, no Node APIs.
- `compiler-rspack` knows nothing about SharePoint. SharePoint logic lives in manifest-generator/sppkg-builder.
- `manifest-server` + `dev-runtime` only exist in dev.
- CLI is the only package that composes others; no cycles.

---

## 3. Package map

| Package | Layer | Depends on | Owns | Key exports |
|---|---|---|---|---|
| `core` | foundation | — | SPFx interfaces, `BaseClientSideWebPart`, `WebPartContext`, property pane contracts, `Environment`, `ThemeProvider`, types | `defineConfig`, `BaseWebPart`, types |
| `diagnostics` | foundation | core | logger, error codes, telemetry (opt-out), timers | `Logger`, `trace()` |
| `plugin-api` | foundation | core, diagnostics | FrameworkAdapter interface, loader/transform hooks, packaging hooks | `FrameworkAdapter`, hook types |
| `compiler-rspack` | build | plugin-api, diagnostics | Rspack config factory, TS via swc, sourcemaps, tree-shaking, splitting, CSS/SCSS/CSS-modules, assets, caching | `createCompiler()`, `watch()` |
| `manifest-generator` | build | core, diagnostics | manifests.js, component manifests, loaderConfig, asset references | `generateManifests()` |
| `sppkg-builder` | build (PRIORITY 1) | manifest-generator, core | package-solution.json, solution feature metadata, package manifest, ZIP, `.sppkg` | `buildPackage()` |
| `manifest-server` | dev | core, diagnostics | certs + dev certificates only; serving is handled by the compiler dev server | `ensureCertificates()` |
| `dev-runtime` | dev | core, compiler-rspack, manifest-server | serve emulation, websocket hub, browser refresh, fast-refresh runtime, workbench URL | `startDev()`, `FastRefreshRuntime` |
| `framework-vanilla` | framework | core, plugin-api | DOM mount/unmount adapter | adapter |
| `framework-react` | framework | core, plugin-api | react adapter + fast refresh (react-refresh) | adapter |
| `framework-solid` | framework | core, plugin-api | solid adapter + fast refresh (solid-refresh) | adapter |
| `framework-preact` | framework | core, plugin-api | preact adapter + refresh | adapter |
| `framework-vue` | framework | core, plugin-api | vue adapter + vue HMR | adapter |
| `framework-svelte` | framework | core, plugin-api | svelte adapter + svelte HMR | adapter |
| `framework-angular` | framework | core, plugin-api | **DEFERRED** — separate compiler track (AOT, ngc/ng-packagr) | adapter |
| `fluent-adapter` | optional | framework-react | Fluent UI web part boilerplate, theme sync | `FluentWebPart` |
| `sharepoint-runtime` | runtime | core | shims/bridges for sp-* npm packages, framework→SPFx glue | helpers |
| `templates` | scaffolding | — | project templates (per framework, per language, per styling) | template files |
| `cli` | app | everything above | `new/dev/playground/build/package/deploy/doctor/analyze/clean`, prompts | `rspfx` binary |

Note: real `@microsoft/sp-*` packages **are published on npm**. Projects depend on them directly (version pinned to SPFx target); the toolchain externalizes them and emits `"type": "component"` dependency entries into manifests so SharePoint resolves its own built-in copies. `sharepoint-runtime` stays thin (types/bridges) and may be dropped if unused.

---

## 4. Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **Bundle wrapper incompatibility.** SPFx's module loader expects a specific AMD-style `define(...)` wrapper and module-id convention that official webpack emits via a custom plugin. If Rspack's `library` output doesn't match, the web part silently fails to load. | CRITICAL | Phase 0 reference capture: unzip a real `.sppkg`, diff wrapper byte-for-byte; wrap Rspack output with a small output plugin if needed. Automated fixture test compares against captured artifact. |
| R2 | **sp-* dependency IDs/versions drift** across SPFx 1.20/1.21/1.22. Wrong `component` id/version in loaderConfig → loader fails at runtime. | CRITICAL | Harvest from node_modules `.manifest.json` files, not hardcoded tables; version matrix tests per target. |
| R3 | **Rspack output-format gaps** (AMD interop, iife/var combos, `output.library.type: 'amd'` behavior) vs webpack. | HIGH | Verify in Phase 2 spike before building anything else; fallback = custom chunk wrapper. |
| R4 | **Silent dev-mode failure**: wrong cert/URL/port → blank workbench with no error (hard to debug, no local UI tests). | HIGH | `rspfx doctor` runs the same checks SPFx uses; keep the serve pipeline byte-compatible with official behavior. |
| R5 | **Fast Refresh per framework** needs framework-specific runtimes (react-refresh, solid-refresh, vue HMR, svelte HMR) — 5 runtimes, 5 failure modes. | HIGH | Framework packages own their runtime; fallback to full page refresh is mandatory and automatic. |
| R6 | **React 18/19 dual environment**: workbench page may run React 16 in legacy tenants; react-refresh + Fluent combos. | MED | Pin React peer ranges; externalize React? No — bundle React per web part (official behavior), document conflicts. |
| R7 | **Sppkg asset hosting**: production `internalModuleBaseUrls` relative vs absolute; app-catalog client-assets extraction rules. | MED | Copy official output naming (`[name].js`, `_locales/`, `assets/`); validate via real install. |
| R8 | **Scope explosion** (frameworks, Fluent, extensions, tenants). | MED | Milestones gate scope; Angular deferred; extensions (ApplicationCustomizer) explicitly out of M1–M4. |
| R9 | **pnpm strictness** (no phantom deps) in monorepo + generated projects. | LOW | Enforce strictness in CI; template lockfiles. |

---

## 5. Unknowns (to resolve in Phase 0/2 — empirically, never by assumption)

1. Exact byte-level format of the production bundle wrapper (AMD? named module? `define` signature) and how `entryModuleId` maps to it. → Capture from real `.sppkg`.
2. Exact ZIP layout of `.sppkg` (root `manifest.json` schema, component manifest filenames, presence/absence of feature.xml, `_locales/`, `assets/`). → Capture.
3. `manifests.js` global shape (`window['__MANIFESTS__']`? version field?) and full component-manifest schema for 1.20/1.21/1.22. → Capture from `temp/manifests.js` of a reference project.
4. Whether Rspack `output.library.type: 'amd'` + `externals` reproduces the official wrapper without a custom output plugin. → 1-day spike (R3).
5. How official serve mode resolves local sp-* manifests through :4321 (`node_modules` proxy path shape) — must mirror it for offline-ish workbench. → Capture `temp/serve.json`, curl :4321 endpoints.
6. Exact `package-solution.json` → `feature.xml` semantics (SPFx generates features server-side from solution metadata; confirm nothing client-side is needed beyond package-solution.json).
7. `write-manifests.json`/`serve.json` config shapes our CLI must accept/replace.
8. Workbench auto-open mechanics (exact URL params order, whether `noredir` is required, tenant URL detection).
9. Rspack behavior for `.scss`/CSS-modules/`assets/` paths relative to `src/` — official SPFx resolves imports relative to web part folder; mirror it.

---

## 6. Implementation order

```
Phase 0  Reference capture (no product code)
         - scaffold official SPFx 1.20/1.21/1.22 projects (vanilla + React)
         - capture: built .sppkg, dist bundles, temp/manifests.js, serve endpoints,
           node_modules sp-* manifest inventory → tests/fixtures/reference/
         - 1-day Rspack AMD output spike (Unknown #4)

Phase 1  Foundation
         - core (types, base classes, property pane, defineConfig)
         - diagnostics, plugin-api

Phase 2  Packaging core (PRIORITY #1 — the "prove .sppkg works" milestone)
         - sppkg-builder + manifest-generator
         - fixture-driven: fixture src → dist → solution.sppkg
         - unit + packaging tests against captured reference artifacts
         - vanilla adapter
         ✅ GATE: generated .sppkg installs in a real tenant app catalog,
           web part renders, property pane opens, no console errors.

Phase 3  Compiler
         - compiler-rspack (build path: TS/SWC, SCSS, assets, splitting, caching)

Phase 4  CLI build+package surface
         - rspfx new / build / package / clean / analyze / doctor
         - React + Solid adapters (build-only)

Phase 5  Dev mode
         - :4321 dev server (in compiler-rspack) with certs from manifest-server;
           manifests.js, sp-* proxy
         - dev-runtime: serve emulation, workbench URL + auto-open, ws refresh
         ✅ GATE: workbench loads web part from localhost:4321 bundles, edits
           hot-reload without restart.

Phase 6  dev --refresh + playground
         - fast-refresh runtimes (React/Solid first)
         - playground: standalone localhost sandbox, no SharePoint

Phase 7  Framework breadth
         - Preact, Vue, Svelte adapters + refresh
         - Fluent adapter

Phase 8  Angular (deferred track, only after Phases 2–6 proven)
         - separate compiler pipeline (AOT); ship as its own milestone, not a blocker

Phase 9  Benchmarks + full test suite + docs
         - cold start <2s, rebuild <300ms, refresh <150ms, small build <4s, large <15s
         - docs/, examples/, migration guide
```

---

## 7. Compatibility concerns (non-negotiables)

1. **`sp-*` never bundled in production output.** Always `externals` + `"type": "component"` manifest entries with the exact id/version from the targeted SPFx version's node_modules.
2. **Output naming identical to official**: `<entry>.js` (e.g. `my-webpart.js`), matching `loaderConfig.scriptResources.<entryModuleId>.path`.
3. **`defineConfig` + generated project layout mirror official SPFx conventions** (`src/webparts/*/`, `config/`, `sharepoint/`) so `rspfx new` output is boring and familiar.
4. **The `.sppkg` must install via app catalog → site collection → workbench**, byte-valid zip (CRC/ZIP64 correctness — Python `zipfile`-compatible, readable by SharePoint's extraction).
5. **Manifest schema fields preserved**: `preconfiguredEntries`, `properties`, `safeWithCustomScriptDisabled`, `componentType`, `manifestVersion: 2`, `loaderConfig.scriptResources` dependency types (`component`/`path`/`localizedPath`).
6. **Dev must work like official serve**: workbench is primary; `localhost:4321/temp/manifests.js` URL shape; auto-opened browser; rebuild notifications; HTTPS with trusted self-signed cert.
7. **Extensions** (`ApplicationCustomizer`, `ListViewCommandSet`) are out of scope until web part path is solid — but manifest generator must not preclude them (same loaderConfig machinery).
8. **Node 20+, pnpm/npm/yarn** all first-class; CI matrix on all three.
9. **Zero framework deps in core**; Fluent/Tailwind/SCSS strictly opt-in via config.
10. **No webpack/Heft/gulp strings anywhere in runtime or build output** — fully replaceable `node_modules` (only `@microsoft/sp-*` runtime deps allowed in generated projects, exactly as official SPFx does).

---

## 8. Milestone roadmap

| Milestone | Scope | Exit criteria |
|---|---|---|
| M0 | Reference capture + AMD spike | Fixture artifacts committed; wrapper format confirmed |
| M1 | Foundation + packaging core (vanilla) | **Valid `.sppkg` installs & renders in a real tenant** |
| M2 | Compiler + build/package CLI + React/Solid | `rspfx new` → `rspfx build` → `rspfx package` one-command happy path for 3 frameworks |
| M3 | Dev mode | Workbench-first live editing, auto browser open, <2s cold start, <300ms rebuild |
| M4 | Fast refresh + playground | State-preserving refresh <150ms; sandbox mode without tenant |
| M5 | Framework breadth + Fluent | Preact/Vue/Svelte adapters; Fluent web part scaffold |
| M6 | Angular (deferred) | Angular adapter on separate compiler track |
| M7 | Benchmarks, full test suite, docs | Targets met; docs site; migration guide; examples for all frameworks |

Tests everywhere: unit (vitest), integration (fixture → sppkg → manifest validation), packaging (zip layout vs captured reference), compatibility (real-tenant CI on SPFx 1.20/1.21/1.22), framework tests, benchmarks (scripted).

---

## 9. Immediate next steps (await approval)

1. Approve scope: **M1/M2 = Vanilla + React + Solid only**. Angular scheduled at M6.
2. Run Phase 0 reference capture (needs a machine with Node 20+ and, for the M1 gate, access to an SPFx tenant app catalog — can be a free developer tenant).
3. Then implement in the order above.

**Open questions for you:**
- Do you have a developer tenant available for the M1 acceptance gate (real install test), or should I add a manual verification checklist instead?
- Phase 0 capture requires running the official SPFx toolchain once (to harvest artifacts). The "never depend on" rule is about the product; harvesting reference outputs is methodology. OK?
