# Why RSPFx

RSPFx is a drop-in replacement for the official SPFx toolchain (gulp + Heft + webpack). It builds the same SharePoint Framework solutions — same manifests, same AMD bundles, same `.sppkg` — with Vite (default), Rsbuild, or Rspack. See Microsoft docs: [SharePoint Framework overview](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/sharepoint-framework-overview) and [SharePoint Framework toolchain](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/sharepoint-framework-toolchain).

You keep `config/config.json`, `config/package-solution.json`, and `src/*/*.manifest.json`. RSPFx reads them and runs the bundler for you. No Heft rig, no gulpfile, no webpack config.

> **Tip:** Start zero-config — `rspfx build` and `rspfx dev` synthesize config from your manifests. Add a bundler file only when you need custom loaders or CSS. See [getting-started.md](getting-started.md).

## Zero config for standard layouts

Official SPFx needs `gulpfile.js`, Heft `tsconfig.json` extends, `config/config.json`, `config/serve.json`, `config/write-manifests.json`, `config/package-solution.json`, and `.yo-rc.json`.

RSPFx needs none of them. Existing manifests work as-is.

When you want control, one plugin is enough:

```ts
// vite.config.ts — optional
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxVite({ name: 'my-app', version: '1.0.0', spfxVersion: '1.22', framework: 'react' })] };
```

See [migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx](migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx).

> **Tip:** Most web parts don't need `@microsoft/sp-*` installed — RSPFx externalizes them. Install only if you import that runtime (e.g. `@microsoft/sp-http`).

## Any modern bundler — not just webpack

| Bundler | Config | Build + dev |
|---|---|---|
| **Vite** (default) | `vite.config.ts` + `rspfxVite` | ✅ |
| **Rsbuild** | `rsbuild.config.ts` + `rspfxRsbuild` | ✅ |
| **Rspack** | `rspack.config.ts` + `RspfxPlugin` | ✅ |
| **Turbopack** | — | ❌ no bundler plugin API; see [roadmap.md](roadmap.md) |

Official toolchain is webpack 5 only.

> **Tip:** Pick Vite unless you need Rspack features — fastest loop, simplest CSS. Rank: Vite > Rsbuild > Rspack. See [styling.md](styling.md).

## Every UI framework — not just React

| Framework | Official SPFx | RSPFx |
|---|---|---|
| React / Vanilla TS | ✅ | ✅ |
| Solid / Preact / Vue / Svelte | ❌ | ✅ built-in (`@mbsks/rspfx-framework-*`) |
| Other frameworks | ❌ manual setup | ✅ one-file `FrameworkPreset` (`packages/plugin-api/src/types.ts:29`) + `BaseWebPart` (`packages/core/src/base-web-part.ts:10`) via `definePlugin`/`registerPlugin` (`packages/plugin-api/src/registry.ts:5`) — see [custom-framework.md](custom-framework.md) |

Built-ins are `@mbsks/rspfx-framework-*`. Any other framework works with one file — `FrameworkPreset` + `BaseWebPart`, `registerPlugin(definePlugin({ frameworkPreset }))` in `vite.config.ts`/`rsbuild.config.ts`/`rspack.config.ts`, `framework: 'my-framework' as const`; no CLI fork. See [frameworks.md](frameworks.md) and [custom-framework.md](custom-framework.md).

## Switch SPFx versions in one line

Official: update generator, Heft, rigs, `sp-build-web`, every `sp-*` pin, and `heft.json` extends.

RSPFx: change `spfxVersion: '1.24'` in your bundler config and run `bun update @mbsks/rspfx-*` (or `pnpm update` / `npm update` / `yarn upgrade`). See [upgrading-spfx-version.md](upgrading-spfx-version.md) and [compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix).

## Faster and modern

- 5–10× faster than webpack 5 (Vite/Rsbuild/Rspack + SWC, Rspack caches to disk).
- No task runner — `rspfx` calls the bundler directly (no gulp → Heft → webpack).
- Save → rebuild → auto-reload; `rspfx dev --refresh` preserves state where supported. See [fast-refresh.md](fast-refresh.md).
- ESM-only, Node ≥ 20, no gulpfile/Heft; `rspfx doctor` and `rspfx migrate` replace cryptic stack traces and manual migration. See [commands.md](commands.md).

## Still 100% SPFx-compatible

- Byte-compatible AMD bundles (`define('<id>_<version>', …)`).
- Same `config/config.json` contracts — shared between Heft/Gulp and RSPFx.
- Debug manifests at `/temp/manifests.js` for the workbench; `.sppkg` validated against the app catalog layout. See [deployment.md](deployment.md) and Microsoft docs: [Extensions overview](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/extensions/overview-extensions) and [Library component overview](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/library-component-overview).

## Feature comparison

| Capability | Official toolchain | RSPFx |
|---|---|---|
| Workbench dev server (`:4321`) | `gulp serve` | `rspfx dev` (zero-config) |
| Web part + app manifests | Heft plugin | Auto-generated |
| Localized resources | Heft | Built-in (per-locale bundles) |
| `.sppkg` packaging | `gulp bundle` + `gulp package-solution` | `rspfx package` |
| App catalog deploy | Manual / CI scripts | `rspfx deploy` or manual |
| Fast refresh | — | `rspfx dev --refresh` (react/preact/vue/svelte/solid) |
| Bundle analysis | Manual `webpack-bundle-analyzer` | `rspfx analyze` |
| Scaffolding | `yo @microsoft/sharepoint` | `npm create vite@latest` (or `pnpm`/`yarn`/`bun`/`deno`) + `rspfxVite()` (or `rspfx new` shortcut); also `better-t-stack`, TanStack Router, Rsbuild/Rspack starters |
| Migrate existing project | Manual edits | `rspfx migrate --dry-run` → `rspfx migrate` (or BYOS plugin for greenfield) |
| Switch SPFx version | Update generator + rig + Heft + every `sp-*` | Change `spfxVersion` + `bun update` / `pnpm update` |

