# Framework Support

Every framework is a pluggable package behind one contract split across two
entry points: a `FrameworkPreset` (how the compiler is configured for that
framework) and a self-mounting `<Cap>WebPart` class (how the web part mounts into
the DOM in the browser). The core is framework-agnostic; nothing in
`@mbsks/rspfx-core`, `compiler-rspack`, or the packaging pipeline knows about any
particular framework.

## Mount semantics

`BaseWebPart<TProps>` (from `@mbsks/rspfx-core/webpart`) declares the mount
contract as three abstract hooks:

| Hook | Purpose |
|---|---|
| `getComponentProps()` | Derive props from `this.properties` |
| `renderInto(root)` | Mount the framework root component into `root` (the web part's `domElement`) |
| `disposeFrom(root)` | Tear down; dispose effects, remove listeners |

The framework package mounts **itself**: each `<Cap>WebPart` implements the hooks
with its own canonical API (`createRoot().render()`, `render(vnode, root)`,
`createApp().mount()`, `new Component()`, ...). No `unknown` component crosses a
generic boundary.

`BaseWebPart.render()` mounts via `renderInto(this.domElement)`; `onDispose()`
calls `disposeFrom(this.domElement)` first. SPFx calls `render()` again on
property-pane changes; re-render is handled per framework:

- React / Preact — re-render in place (same root, new props).
- Solid / Vue / Svelte — dispose-then-recreate (per-root WeakMap bookkeeping).
- Vanilla — `root.replaceChildren(component)`; the component is
  `HTMLElement | string`.

## Package layout

Each `@mbsks/rspfx-framework-<fw>` package is split into two entry points:

- **Index** (`@mbsks/rspfx-framework-<fw>`) — `preset` only. Node-safe (the CLI
  imports it to collect compiler contributions); never imports
  `@mbsks/rspfx-core/webpart`.
- **`/webpart` subpath** (`@mbsks/rspfx-framework-<fw>/webpart`) — the `<Cap>WebPart`
  base class (browser side). Svelte also exports `SvelteWebPartComponent`
  there.

```ts
import { ReactWebPart } from '@mbsks/rspfx-framework-react/webpart';
```

## JSX and compiler configuration

All `.ts/.tsx/.jsx/.js` goes through Rspack's `builtin:swc-loader` (parser: jsx,
decorators, importMeta). Each framework preset contributes its own swc options,
rules, and plugins via `FrameworkPreset.contributions({ fastRefresh })`:

```ts
interface FrameworkPreset {
  name: FrameworkId;
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions;
}
```

`FrameworkRspackContributions` may carry `rules`, `plugins`, `resolve` (alias /
extensions), `swc` (parser/transform overrides), `define`, and `moduleTest`.
The compiler merges all contributions into the final Rspack config.

## Fast refresh status

| Framework | Fast refresh | Mechanism |
|---|---|---|
| React | ✅ full | `@rspack/plugin-react-refresh` contribution |
| Preact | ✅ full | `@rspack/plugin-preact-refresh` contribution |
| Vue | ✅ full | `vue-loader` HMR (peer `@vue/compiler-sfc`) |
| Svelte | ✅ full | `svelte-loader` `hotReload` (`svelte-hmr`) |
| Solid | ✅ full | babel-loader + `babel-preset-solid` (dev mode) + `solid-refresh/babel` (`bundler: 'rspack-esm'`) |
| Vanilla | n/a | no runtime; full reload only |

Any failure in a framework runtime falls back to a full page reload automatically.

## Adding a new framework

1. **Create the package** `packages/framework-<name>` (depends on `core` +
   `plugin-api`; framework libs as peers).
2. **Export the preset** — `FrameworkPreset` with `name` and `contributions()`
   returning the loader rules / swc options / plugins the framework needs (JSX
   transform, HMR plugin, aliases).
3. **Export the web part class** — `<Cap>WebPart<TProps, TState> extends
   BaseWebPart<TProps>` implementing `renderInto()` / `disposeFrom()` /
   `getComponentProps()` (typically returning `this.properties`) using only the
   framework's own mount API, plus optional per-root WeakMap bookkeeping.
   Exported from the `@mbsks/rspfx-framework-<fw>/webpart` subpath (it imports
   `@mbsks/rspfx-core/webpart`, so it must not live in the Node-safe index).
4. **Register it** — either import the preset in the CLI's framework registry, or
   ship it as an `RspfxExtension` (via `definePlugin`/`registerPlugin` from
   `plugin-api`) so projects can opt in without a CLI change.
5. **Scaffolding** — add a project template to `packages/templates`
   (`components/<Pascal>.<ext>`, web part class, styles); the web part then
   appears automatically in the local preview page served by `rspfx dev` at `/`.

That's the whole contract: compiler contributions + web part class + template.
Nothing in the build, packaging, or dev pipeline changes.

## Fluent UI adapter

`@mbsks/rspfx-fluent-adapter` is **optional** (enable with `fluent: true` in
the plugin options in `rspack.config.ts`) and **React-only**:

- `FluentWebPart<TProps, TState> extends ReactWebPart` — full web part with Fluent
  UI boilerplate.
- `onThemeChanged()` syncs the SharePoint theme (`context.themeProvider` /
  `ThemeProvider.addChangeListener`) into a Fluent `ThemeProvider`, so web parts
  track the tenant theme live.

Notes: bundle React per web part (official SPFx behavior — do not externalize it);
be aware of React version skew in tenants running an older React on the page.
