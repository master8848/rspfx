# Why not to migrate

TL;DR: RSPFx targets SPFx Online. Stay on the official toolchain if you need on premises or you have hard blockers listed here.

This guide helps you decide with honesty, not hype. If a row matches your project, staying on gulp and Heft is lower risk.

Try a branch first:

```sh
rspfx migrate --dry-run
rspfx doctor
rspfx dev
rspfx package
```

You will know within an hour if you are on the happy path.

## Hard blockers - do not migrate

| Feature | Status | What to do |
|---|---|---|
| SharePoint 2019 or on premises | not supported | stay official. See [../../reference/compatibility.md](../../reference/compatibility.md). |
| Other framework without preset | bring your own preset | add a `FrameworkPreset` and `BaseWebPart` before you migrate. See [Custom framework guide](../frameworks/custom-framework-guide.md). |

All other cases are supported or have a workable path.

## What is verified

All these build, preview, and install from the catalog:

| Component | Status | Notes |
|---|---|---|
| Web parts - React, Vanilla, Solid, Preact, Vue, Svelte | yes | use `rspfx new --framework <id>` |
| Application extensions | yes | `rspfx new --component applicationcustomizer` |
| Field customizers | yes | `rspfx new --component fieldcustomizer` |
| List view command sets | yes | mock list view with `onExecute` |
| Form customizers | yes | `rspfx new --component formcustomizer` |
| Libraries | yes | `componentType: Library` to `Library_<id>.xml` |
| Teams tab and personal app | yes | `teams/manifest.json` v1.13 plus icons |

See [../../reference/compatibility.md](../../reference/compatibility.md).

## Warnings - eyes open

| Feature | Impact | Alternative |
|---|---|---|
| Custom gulp pipelines | no gulp tasks | use `plugin-api` hooks or your bundler config |
| Webpack surgery | `spfx-customize-webpack.js` deleted | configure via `RspfxPlugin` or `rspfxVite` |
| SPFx version pinning | `spfxVersion` typed to supported targets | keep `sp-*` pins in sync - `rspfx doctor` warns |
| Multi locale | works | per locale AMD modules with `?locale=fr-fr` preview |
| React 18 and 19 skew | same as official | bundle React per web part |

If your webpack changes only add aliases or polyfills, try building without them and run `rspfx doctor`.

## Softer risks

- RSPFx is young with fewer users than `gulp serve` and `spfx-fast-serve`.
- Framework APIs stay unstable until M5.
- No build extension ecosystem - PnPjs libraries still work.
- Microsoft supports the official toolchain. Community supports RSPFx.
- You own CI port - about 10 lines.
- `.sppkg` format is captured from official packages and validated on install.

## When migration is the right call

- You build web parts, extensions, or libraries for SPFx Online.
- You want fast builds in seconds, not minutes.
- You want one config file or zero config.
- You can live without gulp plumbing.

## Decision table

| Your project | Verdict |
|---|---|
| One web part, React, standard config | migrate |
| Four web parts, locales, PnP controls | migrate - `?locale=` works |
| Extension or library | migrate |
| Other framework without preset | bring a preset first |
| Custom webpack doing real work | try it - add bundler config |
| SPFx 1.16, 2019, or on premises | do not migrate |
| Risk averse enterprise | do not migrate - revisit at stable |

## Comparison

| Aspect | Official toolchain | RSPFx |
|---|---|---|
| Web parts plus extensions and libraries Online | yes | yes |
| On premises or 2019 | yes | no |
| Other frameworks | no preset | one file preset |
| Build speed | minutes | seconds |
| Config files | many | one or none |
| Support | Microsoft plus community | community |

For tech checks, see [../../reference/commands.md](../../reference/commands.md).
