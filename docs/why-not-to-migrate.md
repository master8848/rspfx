# Why you should NOT migrate (yet)

RSPFX is young. It mirrors official SPFx formats, but it's not the official toolchain and doesn't support everything. This is the honest decision guide — if a row matches you, staying on gulp/Heft is lower-risk. See Microsoft docs: [SharePoint Framework overview](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/sharepoint-framework-overview) and [SPFx compatibility](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/compatibility).

> **Tip:** Try in a branch before deciding: `rspfx migrate --dry-run`, `rspfx doctor`, `rspfx dev`, `rspfx package`. You'll know within an hour if you're in the happy path. See [migrating-from-gulp-heft.md](migrating-from-gulp-heft.md).

## Hard blockers — do not migrate if this is you

| Feature | RSPFX status | What to do |
|---|---|---|
| **SharePoint 2019 / on-premises** | ❌ Not supported | Stay on official. RSPFX targets SPFx Online only — see [compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix). |
| **Other framework without a preset** | ⚠️ Bring your own preset | No built-in preset for other frameworks. Any framework works via `FrameworkPreset` + `BaseWebPart` (see [custom-framework.md](custom-framework.md)). Don't migrate unless you can provide it. |

Everything else is supported or has a workable alternative.

## Supported — verified

All compile, preview locally and in the workbench, and install from the app catalog:

| Component | Status | Notes |
|---|---|---|
| **Web parts** (React, Vanilla, Solid, Preact, Vue, Svelte) | ✅ | `rspfx new --framework <id>`; see [frameworks.md](frameworks.md) |
| **Application extensions** | ✅ | `rspfx new --component applicationcustomizer` |
| **Field customizers** | ✅ | `rspfx new --component fieldcustomizer` |
| **List view command sets** | ✅ | Mock list view with `onExecute` wiring |
| **Form customizers** | ✅ | `rspfx new --component formcustomizer` |
| **SPFx libraries** (`src/libraries/`) | ✅ | `componentType: Library` → `Library_<id>.xml` |
| **Teams tab / personal app** | ✅ | `teams/` folder with `manifest.json` v1.13 + icons |

See [real-tenant-validation.md](real-tenant-validation.md) for verification. See Microsoft docs: [Extensions overview](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/extensions/overview-extensions), [Library component overview](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/library-component-overview), and [Integrate with Microsoft Teams](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/integrate-with-teams-introduction).

## Warnings — eyes open

| Feature | Consequence | Alternative |
|---|---|---|
| **Custom gulp pipelines** | No gulp task ecosystem | Use `plugin-api` hooks or extend your bundler config — you own the scripting |
| **Webpack config surgery** | `spfx-customize-webpack.js` deleted; webpack-only loaders don't auto-port | Configure via `RspfxPlugin` / `rspfxVite` in your bundler file; most aliases are unnecessary |
| **SPFx version pinning** | `spfxVersion` typed to supported targets | Keep `sp-*` pins in sync — `rspfx doctor` warns on drift. See [compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix) |
| **Multi-locale** | ✅ Works | Per-locale AMD modules; preview honors `?locale=fr-fr` |
| **React 18/19 skew** | Same as official | Bundle React per web part; watch version skew |

> **Tip:** If your webpack surgery only adds aliases or polyfills, you likely don't need it — try building without it and check `rspfx doctor`.

## Softer risks

- Young toolchain — fewer battle-tested users than `gulp serve` + `spfx-fast-serve`.
- Framework APIs unstable until M5.
- No build-extension ecosystem (no PnP CLI build plugins, no Heft rigs; PnPjs libraries still work).
- Microsoft supports the official pipeline; Stack Overflow won't cover RSPFX.
- CI is yours to port (~10 lines, see [migrating-from-gulp-heft.md](migrating-from-gulp-heft.md)).
- `.sppkg` format captured from official packages and validated by tenant install per [real-tenant-validation.md](real-tenant-validation.md) and [reference/FORMATS.md](../reference/FORMATS.md).

## When migration IS the right call

- Web parts, extensions, or libraries on SPFx Online.
- Team wants fast builds (seconds vs minutes), zero Heft/webpack surface, one config file.
- You can live without gulp-task plumbing.

## Decision table

| Your project | Verdict |
|---|---|
| 1 web part, React, standard config | ✅ Migrate |
| 4 web parts, localization, PnP controls | ✅ Migrate (`?locale=` works) |
| Extension or library | ✅ Migrate |
| Other framework without a preset | ⚠️ Bring a preset first — see [custom-framework.md](custom-framework.md) |
| Custom webpack doing real work | ⚠️ Try it — extend bundler config; webpack-only plugins may need equivalents |
| SPFx 1.16 / 2019 / on-prem | ❌ Don't |
| Risk-averse enterprise | ❌ Don't — revisit at stable release |

## Comparison vs official

| Aspect | Official (`gulp`/`Heft`) | RSPFX |
|---|---|---|
| Web parts + extensions + libraries (Online) | ✅ | ✅ (verified) |
| On-premises / 2019 | ✅ | ❌ |
| Other frameworks | — no preset | ✅ one-file `FrameworkPreset` — see [custom-framework.md](custom-framework.md) |
| Build speed | Minutes | Seconds (Vite/Rsbuild/Rspack + SWC) |
| Config files | Many (gulpfile, Heft rig, webpack overlay) | One optional bundler config, else zero-config |
| Support | Microsoft + Stack Overflow | Community |
