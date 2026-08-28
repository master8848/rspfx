# Custom Framework Extensibility

External frameworks extend rspfx without modifying the CLI or built-in packages.

See [frameworks](frameworks.md) for built-in frameworks, [internal-api](internal-api.md) for package surfaces, [architecture](architecture.md) for the pipeline, [commands](commands.md) for CLI flags.

Built-in presets cover React, Vue, Svelte, Solid, Preact and vanilla; Angular, Lit, Qwik, Astro, Ember, Stencil, Alpine, Mithril and Inferno are implemented as custom frameworks via the FrameworkPreset contract below.

## Contract

A framework provides two parts that the pipeline consumes separately:

| Part | Import | Fact home |
|---|---|---|
| `FrameworkPreset` | `import type { FrameworkPreset } from '@mbsks/rspfx-plugin-api'` | `packages/plugin-api/src/types.ts:29` |
| `BaseWebPart` subclass | `import { BaseWebPart } from '@mbsks/rspfx-core/webpart'` | `packages/core/src/base-web-part.ts:10` |

`FrameworkId` is the open string union defined in [internal-api](internal-api.md) (`packages/core/src/config.ts:4`); custom ids use the `(string & {})` branch as `FrameworkPreset<string>`.

The preset contributes compiler configuration (rules, swc, plugins, resolve, define); the web part subclass mounts at runtime via `renderInto` / `disposeFrom` / `getComponentProps`.

Builtin packages `packages/framework-<name>` split the contract into two entry points (preset at `@mbsks/rspfx-framework-<fw>`, web part class at `@mbsks/rspfx-framework-<fw>/webpart`); external frameworks may use the same split or colocate exports behind separate import paths.

## Preset

Define `src/framework/my-preset.ts` exporting a preset with a custom `name`:

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
  vite({ fastRefresh }) {
    return { plugins: fastRefresh ? [myVitePlugin()] : [], esbuild: { jsx: 'automatic' } };
  },
  rsbuild({ fastRefresh }) {
    return { rules: [], plugins: fastRefresh ? [new ReactRefreshRspackPlugin()] : [], resolve: { extensions: ['.ts', '.tsx'] } };
  },
  /** @deprecated use rspack() */
  contributions(opts) { return this.rspack(opts); }
};

function myVitePlugin() { return { name: 'my-framework-hmr' }; }
```

| Method | Return type | Required | Fallback |
|---|---|---|---|
| `rspack({ fastRefresh })` | `FrameworkRspackContributions` (`packages/plugin-api/src/types.ts:3`) | yes | — |
| `contributions({ fastRefresh })` | `FrameworkRspackContributions` (`packages/plugin-api/src/types.ts:3`) | no | deprecated alias for `rspack()` |
| `vite({ fastRefresh })` | `FrameworkViteContributions` (`packages/plugin-api/src/types.ts:12`) | no | `rspfxVite` (`packages/plugin/src/vite.ts:299`) warns and runs without Vite contributions |
| `rsbuild({ fastRefresh })` | `FrameworkRsbuildContributions` (`packages/plugin-api/src/types.ts:21`) | no | `rspfxRsbuild` (`packages/plugin/src/rsbuild.ts:354`) falls back to `rspack()` minus `swc` |

`fastRefresh` reflects `dev.fastRefresh` (`packages/core/src/config.ts:138`) or `RSPFX_FAST_REFRESH=1` / `rspfx dev --refresh` (`apps/cli/src/commands/dev.ts:80`) and is merged by `@mbsks/rspfx-compiler-rspack`, `rspfxVite`, and `rspfxRsbuild`.

Bare loader strings in `rules[].use` that are not `builtin:` are resolved against the framework module via `resolveContributionLoaders` (`packages/dev-runtime/src/project.ts:759`).

## Web part class

Define a browser-only base class extending `BaseWebPart`:

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

| Hook | Contract |
|---|---|
| `getComponentProps(): TProps` | Derive props from `this.properties` |
| `renderInto(root: HTMLElement)` | Mount into `root` (`this.domElement`) |
| `disposeFrom(root: HTMLElement)` | Tear down effects and listeners |

`BaseWebPart.render()` calls `renderInto(this.domElement)`; `onDispose()` calls `disposeFrom(this.domElement)`.

Per-root `WeakMap` follows the builtin pattern; dispose-then-recreate applies to Solid/Vue/Svelte-style frameworks while React/Preact re-render in place (see [frameworks](frameworks.md#mount-semantics)).

Keep the web part class in a browser-only path (e.g., `src/framework/my-webpart.ts` or a separate package `/webpart` subpath) and do not import it from the Node-safe preset entry.

## Registration

Register the preset in the bundler config that `jiti` loads (`apps/cli/src/config.ts:69`):

```ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';
import { definePlugin, registerPlugin } from '@mbsks/rspfx-plugin-api';
import { myPreset } from './src/framework/my-preset.js';

