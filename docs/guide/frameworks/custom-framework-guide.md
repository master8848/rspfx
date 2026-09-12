# Custom framework guide

TL;DR: You can add any framework to RSPFx with a preset and a web part class. Register them and pick the framework by name in your bundler config.

RSPFx core knows nothing about React or Vue. Each framework is a preset plus a base class. You can add your own without forking the CLI.

## Contract

A framework has two parts:

| Part | You export | File |
|---|---|---|
| `FrameworkPreset` | `FrameworkPreset` type | `packages/plugin-api/src/types.ts` |
| Web part class | `BaseWebPart` subclass | `packages/core/src/base-web-part.ts` |

Use `FrameworkPreset<string>` for custom IDs. The preset adds compiler config. The class mounts at runtime with `renderInto` and `disposeFrom`.

<Steps>

## Step 1: Create a preset

Create `src/framework/my-preset.ts` with a custom `name`:

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
  }
};

function myVitePlugin() { return { name: 'my-framework-hmr' }; }
```

| Method | Required | What to return |
|---|---|---|
| `rspack({ fastRefresh })` | yes | `FrameworkRspackContributions` |
| `vite({ fastRefresh })` | no | `FrameworkViteContributions` or warn and skip |
| `rsbuild({ fastRefresh })` | no | `FrameworkRsbuildContributions` or fallback to `rspack()` |

`fastRefresh` is true when you run `rspfx dev --refresh` or set `dev.fastRefresh: true`. Keep HMR code behind that flag so prod builds stay clean.

## Step 2: Create a web part class

Create a browser only class that extends `BaseWebPart`:

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

| Hook | Job |
|---|---|
| `getComponentProps()` | map `this.properties` to props |
| `renderInto(root)` | mount into `root` |
| `disposeFrom(root)` | remove listeners and unmount |

Keep this class in a browser path. Do not import it from the Node safe preset entry.

## Step 3: Register the preset

Register the preset in the bundler config that `jiti` loads:

```ts
// rspack.config.ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';
import { definePlugin, registerPlugin } from '@mbsks/rspfx-plugin-api';
import { myPreset } from './src/framework/my-preset.js';

registerPlugin(definePlugin({ name: 'my-framework-ext', frameworkPreset: myPreset }));

export default {
  plugins: [new RspfxPlugin({ name: 'my-app', framework: 'my-framework' as const, spfxVersion: '1.23' })]
};
```

For Vite:

```ts
// vite.config.ts
import { rspfxVite } from '@mbsks/rspfx-plugin';
import { definePlugin, registerPlugin } from '@mbsks/rspfx-plugin-api';
import { myPreset } from './src/framework/my-preset.js';
registerPlugin(definePlugin({ name: 'my-framework-ext', frameworkPreset: myPreset }));
export default { plugins: [rspfxVite({ name: 'my-app', framework: 'my-framework' as const })] };
```

For Rsbuild:

```ts
// rsbuild.config.ts
import { defineConfig } from '@rsbuild/core';
import { rspfxRsbuild } from '@mbsks/rspfx-plugin';
import { definePlugin, registerPlugin } from '@mbsks/rspfx-plugin-api';
import { myPreset } from './src/framework/my-preset.js';
registerPlugin(definePlugin({ name: 'my-framework-ext', frameworkPreset: myPreset }));
export default defineConfig({ plugins: [rspfxRsbuild({ name: 'my-app', framework: 'my-framework' as const })] });
```

Call `registerPlugin` at top level before the RSPFx plugin reads the framework.

## Step 4: Use it in a web part

Update `src/webparts/<name>/<name>WebPart.ts` to extend `MyWebPart` and implement `renderComponent`.

</Steps>

## Hot reload

Gate HMR plugins on `fastRefresh`. Return them only when true.

- Rspack React: `new ReactRefreshRspackPlugin()` and `swc.jsc.transform.react.development: true`
- Preact: `new PreactRefreshRspackPlugin()`
- Svelte: `svelte-loader` with `hotReload: true`
- Solid: `solid-refresh` via babel or SWC plugin
- Vue: `vue-loader` plus `VueLoaderPlugin` - HMR is always on

If a peer is missing, RSPFx warns and falls back to full reload. Install the peer to enable HMR. See [Fast refresh](../styling/fast-refresh.md).

## Resolution

`loadFrameworkPreset` checks `node_modules` for `@mbsks/rspfx-framework-<id>`, then the in memory registry, then warns.

`resolveContributionLoaders` rewrites loader strings via `createRequire(frameworkModuleUrl).resolve`. `builtin:swc-loader` stays as is.

## Scaffolding limits

`rspfx new` covers built in frameworks only. For custom frameworks, scaffold with `vanilla` and add your preset and class manually. `rspfx doctor` may report the framework package as missing when you use the registry, but build still succeeds.

For exact types, see [../../reference/custom-framework-reference.md](../../reference/custom-framework-reference.md).
