# Custom Framework Extensibility

External frameworks extend rspfx without modifying the CLI or built-in packages.

See [frameworks](frameworks.md) for built-in frameworks, [internal-api](internal-api.md) for package surfaces, [architecture](architecture.md) for the pipeline, [commands](commands.md) for CLI flags.

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

export const myPreset: FrameworkPreset<'my-framework'> = {
  name: 'my-framework',
  contributions({ fastRefresh }) {
    return {
      rules: [{ test: /\.tsx?$/, use: { loader: 'builtin:swc-loader', options: { jsc: { parser: { syntax: 'typescript', jsx: true } } } } }],
      swc: { jsc: { transform: { react: { runtime: 'automatic' } } } },
      resolve: { extensions: ['.ts', '.tsx', '.js'] }
    };
  },
  vite({ fastRefresh }) {
    return { plugins: [], esbuild: { jsx: 'automatic' } };
  },
  rsbuild({ fastRefresh }) {
    return { rules: [], plugins: [], resolve: { extensions: ['.ts', '.tsx'] } };
  }
};
```

| Method | Return type | Required | Fallback |
|---|---|---|---|
| `contributions({ fastRefresh })` | `FrameworkRspackContributions` (`packages/plugin-api/src/types.ts:3`) | yes | — |
| `vite({ fastRefresh })` | `FrameworkViteContributions` (`packages/plugin-api/src/types.ts:12`) | no | `rspfxVite` (`packages/plugin/src/vite.ts:299`) warns and runs without Vite contributions |
| `rsbuild({ fastRefresh })` | `FrameworkRsbuildContributions` (`packages/plugin-api/src/types.ts:21`) | no | `rspfxRsbuild` (`packages/plugin/src/rsbuild.ts:354`) falls back to `contributions()` minus `swc` |

`fastRefresh` reflects `dev.fastRefresh` or `RSPFX_FAST_REFRESH=1` / `rspfx dev --refresh` and is merged by `@mbsks/rspfx-compiler-rspack`, `rspfxVite`, and `rspfxRsbuild`.

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
| `rspack.config.ts` | `RspfxPlugin` (`@mbsks/rspfx-plugin`) | `contributions()` |
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

## Resolution flow

`loadFrameworkPreset` (`packages/dev-runtime/src/project.ts:737`) resolves in order: `createRequire(projectRoot/package.json)` for `@mbsks/rspfx-framework-<id>` (records `__rspfxModuleUrl` for loader resolution), then in-memory registry from `registerPlugin`, then a no-op preset with a warning.

`resolveContributionLoaders` (`packages/dev-runtime/src/project.ts:759`) rewrites `rules[].use` loader and Babel preset/plugin strings via `createRequire(frameworkModuleUrl).resolve`; `builtin:swc-loader` is unchanged.

## Scaffolding and limits

- `packages/templates` and `rspfx new` remain builtin-only.

- To use a custom framework in a new project: `rspfx new my-app --framework vanilla --yes`, add `src/framework/my-preset.ts` and `src/framework/my-webpart.ts`, register the preset in the bundler config, update `src/webparts/<name>/<name>WebPart.ts` to extend `MyWebPart`.

- Custom ids share the open `FrameworkId` branch; no validation beyond string identity.

- `rspfx new --help`, `rspfx doctor`, and CLI prompts cover builtin ids only; `rspfx doctor` reports the framework package as missing when the preset comes from the registry, but the build succeeds via the registry fallback.

- `resolveContributionLoaders` rewrites only `rules[].use` and Babel strings; `swc`, `define`, and `resolve` are merged without path rewriting.

- Fast refresh requires the preset to return refresh plugins/loaders for the active bundler; `RefreshRuntime` (`packages/dev-runtime`) is framework-agnostic.

