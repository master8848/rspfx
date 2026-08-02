# Why you should NOT migrate (yet)

RSPFX is young. It intentionally mirrors official SPFx formats, but it is not
the official toolchain and it doesn't support everything. This page is the
honest checklist — if any of these apply to you, staying on gulp/Heft is the
right call, or at least the low-risk one.

## Hard blockers (do not migrate)

| Feature | Status | Why |
|---|---|---|
| **Application extensions** (`ApplicationCustomizer`) | ❌ Not supported | Only client-side web parts are compiled and packaged. `src/extensions/` is ignored; the feature would package an empty shell. |
| **List view command sets** (`ListViewCommandSet`) | ❌ Not supported | Same as above. |
| **Angular web parts** | ❌ Not supported | Angular needs a separate AOT pipeline (`ngc`/`ng-packagr`); roadmap M6, deferred. |
| **SPFx library components** (`src/libraries/`, component type Library) | ❌ Not supported | No library-component manifest/package path yet. |
| **SharePoint 2019 / on-premises targets** | ❌ Not supported | RSPFX targets SPFx 1.20–1.22 (SharePoint Online); older sp-* packages are out of the supported matrix. |
| **Teams tab / personal app manifests** | ⚠️ Not generated | You keep building the `teams/` manifests yourself (RSPFX doesn't emit them). |

## Strong warnings (migrate only with eyes open)

| Feature | Status | Consequence |
|---|---|---|
| **Custom gulp pipelines** | ⚠️ No gulp task ecosystem | Arbitrary gulp tasks (release automation, multi-stage bundling, custom deploy scripts) have no gulp equivalent. Project-level extension points exist: `plugin-api` hooks (`compilerHooks.beforeCompile`/`afterStats`, `packageHooks.beforePackage`) are wired into the CLI, and `spfx()` (see below) lets you own the Rspack config — but scripting-style pipelines are still yours to write. |
| **`spfx-customize-webpack.js` / webpack config surgery** | ⚠️ Escape hatch exists | The old webpack file is deleted. Most aliases turn out unnecessary under Rspack, but for real custom work there is now an escape hatch: export a `rspack.config.ts` that calls `spfx()` from `@mbsks/rspfx-compiler-rspack` (returns a full Rspack configuration; extend it with `additionalPlugins`/`swcContributions` or merge your own rules). Caveat: webpack-specific configs don't port automatically — loaders/plugins that only exist for webpack (and webpack-shaped module-federation configs) still need Rspack equivalents. |
| **Multi-locale runtime switching** | ⚠️ Single-locale | String modules resolve to the default locale (`en-us`) and are bundled. RSPFX does not yet emit `localizedPath` manifest entries from `config.json` `localizedResources`, so sp-loader won't swap locale modules at runtime. UI strings render in the default language. |
| **SPFx version pinning** | ⚠️ 1.20–1.22 only | `spfxVersion` is typed to those three targets. If your tenant requires a newer patch level than 1.22 (e.g. 1.23), you can still point the config at the nearest supported target (versions are harvested from `node_modules`), but it's untested territory. |
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
- You're on **SPFx 1.20–1.22** (SharePoint Online).
- Your team wants **fast builds** (a full PnP Modern Search build is ~2s vs
  minutes on Heft), **zero webpack/Heft/gulp surface**, and a **single config
  file**.
- You can tolerate single-locale UI strings for now (or your web parts are
  English-only).
- You can live without gulp-task plumbing (CI is plain shell).

## Decision table

| Your project | Verdict |
|---|---|
| 1 web part, React, standard config | ✅ Migrate |
| 4 web parts, localization, PnP controls (like Modern Search) | ✅ Migrate (single-locale) |
| Any extension or library component | ❌ Don't |
| Angular web part | ❌ Don't |
| Custom webpack config doing real work | ⚠️ Try it — `rspack.config.ts` + `spfx()`; webpack-only plugins/loaders still need Rspack equivalents |
| SPFx 1.16 / 2019 / on-prem | ❌ Don't |
| Enterprise, risk-averse, no capacity to babysit a new toolchain | ❌ Don't — revisit when RSPFX hits a stable release with real-tenant CI |

If you're on the fence, try it in a branch: `node scripts/migrate-to-rspfx.mjs
.`, `rspfx doctor`, `rspfx dev`, `rspfx package` — you'll know within an hour
whether your project is in the happy path, and nothing commits unless you want
it to.
