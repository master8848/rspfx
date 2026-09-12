# Custom framework reference

This page lists the technical contract for custom frameworks in RSPFx: `FrameworkPreset` methods, `BaseWebPart` hooks, registration APIs, and resolution flow.

For built-in frameworks see `docs/frameworks.md`; for authoring prose see `docs/custom-framework.md`; for package surfaces see `docs/internal-api.md`.

## Contract

| Part | Import | Fact home |
|---|---|---|
| `FrameworkPreset` | `import type { FrameworkPreset } from '@mbsks/rspfx-plugin-api'` | `packages/plugin-api/src/types.ts:29` |
| `BaseWebPart` subclass | `import { BaseWebPart } from '@mbsks/rspfx-core/webpart'` | `packages/core/src/base-web-part.ts:10` |

`FrameworkId` is the open string union in `packages/core/src/config.ts:4`; custom ids use `(string & {})` as `FrameworkPreset<string>`.

Builtin `packages/framework-<name>` split into `index` (preset, Node-safe) and `/webpart` (class) and `/headless` (adapter); external frameworks may colocate behind separate paths.

## Preset methods

| Method | Return type | Required | Fallback |
|---|---|---|---|
| `rspack({ fastRefresh })` | `FrameworkRspackContributions` (`packages/plugin-api/src/types.ts:3`) | yes | — |
| `contributions({ fastRefresh })` | `FrameworkRspackContributions` (`packages/plugin-api/src/types.ts:3`) | no | deprecated alias for `rspack()` |
| `vite({ fastRefresh })` | `FrameworkViteContributions` (`packages/plugin-api/src/types.ts:12`) | no | `rspfxVite` (`packages/plugin/src/vite.ts:299`) warns and runs without Vite contributions |
| `rsbuild({ fastRefresh })` | `FrameworkRsbuildContributions` (`packages/plugin-api/src/types.ts:21`) | no | `rspfxRsbuild` (`packages/plugin/src/rsbuild.ts:354`) falls back to `rspack()` minus `swc` |

`fastRefresh` reflects `dev.fastRefresh` (`packages/core/src/config.ts:138`) or `RSPFX_FAST_REFRESH=1` / `rspfx dev --refresh` (`apps/cli/src/commands/dev.ts:80`). Merged by `@mbsks/rspfx-compiler-rspack`, `rspfxVite`, `rspfxRsbuild`.

```ts
import type { FrameworkPreset } from '@mbsks/rspfx-plugin-api';
import ReactRefreshRspackPlugin from '@rspack/plugin-react-refresh';
export const myPreset: FrameworkPreset<'my-framework'> = {
  name: 'my-framework',
  rspack({ fastRefresh }) {
    return {
      rules: [{ test: /\.tsx?$/, use: { loader: 'builtin:swc-loader', options: { jsc: { parser: { syntax: 'typescript', jsx: true } } } } }],
      swc: { jsc: { transform: { react: { runtime: 'automatic', development: fastRefresh } } } },
      plugins: fastRefresh ? [new ReactRefreshRspackPlugin()] : [],
      resolve: { extensions: ['.ts', '.tsx', '.js'] }
    };
  },
  vite({ fastRefresh }) { return { plugins: fastRefresh ? [myVitePlugin()] : [], esbuild: { jsx: 'automatic' } }; },
  rsbuild({ fastRefresh }) { return { rules: [], plugins: fastRefresh ? [new ReactRefreshRspackPlugin()] : [], resolve: { extensions: ['.ts', '.tsx'] } }; },
};
```

Bare loader strings in `rules[].use` not prefixed `builtin:` are resolved via `resolveContributionLoaders` (`packages/dev-runtime/src/project.ts:759`).

## Web part hooks

| Hook | Signature | Contract |
|---|---|---|
| `getComponentProps()` | `(): TProps` | Derive props from `this.properties` |
| `renderInto(root: HTMLElement)` | `(root: HTMLElement) => void` | Mount into `root` (`this.domElement`) |
| `disposeFrom(root: HTMLElement)` | `(root: HTMLElement) => void` | Tear down effects and listeners |

`BaseWebPart.render()` calls `renderInto(this.domElement)`; `onDispose()` calls `disposeFrom(this.domElement)` (`packages/core/src/base-web-part.ts:10`).

```ts
import { BaseWebPart } from '@mbsks/rspfx-core/webpart';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactElement } from 'react';
const roots = new WeakMap<HTMLElement, Root>();
export abstract class MyWebPart<TProps extends Record<string, unknown>> extends BaseWebPart<TProps> {
  protected abstract renderComponent(props: TProps): ReactElement;
  protected renderInto(root: HTMLElement): void {
    const r = roots.get(root) ?? createRoot(root);
    roots.set(root, r);
    r.render(this.renderComponent(this.getComponentProps()));
  }
  protected disposeFrom(root: HTMLElement): void { roots.get(root)?.unmount(); roots.delete(root); }
  protected getComponentProps(): TProps { return this.properties; }
}
```

Per-root `WeakMap` follows builtin pattern; dispose-then-recreate for Solid/Vue/Svelte, re-render in place for React/Preact (see `docs/frameworks.md#mount-semantics`). Keep class in browser-only path (e.g., `src/framework/my-webpart.ts` or separate `/webpart` subpath).

## Registration

| API | Package | File |
|---|---|---|
| `definePlugin`, `registerPlugin`, `getPlugins` | `@mbsks/rspfx-plugin-api` | `packages/plugin-api/src/registry.ts:5` |

