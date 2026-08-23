# Custom Framework Extensibility

External frameworks extend rspfx without modifying the CLI or built-in packages.

See [frameworks](frameworks.md) for built-in frameworks, [internal-api](internal-api.md) for package surfaces, [commands](commands.md) for CLI flags, [architecture](architecture.md) for the pipeline.

## Contract

Each framework consists of two parts: a `FrameworkPreset` that contributes compiler configuration and a `BaseWebPart` subclass that mounts into the DOM.

`FrameworkPreset` is defined in `packages/plugin-api/src/types.ts:29` and imported from `@mbsks/rspfx-plugin-api`.

`BaseWebPart` is defined in `packages/core/src/base-web-part.ts` and imported from `@mbsks/rspfx-core/webpart`.

`FrameworkId` is defined in `packages/core/src/config.ts:4` as `'vanilla' | 'react' | 'solid' | 'vue' | 'preact' | 'svelte' | (string & {})`; custom frameworks use the `(string & {})` open branch.

The preset configures the compiler (rules, swc, plugins, resolve, define); the web part class mounts the framework at runtime via `renderInto`/`disposeFrom`/`getComponentProps`.

Builtin presets and web part classes live in `packages/framework-<name>` with two entry points: index (`@mbsks/rspfx-framework-<fw>`, Node-safe preset only) and `/webpart` (`@mbsks/rspfx-framework-<fw>/webpart`, browser-only web part class); external presets follow the same split or colocate both exports behind separate imports.

## Define a preset

Create `src/framework/my-preset.ts` (or any project-owned path) exporting a `FrameworkPreset` with `name: 'my-framework'`:

```ts
import type { FrameworkPreset } from '@mbsks/rspfx-plugin-api';

export const myPreset: FrameworkPreset<'my-framework'> = {
  name: 'my-framework',
  contributions({ fastRefresh }) {
    return {
      rules: [
        {
          test: /\.tsx?$/,
          use: { loader: 'builtin:swc-loader', options: { jsc: { parser: { syntax: 'typescript', jsx: true }, transform: { react: { runtime: 'automatic' } } } } }
        }
      ],
      swc: { jsc: { transform: { react: { runtime: 'automatic' } } } },
      plugins: fastRefresh ? [] : [],
      resolve: { extensions: ['.ts', '.tsx', '.js'] }
    };
  },
  vite({ fastRefresh }) {
    return {
      plugins: [],
      esbuild: { jsx: 'automatic' },
      resolveExtensions: ['.ts', '.tsx'],
      define: {}
    };
  },
  rsbuild({ fastRefresh }) {
    return {
      rules: [],
      plugins: [],
      resolve: { extensions: ['.ts', '.tsx'] }
    };
  }
};
```

`contributions({ fastRefresh })` returns `FrameworkRspackContributions` (`packages/plugin-api/src/types.ts:3`): `rules`, `plugins`, `resolve`, `swc`, `define`, `moduleTest`.

`vite({ fastRefresh })` is optional and returns `FrameworkViteContributions` (`packages/plugin-api/src/types.ts:12`): `plugins`, `esbuild`, `resolveExtensions`, `define`; when absent, `rspfxVite` in `packages/plugin/src/vite.ts` warns and runs without Vite contributions.

`rsbuild({ fastRefresh })` is optional and returns `FrameworkRsbuildContributions` (`packages/plugin-api/src/types.ts:21`): `rules`, `plugins`, `resolve`, `define`; when absent, `rspfxRsbuild` in `packages/plugin/src/rsbuild.ts:360` falls back to `contributions()` minus the `swc` block.

Contributions are merged by `@mbsks/rspfx-compiler-rspack` (Rspack) and by the Vite/Rsbuild plugins; `fastRefresh` reflects `dev.fastRefresh` or `RSPFX_FAST_REFRESH=1` / `rspfx dev --refresh`.

Loader strings in `rules[].use` that are not `builtin:` are resolved against the framework package's own `node_modules` via `resolveContributionLoaders` in `packages/dev-runtime/src/project.ts:759`.

## Define a web part

