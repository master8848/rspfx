# Why RSPFX

RSPFX is a drop-in replacement for the official SPFx toolchain (gulp + Heft + webpack). It builds the same SharePoint Framework solutions — same manifests, same AMD bundles, same `.sppkg` — with Vite (default), Rsbuild, or Rspack. See Microsoft docs: [SharePoint Framework overview](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/sharepoint-framework-overview) and [SharePoint Framework toolchain](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/sharepoint-framework-toolchain).

You keep `config/config.json`, `config/package-solution.json`, and `src/*/*.manifest.json`. RSPFX reads them and runs the bundler for you. No Heft rig, no gulpfile, no webpack config.

> **Tip:** Start zero-config — `rspfx build` and `rspfx dev` synthesize config from your manifests. Add a bundler file only when you need custom loaders or CSS. See [getting-started.md](getting-started.md).

## Zero config for standard layouts

Official SPFx needs `gulpfile.js`, Heft `tsconfig.json` extends, `config/config.json`, `config/serve.json`, `config/write-manifests.json`, `config/package-solution.json`, and `.yo-rc.json`.

RSPFX needs none of them. Existing manifests work as-is.

When you want control, one plugin is enough:

```ts
// vite.config.ts — optional
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxVite({ name: 'my-app', version: '1.0.0', spfxVersion: '1.22', framework: 'react' })] };
```

See [migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx](migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx).

> **Tip:** Most web parts don't need `@microsoft/sp-*` installed — RSPFX externalizes them. Install only if you import that runtime (e.g. `@microsoft/sp-http`).

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

| Framework | Official SPFx | RSPFX |
|---|---|---|
| React / Vanilla TS | ✅ | ✅ |
| Solid / Preact / Vue / Svelte | ❌ | ✅ built-in (`@mbsks/rspfx-framework-*`) |
| Other frameworks | ❌ manual setup | ✅ one-file `FrameworkPreset` (`packages/plugin-api/src/types.ts:29`) + `BaseWebPart` (`packages/core/src/base-web-part.ts:10`) via `definePlugin`/`registerPlugin` (`packages/plugin-api/src/registry.ts:5`) — see [custom-framework.md](custom-framework.md) |

Built-ins are `@mbsks/rspfx-framework-*`. Any other framework works with one file — `FrameworkPreset` + `BaseWebPart`, `registerPlugin(definePlugin({ frameworkPreset }))` in `vite.config.ts`/`rsbuild.config.ts`/`rspack.config.ts`, `framework: 'my-framework' as const`; no CLI fork. See [frameworks.md](frameworks.md) and [custom-framework.md](custom-framework.md).

## Switch SPFx versions in one line

Official: update generator, Heft, rigs, `sp-build-web`, every `sp-*` pin, and `heft.json` extends.

RSPFX: change `spfxVersion: '1.24'` in your bundler config and run `bun update @mbsks/rspfx-*` (or `pnpm update` / `npm update` / `yarn upgrade`). See [upgrading-spfx-version.md](upgrading-spfx-version.md) and [compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix).

## Faster and modern

- 5–10× faster than webpack 5 (Vite/Rsbuild/Rspack + SWC, Rspack caches to disk).
- No task runner — `rspfx` calls the bundler directly (no gulp → Heft → webpack).
- Save → rebuild → auto-reload; `rspfx dev --refresh` preserves state where supported. See [fast-refresh.md](fast-refresh.md).
- ESM-only, Node ≥ 20, no gulpfile/Heft; `rspfx doctor` and `rspfx migrate` replace cryptic stack traces and manual migration. See [commands.md](commands.md).

## Still 100% SPFx-compatible

- Byte-compatible AMD bundles (`define('<id>_<version>', …)`).
- Same `config/config.json` contracts — shared between Heft/Gulp and RSPFX.
- Debug manifests at `/temp/manifests.js` for the workbench; `.sppkg` validated against the app catalog layout. See [deployment.md](deployment.md) and Microsoft docs: [Extensions overview](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/extensions/overview-extensions) and [Library component overview](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/library-component-overview).

## Feature comparison

| Capability | Official toolchain | RSPFX |
|---|---|---|
| Workbench dev server (`:4321`) | `gulp serve` | `rspfx dev` (zero-config) |
| Web part + app manifests | Heft plugin | Auto-generated |
| Localized resources | Heft | Built-in (per-locale bundles) |
| `.sppkg` packaging | `gulp bundle` + `gulp package-solution` | `rspfx package` |
| App catalog deploy | Manual / CI scripts | `rspfx deploy` or manual |
| Fast refresh | — | `rspfx dev --refresh` (react/preact/vue/svelte/solid) |
| Bundle analysis | Manual `webpack-bundle-analyzer` | `rspfx analyze` |
| Scaffolding | `yo @microsoft/sharepoint` | `rspfx new` |
| Migrate existing project | Manual edits | `rspfx migrate --dry-run` → `rspfx migrate` |
| Switch SPFx version | Update generator + rig + Heft + every `sp-*` | Change `spfxVersion` + `bun update` / `pnpm update` |
