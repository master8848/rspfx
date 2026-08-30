# Lean vite-first dev plugin

TL;DR: Use `@mbsks/rspfx-plugin-dev` when you only need `vite dev` on Vite. It is lean, vite-first, and reuses `@mbsks/rspfx-dev-runtime`.

Use `@mbsks/rspfx-plugin` when you need build and package (`rspfx build`, `rspfx package`, `vite build` per-bundle, Rsbuild, Rspack) — it includes `@rspack/core` and framework integrations.

## When to use which

| Need | Package | Import |
|---|---|---|
| `vite dev` only (Vite) | `@mbsks/rspfx-plugin-dev` | `rspfxViteDev` / `rspfxDevPlugin` |
| `vite dev` + `rspfx build`/`package` | `@mbsks/rspfx-plugin` | `rspfxVite` / `rspfxRsbuild` / `RSpfxPlugin` |

`vite dev` is primary — Vite handles HMR/serve, the plugin just adds `/temp/manifests.js`, reload, and workbench URL via `configureServer`. `rspfx dev` is an optional CLI alternative using the same dev-runtime. Both carry `RspfxConfig` via `RSPFX_PLUGIN_MARKER` (`@mbsks/rspfx-core:68`) and can be discovered by `rspfx dev` via `jiti`.

## Fastest — `rspfx dev:vite` (auto-generates this config)

In any existing SPFx project, run `rspfx dev:vite` and the CLI does the install and `vite.config.ts` for you.

See `docs/guide/dev-vite.md` and `docs/reference/commands.md#rspfx-devvite`.

```sh
npx @mbsks/rspfx-cli dev:vite --dry-run
npx @mbsks/rspfx-cli dev:vite
```

It detects `spfxVersion`/`framework`/`tsconfig.json`, sets `type: module`, adds `@mbsks/rspfx-plugin-dev` + `vite`, and writes:

```ts
import { defineConfig } from 'vite';
import { rspfxViteDev } from '@mbsks/rspfx-plugin-dev/vite';
export default defineConfig({ plugins: [rspfxViteDev({ name: 'my-app', framework: 'react', spfxVersion: '1.24' })] });
```

## Manual install (vite-first)

```sh
npm i -D @mbsks/rspfx-plugin-dev @mbsks/rspfx-cli
```

`vite` is a peer optional (`^5 || ^6 || ^7 || ^8`). `react`, `sass`, `@fluentui/react`, and framework packages are also peer optional — `rspfxDevPlugin` loads the framework preset dynamically and warns when absent, so `framework: 'react'` works without `react` installed (fast refresh degrades gracefully).

## vite.config.ts (manual)

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

`rspfxViteDev` / `rspfxDevPlugin` hooks `config` + `configureServer` (`packages/plugin-dev/src/vite.ts:110`) — Vite owns the server/HMR, the plugin augments it:

- `config` returns `server.host`/`port`/`https` from `resolveServeSettings` (`packages/dev-runtime/src/serve.ts:60`) + certs (`ensureCertificates` in `~/.rspfx/certs` when `mode === 'sharepoint'` and `https`), and `esbuild.tsconfigRaw` fallback when `tsconfig.json` extends missing `@microsoft/rush-stack-compiler` base;
- `configureServer` resolves project (`readProject`), serve settings (`resolveServeSettings`), and mode (`resolveServeMode`);
- ensures certs lazily when `mode === 'sharepoint'` and `https` (already ensured in `config`);
- loads the framework preset dynamically (`loadFrameworkPreset`) — peer optional;
- creates `createManifestRegenerator` + `createReloadController` and serves `/temp/manifests.js` and `/__rspfx_hot.json` via `middlewares.use`;
- ticks `reload` after regeneration (poll → `location.reload()`); debounces watcher `change`/`add`/`unlink` at 250 ms.

No bundler build, no `@rspack/core`, no `sass`, no emitted `dist/` bundles beyond what Vite itself builds.

`mode === 'local'` (no `tenantDomain`/`tenantUrl`) forces `https: false` (`packages/dev-runtime/src/serve.ts:131`) — certs only for `sharepoint` (`packages/plugin-dev/src/vite.ts:122`).

Tsconfig with `extends: @microsoft/rush-stack-compiler` and missing base (`node_modules/@microsoft/rush-stack-compiler-*/includes/base.json`) is stubbed and `esbuild.tsconfigRaw` fallback applied — run `rspfx migrate` to rewrite to plain `tsconfig.json` (`packages/templates/src/index.ts:223`).

Requires Node `>=20.0.0` (`package.json:8`), Vite `^5 || ^6 || ^7 || ^8` peer — Node 14 and Vite 8 on Node 14 are unsupported; `rspfx doctor` warns (`apps/cli/src/commands/doctor.ts:159`).

`vite.config.ts` with ESM `import`/`export default` and `package.json` without `"type": "module"` warns with Vite 8 `configLoader: 'native'` (`ESM syntax in a file loaded as CommonJS`) — rename to `vite.config.mts`/`vite.config.mjs` or add `"type": "module"`.

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
