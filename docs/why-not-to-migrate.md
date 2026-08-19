# Why you should NOT migrate (yet)

RSPFX is young. It intentionally mirrors official SPFx formats, but it is not
the official toolchain and it doesn't support everything. This page is the
honest checklist — if any of these apply to you, staying on gulp/Heft is the
right call, or at least the low-risk one.

## Hard blockers (do not migrate)

| Feature | Status | Why |
|---|---|---|
| **Application extensions** (`ApplicationCustomizer`) | ⚠️ Dev preview + runtime done | `rspfx new --component applicationcustomizer` generates the manifest + TypeScript entry under `src/extensions/`; extension bundles now compile, are discovered, and mount in the **local dev preview** (real `ApplicationCustomizerContext` + placeholder provider, `onInit`/render lifecycle). The package/deploy path is landing in the same wave — until it's verified, treat production deployment as unproven. |
| **List view command sets** (`ListViewCommandSet`) | ⚠️ Dev preview + runtime done | Same as above — command sets and field customizers mount in the local dev preview (mock list view, command buttons wired to `onListViewUpdated`/`onExecute`, sample rows for `onRenderCell`); package path still landing. |
| **Angular web parts** | ❌ Not supported | Angular needs a separate AOT pipeline (`ngc`/`ng-packagr`); removed from the roadmap, no planned support. The preset layer is self-contained, so it could be added back later without core changes. |
| **SPFx library components** (`src/libraries/`, component type Library) | ❌ Not supported | No library-component manifest/package path yet. |
| **SharePoint 2019 / on-premises targets** | ❌ Not supported | RSPFX targets SPFx Online versions (see [docs/compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix) and `packages/core/src/versions.ts:13`); older sp-* packages are out of the supported matrix. |
| **Teams tab / personal app manifests** | ✅ Generated | Web part scaffolds ship a `teams/` folder: `manifest.json` (v1.13, official SPFx dynamic tokens) plus the 192x192 color and 32x32 outline PNG icons. |

## Strong warnings (migrate only with eyes open)

| Feature | Status | Consequence |
|---|---|---|
| **Custom gulp pipelines** | ⚠️ No gulp task ecosystem | Arbitrary gulp tasks (release automation, multi-stage bundling, custom deploy scripts) have no gulp equivalent. Project-level extension points exist: `plugin-api` hooks (`compilerHooks.beforeCompile`/`afterStats`, `packageHooks.beforePackage`) are wired into the CLI, and since the project config is a plugin in your own `rspack.config.ts` (the `RspfxPlugin`), the Rspack config is yours to extend — but scripting-style pipelines are still yours to write. |
| **`spfx-customize-webpack.js` / webpack config surgery** | ⚠️ Escape hatch exists | The old webpack file is deleted. Most aliases turn out unnecessary under Rspack. The **primary** way to configure a project is the `RspfxPlugin` in `rspack.config.ts` (or `rspfxVite` in `vite.config.ts`) from `@mbsks/rspfx-plugin`; for full control, the plugin sits in a config you own, so you can extend it with extra loaders/plugins or merge your own rules. A lower-level alternative for compiler-only work is `spfx()` from `@mbsks/rspfx-compiler-rspack`, which returns a full Rspack configuration to extend (add `additionalPlugins`/`swcContributions` or merge your own rules). Caveat: webpack-specific configs don't port automatically — loaders/plugins that only exist for webpack (and webpack-shaped module-federation configs) still need Rspack equivalents. |
| **Multi-locale runtime switching** | ✅ Works incl. dev preview | `config.json` `localizedResources` are compiled to per-locale AMD modules (`dist/<name>_<locale>.js`) and emitted as `localizedPath` manifest entries, so string modules swap at runtime instead of being bundled in. The local dev preview honors `?locale=fr-fr` (alias `?market=`) — it switches the emulated CultureInfo (LCID, RTL flag, language name) and loads the matching locale files with an `en-us` fallback. |
| **SPFx version pinning** | ⚠️ see [docs/compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix) | `spfxVersion` is typed to the supported targets (see `packages/core/src/versions.ts:13`); the value must match the installed `@microsoft/sp-*` versions (harvested from `node_modules` at build time). |
| **React 18/19 mixed tenants** | ⚠️ Same as official | Bundle React per web part (official behavior); check for React version conflicts on legacy pages — unchanged from official tooling. |

## Softer risks

- **The toolchain is new.** Fewer battle-tested users than `gulp serve` +
  spfx-fast-serve. You become the beta tester.
- **Framework APIs aren't final.** The web part class / preset surface is
  explicitly unstable until milestone M5 — the framework packages can change
  under you.
- **No extension ecosystem.** No spfx-fast-serve, no PnP CLI build plugins,
  no custom heft rigs. The PnP tooling you may rely on (PnPjs, controls) works,
  but PnP-ecosystem *build* tooling doesn't apply.
- **Official support & docs.** Microsoft documents and supports the official
  pipeline. If a build breaks on a Thursday afternoon, Stack Overflow answers
  for Heft/webpack won't cover RSPFX.
- **CI parity.** You must port your own CI (it's ~10 lines — see
  [migrating-from-gulp-heft.md](migrating-from-gulp-heft.md) — but it's a
  change you own).
- **`.sppkg` byte-format risk.** Formats are captured from official packages
  (see `reference/FORMATS.md`), but the final acceptance gate is a real-tenant
  install. Until RSPFX has a published real-tenant CI, treat "it installs" as
  verified-by-reference, not verified-by-tenant.

## When migration IS the right call

- Your solution is **web parts only** (no extensions, no libraries, no Angular).
- You're on SPFx Online (see [docs/compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix) and `packages/core/src/versions.ts:13`).
- Your team wants **fast builds** (a full PnP Modern Search build is ~2s vs
  minutes on Heft), **zero webpack/Heft/gulp surface**, and a **single config
  file**.
- You can live without gulp-task plumbing (CI is plain shell).

## Decision table

| Your project | Verdict |
|---|---|
| 1 web part, React, standard config | ✅ Migrate |
| 4 web parts, localization, PnP controls (like Modern Search) | ✅ Migrate (multi-locale incl. dev-preview `?locale=` switching) |
| Extension component (ApplicationCustomizer / FieldCustomizer / ListViewCommandSet) | ⚠️ Try it — compile/discovery and local dev-preview mounting landed this wave; package path still landing |
| SPFx library components (`src/libraries/`) | ❌ Don't |
| Angular web part | ❌ Don't |
| Custom webpack config doing real work | ⚠️ Try it — `rspack.config.ts` + `RspfxPlugin` (or the lower-level `spfx()`); webpack-only plugins/loaders still need Rspack equivalents |
| SPFx 1.16 / 2019 / on-prem | ❌ Don't |
| Enterprise, risk-averse, no capacity to babysit a new toolchain | ❌ Don't — revisit when RSPFX hits a stable release with real-tenant CI |

If you're on the fence, try it in a branch: `node scripts/migrate-to-rspfx.mjs
.`, `rspfx doctor`, `rspfx dev`, `rspfx package` — you'll know within an hour
whether your project is in the happy path, and nothing commits unless you want
it to.