registerPlugin(definePlugin({ name: 'my-framework-ext', frameworkPreset: myPreset }));

export default {
  plugins: [new RspfxPlugin({ name: 'my-app', framework: 'my-framework' as const, spfxVersion: '1.23' })]
};
```

| API | Package | File |
|---|---|---|
| `definePlugin`, `registerPlugin`, `getPlugins` | `@mbsks/rspfx-plugin-api` | `packages/plugin-api/src/registry.ts:5` |

`registerPlugin` writes to an in-memory registry read by `getPlugins()` during build and dev.

`registerPlugin` must execute at the top level before `RspfxPlugin` resolves the framework; the config runs synchronously via `jiti`.

`RspfxConfig.framework` (`packages/core/src/config.ts:54`) accepts any string; use `as const` for the custom literal.

No CLI change is required.

## Bundler variants

| Config | Plugin | Preset method |
|---|---|---|
| `rspack.config.ts` | `RspfxPlugin` (`@mbsks/rspfx-plugin`) | `rspack()` (alias `contributions()`) |
| `vite.config.ts` | `rspfxVite` (`@mbsks/rspfx-plugin`) | `vite()` then `resolveContributionLoaders` |
| `rsbuild.config.ts` | `rspfxRsbuild` (`@mbsks/rspfx-plugin`) | `rsbuild()` then `resolveContributionLoaders` |

```ts
// vite.config.ts
import { rspfxVite } from '@mbsks/rspfx-plugin';
import { definePlugin, registerPlugin } from '@mbsks/rspfx-plugin-api';
import { myPreset } from './src/framework/my-preset.js';
registerPlugin(definePlugin({ name: 'my-framework-ext', frameworkPreset: myPreset }));
export default { plugins: [rspfxVite({ name: 'my-app', framework: 'my-framework' as const })] };
```

```ts
// rsbuild.config.ts
import { defineConfig } from '@rsbuild/core';
import { rspfxRsbuild } from '@mbsks/rspfx-plugin';
import { definePlugin, registerPlugin } from '@mbsks/rspfx-plugin-api';
import { myPreset } from './src/framework/my-preset.js';
registerPlugin(definePlugin({ name: 'my-framework-ext', frameworkPreset: myPreset }));
export default defineConfig({ plugins: [rspfxRsbuild({ name: 'my-app', framework: 'my-framework' as const })] });
```

## Hot reload

Gate HMR plugins and compiler flags on `fastRefresh` so prod builds stay clean; the pipeline passes `fastRefresh: true` only for `rspfx dev --refresh` or `dev.fastRefresh: true` (`packages/dev-runtime/src/serve.ts:167`, `packages/plugin/src/vite.ts:545`, `packages/plugin/src/rsbuild.ts:445`).

| Bundler | Preset method | What to return when `fastRefresh: true` | Builtin reference |
|---|---|---|---|
| `rspack` | `rspack({ fastRefresh })` | `plugins: [new ReactRefreshRspackPlugin()]` and `swc.jsc.transform.react.development: true` | `packages/framework-react/src/index.ts:23` |
| `rspack` (Preact) | `rspack({ fastRefresh })` | `plugins: [new PreactRefreshRspackPlugin()]` via `@rspack/plugin-preact-refresh` | `packages/framework-preact/src/index.ts:28` |
| `rspack` (Svelte) | `rspack({ fastRefresh })` | `svelte-loader` with `{ hotReload: true, compilerOptions: { dev: true } }` | `packages/framework-svelte/src/index.ts:51` |
| `rspack` (Solid) | `rspack({ fastRefresh })` | `babel-loader` with `solid-refresh/babel` plugin or `builtin:swc-loader` with `rspackExperiments.swcPlugins` | `packages/framework-solid/src/index.ts:33` |
| `rspack` (Vue) | `rspack()` | `vue-loader` + `VueLoaderPlugin` (HMR is always on; ignore `fastRefresh`) | `packages/framework-vue/src/index.ts:19` |
| `vite` | `vite({ fastRefresh })` | Vite plugin: `@vitejs/plugin-react` / `@prefresh/vite` / `@sveltejs/vite-plugin-svelte { hot: true }` / `@vitejs/plugin-vue` | `packages/framework-react/src/index.ts:39`, `packages/framework-preact/src/index.ts:56`, `packages/framework-svelte/src/index.ts:78` |
| `rsbuild` | `rsbuild({ fastRefresh })` | Same as rspack (`babel-loader` + refresh `plugins`); missing `rsbuild()` falls back to `rspack()` minus `swc` | `packages/framework-react/src/index.ts:46`, `packages/plugin/src/rsbuild.ts:445` |

Missing peers do not break the build; `@mbsks/rspfx-compiler-rspack` stubs `@rspack/plugin-react-refresh`, `@rspack/plugin-preact-refresh`, `vue-loader`, `svelte-loader` via `BUILD_TIME_ALIASES` (`packages/compiler-rspack/src/config.ts:16`) and logs a warning with fallback to full reload (see [fast-refresh.md](fast-refresh.md)).

`RefreshRuntime` (`packages/dev-runtime/src/refresh.ts:21`) is framework-agnostic; it suppresses the full reload when `fastRefresh` is on and the framework is not `vanilla`, otherwise the dev server falls back to reload (`packages/dev-runtime/src/serve.ts:335`).

## Source maps

Presets do not set `devtool` or `sourcemap`; the pipeline owns it.

`createRspackConfig` sets `devtool: 'source-map'` for dev/serve and `devtool: hidden-source-map` only when `build.sourcemap: true` in production (`packages/compiler-rspack/src/config.ts:143`); `rspfxVite` (`packages/plugin/src/vite.ts:648`) and `rspfxRsbuild` (`packages/plugin/src/rsbuild.ts:436`) mirror the same rule.

Enable prod maps with `build.sourcemap: true` in the plugin config (`packages/core/src/config.ts:18`) or `rspfx build --sourcemap` (`apps/cli/src/commands/build.ts:223`); dev maps need no config.

## Resolution flow

`loadFrameworkPreset` (`packages/dev-runtime/src/project.ts:737`) resolves in order: `createRequire(projectRoot/package.json)` for `@mbsks/rspfx-framework-<id>` (records `__rspfxModuleUrl` for loader resolution), then in-memory registry from `registerPlugin`, then a no-op preset with a warning.

`resolveContributionLoaders` (`packages/dev-runtime/src/project.ts:759`) rewrites `rules[].use` loader and Babel preset/plugin strings via `createRequire(frameworkModuleUrl).resolve`; `builtin:swc-loader` is unchanged.

## Angular, Lit, Qwik, Astro, Ember, Stencil, Alpine, Mithril, Inferno

This guide is the entry point for Angular, Lit, Qwik, Astro, Ember, Stencil, Alpine, Mithril and Inferno. Implement FrameworkPreset and a BaseWebPart subclass per Contract, Preset and Web part class above, then register with `definePlugin`/`registerPlugin`. See [frameworks.md](frameworks.md#looking-for-angular-lit-or-qwik) for the comparison table.

## Scaffolding and limits

- `packages/templates` and `rspfx new` remain builtin-only.

- To use a custom framework in a new project: `rspfx new my-app --framework vanilla --yes`, add `src/framework/my-preset.ts` and `src/framework/my-webpart.ts`, register the preset in the bundler config, update `src/webparts/<name>/<name>WebPart.ts` to extend `MyWebPart`.

- Custom ids share the open `FrameworkId` branch; no validation beyond string identity.

- `rspfx new --help`, `rspfx doctor`, and CLI prompts cover builtin ids only; `rspfx doctor` reports the framework package as missing when the preset comes from the registry, but the build succeeds via the registry fallback.

- `resolveContributionLoaders` rewrites only `rules[].use` and Babel strings; `swc`, `define`, and `resolve` are merged without path rewriting.

