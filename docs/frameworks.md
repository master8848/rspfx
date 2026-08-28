# Framework Support

RSPFX is framework-agnostic — the core knows nothing about React or Vue. Each framework is a pluggable package with a compiler preset and a web part base class. See Microsoft docs: [SharePoint Framework overview](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/sharepoint-framework-overview) and [Working with web part manifests](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/web-parts/basics/working-with-web-part-manifests).

> **Tip:** Pick your bundler by ranking Vite > Rsbuild > Rspack. Vite gives the simplest CSS and fastest loop for every framework. See [styling.md](styling.md).

## Choosing a framework

| Framework | Official SPFx | RSPFX | Fast refresh |
|---|---|---|---|
| React / Vanilla TS | ✅ | ✅ | ✅ / — |
| Preact / Vue / Svelte / Solid | ❌ | ✅ | ✅ |

Official templates ship React only. RSPFX adds the rest as first-class presets (`@mbsks/rspfx-framework-*`) with loaders and base classes (`ReactWebPart`, `VueWebPart`, …).

> **Tip:** For new parts, use React if your org already does; for small or interactive parts, Solid and Preact give smaller bundles with full HMR. See [fast-refresh.md](fast-refresh.md).

| Aspect | Official | RSPFX |
|---|---|---|
| Other frameworks | Community webpack loaders | `rspfx new --framework vue\|svelte\|solid\|preact` |
| JSX / compiler | Heft rig + `ts-loader` | SWC, per-framework preset contributions |
| Fast refresh | — | `rspfx dev --refresh` (react/preact/vue/svelte/solid) |

## Adapter contract

Each framework exports a pure `createXAdapter` factory — testable off-DOM with `jsdom`:

```ts
import { createVanillaAdapter } from '@mbsks/rspfx-framework-vanilla/headless';
const adapter = createVanillaAdapter<{ name: string }>((props) => props.name);
adapter.mount(root, { name: 'a' });
adapter.update(root, { name: 'b' });
adapter.unmount(root);
```

For SPFx, wire it via `defineWebPart`:

```ts
import { defineWebPart } from '@mbsks/rspfx-webpart-base';
import { createReactAdapter } from '@mbsks/rspfx-framework-react/headless';
export default defineWebPart<{ name: string }>({
  adapterFactory: () => createReactAdapter((props) => <Hello {...props} />),
});
```

See [custom-framework.md](custom-framework.md).

## Mount semantics

| Adapter | Mount | Update | Unmount |
|---|---|---|---|
| React | `createRoot(root).render` | `root.render` | `root.unmount` |
| Preact | `render(vnode, root)` | `render(vnode, root)` | `render(null, root)` |
| Vue | `createApp(comp).mount` | unmount + recreate | `app.unmount` |
| Svelte | `new Component` / `mount` (Svelte 5) | `$set` or recreate | `$destroy` / `unmount` |
| Solid | `render` + signal | `setProps` | dispose |
| Vanilla | `replaceChildren` | `replaceChildren` | `replaceChildren` |

## Package layout

Each `@mbsks/rspfx-framework-<fw>` has three entry points: **index** (`preset` only, Node-safe), **`/headless`** (`createXAdapter`, browser, no SPFx dep), and **`/webpart`** (thin `HeadlessWebPart` shim, deprecated).

## Fast refresh

| Framework | Fast refresh | Mechanism |
|---|---|---|
| React | ✅ | `plugin-react-refresh` |
| Preact | ✅ | `plugin-preact-refresh` |
| Vue | ✅ | `vue-loader` HMR |
| Svelte | ✅ | `svelte-loader` hotReload |
| Solid | ✅ | `solid-refresh` babel plugin |
| Vanilla | — | Full reload |

Any failure falls back to reload. Enable with `rspfx dev --refresh`. See [fast-refresh.md](fast-refresh.md).

## Adding a new framework

1. Create the framework package (depends on `core` + `plugin-api`; framework libs as peers).
2. Export a `FrameworkPreset` with `contributions()` (loader rules, SWC options, plugins).
3. Export a `<Cap>WebPart` class from the `/webpart` subpath.
4. Register the preset via the CLI registry or `definePlugin`/`registerPlugin`.
5. Add a scaffold template — it appears automatically at `http://localhost:4321/`.

See [custom-framework.md](custom-framework.md).

## Looking for Angular, Lit or Qwik?

RSPFX ships React, Vue, Svelte, Solid, Preact and vanilla. Other frameworks — Angular, Lit, Qwik, Astro, Ember, Stencil, Alpine, Mithril, Inferno — work via [Custom Framework](custom-framework.md); create a FrameworkPreset and register it with `definePlugin`/`registerPlugin`.

| Framework | Path |
|---|---|
| Angular | Custom — follow [custom-framework.md](custom-framework.md) |
| Lit | Custom — `lit` element wrapper via adapter |
| Qwik | Custom — follow [custom-framework.md](custom-framework.md) |
| Astro | Custom — follow [custom-framework.md](custom-framework.md) |
| Ember | Custom — follow [custom-framework.md](custom-framework.md) |
| Stencil | Custom — follow [custom-framework.md](custom-framework.md) |
| Alpine | Custom — follow [custom-framework.md](custom-framework.md) |
| Mithril | Custom — follow [custom-framework.md](custom-framework.md) |
| Inferno | Custom — follow [custom-framework.md](custom-framework.md) |

See [custom-framework.md](custom-framework.md) for the preset and web part contract.

## Fluent UI

`@mbsks/rspfx-fluent-adapter` is an optional React-only package: `FluentWebPart` extends `ReactWebPart` and syncs the SharePoint theme via `onThemeChanged()`. Install with `bun add @mbsks/rspfx-fluent-adapter @fluentui/react` (or `pnpm add` / `npm i` / `yarn add`).

> **Note:** `@fluentui/react` v8 and `@fluentui/react-components` v9 peer `react >=16.8.0 <19.0.0` — they do not support React 19 yet. See [react-19.md](react-19.md) for the React 19 + Fluent UI caveat and alternatives.

> **Tip:** Bundle React per web part (official behavior) — don't externalize it.
