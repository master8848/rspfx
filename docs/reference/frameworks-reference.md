# Frameworks reference

This page lists the technical framework contracts for RSPFx: mount semantics per framework, package layout with import paths, and fast refresh mechanisms.

For choosing a framework and tutorial prose see `docs/frameworks.md`; for the preset contract see `docs/custom-framework.md`.

## Mount semantics

| Adapter | Package | Mount | Update | Unmount | Source |
|---|---|---|---|---|---|
| React | `import { createReactAdapter } from '@mbsks/rspfx-framework-react/headless'` | `createRoot(root).render` | `root.render` | `root.unmount` | `packages/framework-react/src/headless.ts:7` |
| Preact | `import { createPreactAdapter } from '@mbsks/rspfx-framework-preact/headless'` | `render(vnode, root)` | `render(vnode, root)` | `render(null, root)` | `packages/framework-preact/src/headless.ts:1` |
| Vue | `import { createVueAdapter } from '@mbsks/rspfx-framework-vue/headless'` | `createApp(comp).mount` | unmount + recreate | `app.unmount` | `packages/framework-vue/src/headless.ts:1` |
| Svelte | `import { createSvelteAdapter } from '@mbsks/rspfx-framework-svelte/headless'` | `new Component` / `mount` (Svelte 5) | `$set` or recreate | `$destroy` / `unmount` | `packages/framework-svelte/src/headless.ts:1` |
| Solid | `import { createSolidAdapter } from '@mbsks/rspfx-framework-solid/headless'` | `render` + signal | `setProps` | dispose | `packages/framework-solid/src/headless.ts:1` |
| Vanilla | `import { createVanillaAdapter } from '@mbsks/rspfx-framework-vanilla/headless'` | `replaceChildren` | `replaceChildren` | `replaceChildren` | `packages/framework-vanilla/src/headless.ts:1` |

Usage with SPFx:

```ts
import { defineWebPart } from '@mbsks/rspfx-webpart-base';
import { createReactAdapter } from '@mbsks/rspfx-framework-react/headless';
export default defineWebPart<{ name: string }>({
  adapterFactory: () => createReactAdapter((props) => <Hello {...props} />),
});
```

See `packages/webpart-base/src/index.ts:10` for `defineWebPart` and `packages/core/src/base-web-part.ts:10` for `BaseWebPart`.

## Package layout

Each `@mbsks/rspfx-framework-<fw>` has three entry points:

| Entry | Import | Exports | Node-safe |
|---|---|---|---|
| `index` | `import { reactPreset } from '@mbsks/rspfx-framework-react'` | `FrameworkPreset` only | Yes |
| `/headless` | `import { createReactAdapter } from '@mbsks/rspfx-framework-react/headless'` | `createXAdapter` factory (browser, no SPFx dep) | No (DOM) |
| `/webpart` | `import { ReactWebPart } from '@mbsks/rspfx-framework-react/webpart'` | Thin `HeadlessWebPart` shim (`@mbsks/rspfx-webpart-base`) — deprecated, use `defineWebPart` | No |

`packages/plugin-api/src/types.ts:29` defines `FrameworkPreset`.

## Fast refresh mechanism

Enable with `rspfx dev --refresh` or `dev.fastRefresh: true` (`packages/core/src/config.ts:138`).

| Framework | Fast refresh | Rspack mechanism (`preset.rspack()`) | Vite mechanism (`preset.vite()`) |
|---|---|---|---|
| React | ✅ | `ReactRefreshRspackPlugin` from `@rspack/plugin-react-refresh` | `import react from '@vitejs/plugin-react'` |
| Preact | ✅ | `PreactRefreshRspackPlugin` from `@rspack/plugin-preact-refresh` | `import preact from '@prefresh/vite'` |
| Vue | ✅ | `vue-loader` + `VueLoaderPlugin` (HMR always on) | `import vue from '@vitejs/plugin-vue'` |
| Svelte | ✅ | `svelte-loader` with `{ hotReload: true, compilerOptions: { dev: true } }` | `import { svelte } from '@sveltejs/vite-plugin-svelte'` with `{ hot: true }` |
| Solid | ✅ | `babel-loader` with `solid-refresh/babel` or `builtin:swc-loader` with `rspackExperiments.swcPlugins` | `vite-plugin-solid` |
| Vanilla | — | Full reload | Full reload |

Any failure falls back to reload via `/__rspfx_hot.json` poll → `location.reload()` (`packages/dev-runtime/src/serve.ts:335`). `RefreshRuntime` is framework-agnostic (`packages/dev-runtime/src/refresh.ts:21`).

Missing peers are stubbed via `BUILD_TIME_ALIASES` (`packages/compiler-rspack/src/config.ts:16`); a warning is logged and reload is used. See `docs/fast-refresh.md`.

## Fluent UI

| Package | Import | Peer | Use |
|---|---|---|---|
| `@mbsks/rspfx-fluent-adapter` | `import { FluentWebPart } from '@mbsks/rspfx-fluent-adapter'` | `@fluentui/react ^8.0.0` | React-only; `FluentWebPart` extends `ReactWebPart` and syncs theme via `onThemeChanged()` (`packages/fluent-adapter/src/index.ts:43` `buildFluentTheme`) |

Install: `bun add @mbsks/rspfx-fluent-adapter @fluentui/react` (or `pnpm add` / `npm i` / `yarn add`). No React 19 support — see `docs/react-19.md`.