`registerPlugin` writes to in-memory registry read by `getPlugins()` during build/dev. Must execute at top level before `RspfxPlugin` resolves framework; config runs synchronously via `jiti` (`apps/cli/src/config.ts:69`).

```ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';
import { definePlugin, registerPlugin } from '@mbsks/rspfx-plugin-api';
import { myPreset } from './src/framework/my-preset.js';
registerPlugin(definePlugin({ name: 'my-framework-ext', frameworkPreset: myPreset }));
export default { plugins: [new RspfxPlugin({ name: 'my-app', framework: 'my-framework' as const, spfxVersion: '1.23' })] };
```

`RspfxConfig.framework` (`packages/core/src/config.ts:54`) accepts any string; use `as const` for literal. No CLI change required.

### Bundler variants

| Config | Plugin | Preset method |
|---|---|---|
| `rspack.config.ts` | `RspfxPlugin` (`@mbsks/rspfx-plugin`) | `rspack()` (alias `contributions()`) |
| `vite.config.ts` | `rspfxVite` (`@mbsks/rspfx-plugin`) | `vite()` then `resolveContributionLoaders` |
| `rsbuild.config.ts` | `rspfxRsbuild` (`@mbsks/rspfx-plugin`) | `rsbuild()` then `resolveContributionLoaders` |

## Hot reload per framework

Gate HMR plugins on `fastRefresh`; prod stays clean. Pipeline passes `fastRefresh: true` only for `rspfx dev --refresh` or `dev.fastRefresh: true` (`packages/dev-runtime/src/serve.ts:167`, `packages/plugin/src/vite.ts:545`, `packages/plugin/src/rsbuild.ts:445`).

| Bundler | Preset method | When `fastRefresh: true` | Reference |
|---|---|---|---|
| `rspack` (React) | `rspack()` | `plugins: [new ReactRefreshRspackPlugin()]` + `swc.jsc.transform.react.development: true` | `packages/framework-react/src/index.ts:23` |
| `rspack` (Preact) | `rspack()` | `plugins: [new PreactRefreshRspackPlugin()]` via `@rspack/plugin-preact-refresh` | `packages/framework-preact/src/index.ts:28` |
| `rspack` (Svelte) | `rspack()` | `svelte-loader` with `{ hotReload: true, compilerOptions: { dev: true } }` | `packages/framework-svelte/src/index.ts:51` |
| `rspack` (Solid) | `rspack()` | `babel-loader` with `solid-refresh/babel` or `builtin:swc-loader` with `rspackExperiments.swcPlugins` | `packages/framework-solid/src/index.ts:33` |
| `rspack` (Vue) | `rspack()` | `vue-loader` + `VueLoaderPlugin` (HMR always on; ignore `fastRefresh`) | `packages/framework-vue/src/index.ts:19` |
| `vite` (React) | `vite()` | `import react from '@vitejs/plugin-react'` | `packages/framework-react/src/index.ts:39` |
| `vite` (Preact) | `vite()` | `import preact from '@prefresh/vite'` | `packages/framework-preact/src/index.ts:56` |
| `vite` (Svelte) | `vite()` | `import { svelte } from '@sveltejs/vite-plugin-svelte'` with `{ hot: true }` | `packages/framework-svelte/src/index.ts:78` |
| `rsbuild` | `rsbuild()` | Same as rspack; missing `rsbuild()` falls back to `rspack()` minus `swc` | `packages/plugin/src/rsbuild.ts:445` |

Missing peers stubbed via `BUILD_TIME_ALIASES` (`packages/compiler-rspack/src/config.ts:16`); fallback to full reload (`packages/dev-runtime/src/serve.ts:335`). `RefreshRuntime` (`packages/dev-runtime/src/refresh.ts:21`) suppresses reload when `fastRefresh` and framework != `vanilla`.

## Source maps

Presets do not set `devtool`/`sourcemap`; pipeline owns it. `createRspackConfig` sets `devtool: 'source-map'` (dev) and `hidden-source-map` only when `build.sourcemap: true` (`packages/compiler-rspack/src/config.ts:143`); `rspfxVite`/`rspfxRsbuild` mirror it. Enable prod maps with `build.sourcemap: true` (`packages/core/src/config.ts:18`) or `rspfx build --sourcemap` (`apps/cli/src/commands/build.ts:223`).

## Resolution flow

`loadFrameworkPreset` (`packages/dev-runtime/src/project.ts:737`) order: `createRequire(projectRoot/package.json)` for `@mbsks/rspfx-framework-<id>` (records `__rspfxModuleUrl` for loader resolution), then in-memory registry via `registerPlugin`, then no-op preset with warning.

`resolveContributionLoaders` (`packages/dev-runtime/src/project.ts:759`) rewrites `rules[].use` loader and Babel strings via `createRequire(frameworkModuleUrl).resolve`; `builtin:swc-loader` unchanged.

## Limits

- `packages/templates` and `rspfx new` remain builtin-only. For custom framework: `rspfx new my-app --framework vanilla --yes`, add `src/framework/my-preset.ts` + `src/framework/my-webpart.ts`, register in bundler config, update `src/webparts/<name>/<name>WebPart.ts` to extend `MyWebPart`.
- Custom ids share open `FrameworkId` — no validation beyond string identity.
- `rspfx new --help`, `rspfx doctor`, and prompts cover builtin ids only; `doctor` reports missing package but build succeeds via registry fallback.
- `resolveContributionLoaders` rewrites only `rules[].use` and Babel strings; `swc`, `define`, `resolve` are merged without path rewriting.
