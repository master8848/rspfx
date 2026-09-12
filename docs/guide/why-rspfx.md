# Why RSPFx

TL;DR: RSPFx builds the same SharePoint Framework solutions you build today, with a modern bundler and less config. You keep your manifests and get faster builds.

RSPFx is a drop-in replacement for gulp, Heft, and webpack. You output the same AMD bundles and `.sppkg` files. You point it at your existing `config/` and `src/` folders.

## Zero config for standard projects

Official SPFx requires many config files to run. RSPFx runs with no new config for most layouts.

You keep `config/config.json`, `config/package-solution.json`, and your `*.manifest.json` files. Run `rspfx build` and `rspfx dev` with no extra files.

When you want control, add one plugin file:

```ts
// vite.config.ts
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxVite({ name: 'my-app', version: '1.0.0', spfxVersion: '1.22', framework: 'react' })] };
```

See [Getting started](./getting-started.md) and [../reference/commands.md](../reference/commands.md).

## Use any modern bundler

RSPFx supports Vite, Rsbuild, and Rspack. You pick the config file you prefer.

| Bundler | Config | Build and dev |
|---|---|---|
| Vite | `vite.config.ts` + `rspfxVite` | yes |
| Rsbuild | `rsbuild.config.ts` + `rspfxRsbuild` | yes |
| Rspack | `rspack.config.ts` + `RspfxPlugin` | yes |

Official toolchain supports webpack only.

Pick Vite unless you need an Rspack feature. It gives the fastest loop and the simplest CSS handling.

## Use any UI framework

RSPFx supports more than React. You can use Vue, Svelte, Solid, Preact, or no framework at all.

| Framework | Official SPFx | RSPFx |
|---|---|---|
| React and Vanilla TS | yes | yes |
| Solid, Preact, Vue, Svelte | no | yes via `@mbsks/rspfx-framework-*` |
| Other frameworks | no | yes via one-file preset |

You add other frameworks with a `FrameworkPreset` and a `BaseWebPart` class. Register them with `definePlugin` and `registerPlugin`.

See [Choosing a framework](./frameworks/choosing-a-framework.md) and [Custom framework guide](./frameworks/custom-framework-guide.md).

## Switch SPFx versions with one field

Official upgrades touch many files and pins. RSPFx needs one field change.

Update `spfxVersion: '1.24'` in your bundler config. Then run `bun update @mbsks/rspfx-*` or the update command for your package manager.

See [Upgrading SPFx version](./migration/upgrading-spfx-version.md) and [../reference/compatibility.md](../reference/compatibility.md).

## Faster and leaner

RSPFx builds 5 to 10 times faster than webpack 5. It uses Vite, Rsbuild, or Rspack with SWC. It caches Rspack builds to disk.

There is no task runner. `rspfx` calls the bundler directly.

Save a file and the dev server rebuilds and reloads. Use `rspfx dev --refresh` to preserve state where your framework allows it.

RSPFx uses Node 20 or later. It has no gulpfile and no Heft. Use `rspfx doctor` and `rspfx migrate` for checks and migration.

## Stay fully compatible with SharePoint

RSPFx produces the same output SharePoint expects:

- AMD bundles with `define('<id>_<version>', …)`.
- Same `config/config.json` contracts.
- Debug manifests at `/temp/manifests.js` for the workbench.
- `.sppkg` files validated against the app catalog layout.

See [Deployment guide](./deployment-guide.md) and [../reference/architecture.md](../reference/architecture.md).

## Feature comparison

| Capability | Official toolchain | RSPFx |
|---|---|---|
| Workbench dev server on port 4321 | `gulp serve` | `rspfx dev` |
| Web part and app manifests | Heft plugin | auto-generated |
| Localized resources | Heft | built in, per locale bundles |
| `.sppkg` packaging | `gulp bundle` + `gulp package-solution` | `rspfx package` |
| App catalog deploy | manual | `rspfx deploy` or manual |
| Fast refresh | not available | `rspfx dev --refresh` |
| Bundle analysis | manual setup | `rspfx analyze` |
| Scaffolding | `yo @microsoft/sharepoint` | `npm create vite` + `rspfxVite()` or `rspfx new` |
| Migration | manual | `rspfx migrate` |
| Switch SPFx version | many pins | one field |

For technical details, see [../reference/commands.md](../reference/commands.md) and [../reference/architecture.md](../reference/architecture.md).

## Search terms — SPFx Vite replacement and alternative bundlers

If you searched for "SPFx Vite", "SPFx Vite replacement", "SPFx alternative bundler", "SPFx custom build pipeline", "SPFx replace Webpack", "SPFx custom Webpack", "SharePoint Framework Vite", "SharePoint Framework alternative build tool", "SPFx Rspack", "SPFx esbuild", "SPFx eject webpack", or "SPFx Heft custom toolchain" — RSPFx is that replacement.

RSPFx is the SPFx Vite replacement that keeps SharePoint compatibility while replacing the old webpack + Heft + gulp toolchain.

### SPFx Vite and SharePoint Framework Vite

RSPFx is the SharePoint Framework Vite integration.

Use Vite as the SPFx Vite bundler via `rspfxVite()` in `vite.config.ts` — see [Getting started](./getting-started.md).

Dev runs on `vite dev --port 4321`; build via `rspfx build`/`rspfx package` still emits `.sppkg`.

SharePoint Framework Vite means same manifests and `.sppkg` as official SPFx, but with Vite HMR and esbuild speed.

### SPFx alternative bundler and SharePoint Framework alternative build tool

RSPFx is the SPFx alternative bundler and SharePoint Framework alternative build tool.

Pick Vite (default), Rsbuild, or Rspack — one plugin import switches bundler, same AMD output.

See [../reference/architecture.md](../reference/architecture.md).

### SPFx custom build pipeline

RSPFx is the SPFx custom build pipeline without Heft.

No gulp → Heft → webpack chain — `rspfx` calls the bundler directly; customize via `vite.config.ts`/`rspack.config.ts`/`rsbuild.config.ts`.

See [../reference/commands.md](../reference/commands.md).

### SPFx replace Webpack, SPFx custom Webpack, SPFx eject webpack

RSPFx lets you SPFx replace Webpack or SPFx eject webpack entirely.

It removes `config/spfx-customize-webpack.js` and the Heft rig — `rspfx migrate` deletes it and writes `vite.config.ts`.

If your custom webpack only added aliases, delete it; if it used real webpack plugins, re-add them as Vite/Rspack plugins.

See [Migration from SPFx](./migration/migration-from-spfx.md) and [Migrating from gulp and Heft](./migration/migrating-from-gulp-heft.md).

### SPFx Rspack and SPFx esbuild

RSPFx supports SPFx Rspack (`RSpfxPlugin` on `@rspack/core`) and SPFx esbuild (Vite dev uses esbuild).

Pick Vite for esbuild speed and simple CSS; pick Rspack when you need webpack-compatible loaders.

See [../reference/performance.md](../reference/performance.md).

### SPFx Heft custom toolchain

RSPFx is the SPFx Heft custom toolchain replacement — it drops Heft, rigs, and `sp-build-web`; version switching becomes `spfxVersion: '1.24'` in one file, validated by `rspfx doctor`.

See [Migrating from gulp and Heft](./migration/migrating-from-gulp-heft.md).