## Search terms — SPFx Vite replacement and alternative bundlers

If you searched for "SPFx Vite", "SPFx Vite replacement", "SPFx alternative bundler", "SPFx custom build pipeline", "SPFx replace Webpack", "SPFx custom Webpack", "SharePoint Framework Vite", "SharePoint Framework alternative build tool", "SPFx Rspack", "SPFx esbuild", "SPFx eject webpack", or "SPFx Heft custom toolchain" — RSPFx is that replacement.

RSPFx is the SPFx Vite replacement that keeps SharePoint compatibility while replacing the old webpack + Heft + gulp toolchain.

### SPFx Vite and SharePoint Framework Vite

RSPFx is the SharePoint Framework Vite integration.

Use Vite as the SPFx Vite bundler via `rspfxVite()` in `vite.config.ts` — see [getting-started.md](getting-started.md) and [project-structure.md](project-structure.md).

Dev runs on `vite dev --port 4321` with `rspfxVite()` `configureServer` serving `/temp/manifests.js`; build runs via `rspfx build`/`rspfx package` so `.sppkg` is still generated.

SharePoint Framework Vite means the same manifests and `.sppkg` as official SPFx, but with Vite HMR and esbuild/SWC speed.

### SPFx alternative bundler and SharePoint Framework alternative build tool

RSPFx is the SPFx alternative bundler and SharePoint Framework alternative build tool.

Bundlers: Vite (default, esbuild-based dev + Rollup build), Rsbuild, and Rspack (Rust webpack-compatible).

Same `config/config.json` → same AMD output (`packages/core/src/build.ts:1`), so you can switch bundler with one plugin import and keep deploying the same `.sppkg`.

See [architecture.md](architecture.md) and [commands.md#bundler-plugin](commands.md#bundler-plugin).

### SPFx custom build pipeline

RSPFx is the SPFx custom build pipeline without Heft.

No gulp task → Heft → webpack chain — `rspfx` calls the bundler directly (`packages/core/src/build.ts:1`, `packages/compiler-rspack/src/config.ts:44`, `packages/plugin/src/vite.ts:1`).

Customize via `vite.config.ts`/`rspack.config.ts`/`rsbuild.config.ts` plugins, `FrameworkPreset` (`packages/plugin-api/src/types.ts:29`), and `compilerHooks` — not a Heft rig.

See [project-structure.md](project-structure.md) and [extending-runtime.md](extending-runtime.md).

### SPFx replace Webpack, SPFx custom Webpack, SPFx eject webpack

RSPFx lets you SPFx replace Webpack, use an SPFx custom Webpack setup without maintaining it, or SPFx eject webpack entirely.

Official SPFx is webpack 5 only via `spfx-customize-webpack.js`.

RSPFx removes `config/spfx-customize-webpack.js` and the rig (`migrating-from-gulp-heft.md#what-gets-removed`) — `rspfx migrate` deletes it and writes `vite.config.ts`/`rspack.config.ts`.

If your custom webpack only added aliases or polyfills, delete it and build without it — `rspfx doctor` validates.

If you needed real webpack plugins, re-add them as Vite/Rspack plugins in the new config.

This is the supported way to eject webpack from SPFx and stay on supported SPFx versions via `spfxVersion` (`packages/core/src/versions.ts:24`).

See [migrating-from-gulp-heft.md](migrating-from-gulp-heft.md) and [compatibility.md](compatibility.md).

### SPFx Rspack and SPFx esbuild

RSPFx supports SPFx Rspack and SPFx esbuild paths.

SPFx Rspack: `RSpfxPlugin` (`packages/plugin/src/rspack.ts:1`) on `@rspack/core` (`packages/compiler-rspack/package.json:38`) — Rust bundler, SWC, disk cache, `output.library.type: 'amd'`.

SPFx esbuild: Vite dev uses esbuild for fast transforms; production build uses Vite/Rollup with SWC — you get esbuild speed without changing SPFx output.

Pick Vite (esbuild + simple CSS) by default, Rsbuild/Rspack when you need webpack-compatible loaders.

See [performance.md](performance.md) and [why-rspfx.md#any-modern-bundler--not-just-webpack](why-rspfx.md#any-modern-bundler--not-just-webpack).

### SPFx Heft custom toolchain and SPFx Heft replacement

RSPFx is the SPFx Heft custom toolchain replacement.

It replaces Heft, `spfx-heft-plugins`, `spfx-web-build-rig`, `rush-stack-compiler-*`, and `sp-build-web` — `rspfx migrate` removes them from `package.json` and deletes `config/rig.json`/`config/typescript.json`/`config/sass.json` (`migrating-from-gulp-heft.md#what-rspfx-migrate-does`).

Version switching becomes `spfxVersion: '1.24'` in one file, not Heft rig + generator + every `sp-*` pin.

Local toolchain validation: `rspfx doctor` checks Node 20+, manifests, externals, and cert.

See [migrating-from-gulp-heft.md](migrating-from-gulp-heft.md) and [compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix).
