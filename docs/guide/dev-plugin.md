# Lean vite-first dev plugin

TL;DR: Use `@mbsks/rspfx-plugin-dev` when you only need `vite dev` on Vite. It is lean, vite-first, and reuses `@mbsks/rspfx-dev-runtime`.

Use `@mbsks/rspfx-plugin` when you need build and package (`rspfx build`, `rspfx package`, `vite build` per-bundle, Rsbuild, Rspack) — it includes `@rspack/core` and framework integrations.

## When to use which

| Need | Package | Import |
|---|---|---|
| `vite dev` only (Vite) | `@mbsks/rspfx-plugin-dev` | `rspfxViteDev` / `rspfxDevPlugin` |
| `vite dev` + `rspfx build`/`package` | `@mbsks/rspfx-plugin` | `rspfxVite` / `rspfxRsbuild` / `RSpfxPlugin` |

`vite dev` is primary — Vite handles HMR/serve, the plugin just adds `/temp/manifests.js`, reload, and workbench URL via `configureServer`. `rspfx dev` is an optional CLI alternative using the same dev-runtime. Both carry `RspfxConfig` via `RSPFX_PLUGIN_MARKER` (`@mbsks/rspfx-core:68`) and can be discovered by `rspfx dev` via `jiti`.

## Install (vite-first)

```sh
npm i -D @mbsks/rspfx-plugin-dev @mbsks/rspfx-cli
```

`vite` is a peer optional (`^5 || ^6 || ^7 || ^8`). `react`, `sass`, `@fluentui/react`, and framework packages are also peer optional — `rspfxDevPlugin` loads the framework preset dynamically and warns when absent, so `framework: 'react'` works without `react` installed (fast refresh degrades gracefully).

## vite.config.ts

```ts
import { defineConfig } from 'vite';
import { rspfxDevPlugin } from '@mbsks/rspfx-plugin-dev';
// alias: rspfxViteDev, or subpath import '@mbsks/rspfx-plugin-dev/vite'

export default defineConfig({
  plugins: [rspfxDevPlugin({ name: 'my-app', framework: 'react', spfxVersion: '1.24' })],
});
```

Options are `RspfxPluginOptions` (`packages/plugin-dev/src/types.ts:3`): `name`, `framework`, `spfxVersion`, `dev`, `paths`, `projectRoot`, etc. — same shape as the full plugin.

## What it does

`rspfxViteDev` / `rspfxDevPlugin` only hooks `configureServer` (`packages/plugin-dev/src/vite.ts:75`) — Vite owns the server/HMR, the plugin augments it:

- resolves project (`readProject`), serve settings (`resolveServeSettings`), and mode (`resolveServeMode`);
- ensures certs (`ensureCertificates` in `~/.rspfx/certs`) when `https`;
- loads the framework preset dynamically (`loadFrameworkPreset`) — peer optional;
- creates `createManifestRegenerator` + `createReloadController` and serves `/temp/manifests.js` and `/__rspfx_hot.json` via `middlewares.use`;
- ticks `reload` after regeneration (poll → `location.reload()`); debounces watcher `change`/`add`/`unlink` at 250 ms.

No bundler build, no `@rspack/core`, no `sass`, no emitted `dist/` bundles beyond what Vite itself builds.

## Shared build helpers

`@mbsks/rspfx-build-core` (`packages/build-core/src/index.ts:1`) holds the lean helpers both plugins share:

- `amd.ts` — `amdName`, `computeUniqueName`, `cacheVersionHash`
- `externals.ts` — `collectExternals`, `platformOnlyExternal`
- `defines.ts` — `createDefineMap`, `ALLOWED_DEFINE_KEYS`
- `css.ts` — `hasPostcssConfig`, `inlineStyleCode`
- `output.ts` — `createSpfxOutput`, `SPFX_PUBLIC_PATH_SENTINEL`

Zero heavy deps (`@mbsks/rspfx-core`, `@mbsks/rspfx-diagnostics`, `@mbsks/rspfx-manifest-generator`, `@mbsks/rspfx-plugin-api` only).

## Extensibility

`plugin-dev` is the vite-first reference for a minimal dev plugin. The same pattern extends to Rsbuild/Rspack:

- implement `configureServer` (Vite) or `setup(api)` with `onBeforeStartDevServer`/`onAfterStartDevServer` (Rsbuild) / `apply(compiler)` (Rspack);
- reuse `readProject`, `resolveServeSettings`, `createManifestRegenerator`, `createReloadController`, `buildWorkbenchUrl` from `@mbsks/rspfx-dev-runtime`;
- keep `vite`/`@rsbuild/core`/`@rspack/core` as peer optional.

Contributions welcome — open an issue with your bundler target.

## Switching to the full plugin

When you need `rspfx build`/`rspfx package` (`vite build` alone does not generate `manifests.js`/`.sppkg`):

```sh
npm i -D @mbsks/rspfx-plugin
# vite.config.ts: replace rspfxDevPlugin with rspfxVite from '@mbsks/rspfx-plugin'
```