Create the browser-side base class extending `BaseWebPart` from `@mbsks/rspfx-core/webpart`:

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

  protected disposeFrom(root: HTMLElement): void {
    const r = roots.get(root);
    if (r) {
      r.unmount();
      roots.delete(root);
    }
  }

  protected getComponentProps(): TProps {
    return this.properties;
  }
}
```

`BaseWebPart` (`packages/core/src/base-web-part.ts:10`) declares three abstract hooks: `getComponentProps(): TProps`, `renderInto(root: HTMLElement): void`, `disposeFrom(root: HTMLElement): void`; `render()` delegates to `renderInto(this.domElement)` and `onDispose()` delegates to `disposeFrom(this.domElement)`.

Per-root `WeakMap` bookkeeping follows the builtin pattern; dispose-then-recreate applies to Solid/Vue/Svelte-style frameworks while React/Preact re-render in place (see [frameworks](frameworks.md#mount-semantics)).

The web part class must not be imported from the Node-safe preset entry; keep it in a browser-only import path (e.g., `src/framework/my-webpart.ts` or a separate package's `/webpart` subpath) that project web parts import directly.

## Register in project

Register the preset via the plugin registry in `rspack.config.ts`, which the CLI loads via `jiti` in `apps/cli/src/config.ts:69`:

```ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';
import { definePlugin, registerPlugin } from '@mbsks/rspfx-plugin-api';
import { myPreset } from './src/framework/my-preset.js';

registerPlugin(definePlugin({
  name: 'my-framework-ext',
  frameworkPreset: myPreset
}));

export default {
  plugins: [
    new RspfxPlugin({
      name: 'my-app',
      framework: 'my-framework' as const,
      spfxVersion: '1.23'
    })
  ]
};
```

`definePlugin` and `registerPlugin` are exported from `@mbsks/rspfx-plugin-api` (`packages/plugin-api/src/registry.ts:5`); `registerPlugin` stores the extension in an in-memory registry read by `getPlugins()` during build and dev.

`registerPlugin` must execute at the top level of the bundler config before the `RspfxPlugin` import resolves the framework; the config is executed as user code via `jiti` and the registration runs synchronously on import.

`framework` in `RspfxConfig` (`packages/core/src/config.ts:54`) accepts any string via the `FrameworkId` open branch; cast the custom id with `as const` to satisfy the literal type.

No CLI change is required; the project opts in by registering the plugin locally.

## Vite and Rsbuild variants

Replace `RspfxPlugin` with the corresponding bundler plugin; the registration call is identical:

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

`rspfxVite` merges `preset.vite({ fastRefresh })` into the Vite config (`packages/plugin/src/vite.ts:299`); `rspfxRsbuild` merges `preset.rsbuild({ fastRefresh })` in `modifyRspackConfig` (`packages/plugin/src/rsbuild.ts:354`) and rewrites bare loader strings via `resolveContributionLoaders` (`packages/dev-runtime/src/project.ts:759`) against `FrameworkPresetModule.moduleUrl`.

When `vite()` or `rsbuild()` is absent, the plugins fall back as described above; no additional wiring is needed in the project config.

## Build and dev flow

`loadFrameworkPreset` in `packages/dev-runtime/src/project.ts:737` resolves `@mbsks/rspfx-framework-<id>` first via `createRequire(projectRoot/package.json)` and, when found, records `__rspfxModuleUrl` for loader resolution; when the package is not installed it falls back to the in-memory registry populated by `registerPlugin`.

If neither source provides a preset, `loadFrameworkPreset` returns a no-op preset (`contributions: () => ({})`) and logs a warning; the build runs without framework contributions.

`resolveContributionLoaders` in `packages/dev-runtime/src/project.ts:759` rewrites `rules[].use` loader strings and Babel `presets`/`plugins` entries via `createRequire(frameworkModuleUrl).resolve`; `builtin:swc-loader` strings are left unchanged.

Both paths apply `fastRefresh` consistently: `rspfx dev --refresh` or `dev.fastRefresh` sets `RSPFX_FAST_REFRESH=1` and the preset receives `{ fastRefresh: true }`.

## Scaffolding

`packages/templates` and `rspfx new` remain builtin-only; no external template registration exists.

To use a custom framework in a new project, scaffold a vanilla project and replace the web part class and compiler preset: run `rspfx new my-app --framework vanilla --yes`, then add `src/framework/my-preset.ts` and `src/framework/my-webpart.ts`, register the preset in the bundler config, and update the web part under `src/webparts/<name>/<name>WebPart.ts` to extend `MyWebPart` instead of `BaseWebPart`.

## Limits

Custom framework ids share the open `FrameworkId` branch; no validation beyond string identity is performed.

Templates, CLI prompts, and `rspfx doctor` framework checks cover builtin ids only; external frameworks are not listed by `rspfx new --help` and `rspfx doctor` reports the framework package as missing when the preset comes from the registry (the build still succeeds via the registry fallback).

`resolveContributionLoaders` only rewrites `rules[].use` loader and Babel plugin/preset strings; other contribution fields (`swc`, `define`, `resolve`) are merged without path rewriting.

Fast refresh is available only when the preset's `contributions`/`vite`/`rsbuild` return the appropriate refresh plugins/loaders for the active bundler; the runtime `RefreshRuntime` in `packages/dev-runtime` is framework-agnostic and requires no preset change.
