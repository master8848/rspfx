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
