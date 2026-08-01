# Framework Support

Every framework is a pluggable package behind two contracts: a `FrameworkAdapter`
(how the web part mounts into the DOM) and a `FrameworkPreset` (how the compiler
is configured for that framework). The core is framework-agnostic; nothing in
`@mbsks/rspfx-core`, `compiler-rspack`, or the packaging pipeline knows about any
particular framework.

## Adapter semantics

A `FrameworkAdapter` (from `@mbsks/rspfx-plugin-api`) is the single surface the web
part runtime talks to:

| Method | Purpose |
|---|---|
| `mount(root, component)` | Mount the framework root component into the web part's `domElement` |
| `unmount(root)` | Tear down; dispose effects, remove listeners |
| `update(root)` | Re-render with new props (called on property changes) |
| `supportsFastRefresh()` | Whether the framework has a state-preserving refresh runtime |

`BaseWebPart.render()` mounts via the adapter into `this.domElement`;
`onDispose()` unmounts. Property-pane changes flow through `update()`.

## Package layout

Each `@mbsks/rspfx-framework-<fw>` package is split into two entry points:

- **Index** (`@mbsks/rspfx-framework-<fw>`) — `adapter` + `preset` only. Node-safe
  (the CLI imports it to collect compiler contributions); never imports
  `@mbsks/rspfx-core/webpart`.
- **`/webpart` subpath** (`@mbsks/rspfx-framework-<fw>/webpart`) — the `<Cap>WebPart`
  base classes (browser side). Svelte also exports `SvelteWebPartComponent`
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
  adapter(): FrameworkAdapter;
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
| Solid | ⚠️ partial | `babel-loader` + `babel-preset-solid`; refresh falls back to full reload |
| Vanilla | n/a | no runtime; full reload only |

Any failure in a framework runtime falls back to a full page reload automatically.

## Adding a new framework

1. **Create the package** `packages/framework-<name>` (depends on `core` +
   `plugin-api`; framework libs as peers).
2. **Export the preset** — `FrameworkPreset` with `name`, `adapter()`, and
   `contributions()` returning the loader rules / swc options / plugins the
   framework needs (JSX transform, HMR plugin, aliases).
3. **Export the adapter** — a singleton `FrameworkAdapter` implementing
   mount/unmount/update, plus `supportsFastRefresh()`.
4. **Export a web part base class** — `<Cap>WebPart<TProps, TState> extends
   BaseWebPart<TProps>` wiring `frameworkAdapter` + `createComponent()` +
   `getComponentProps()`, exported from the `@mbsks/rspfx-framework-<fw>/webpart`
   subpath (it imports `@mbsks/rspfx-core/webpart`, so it must not live in the
   Node-safe index).
5. **Register it** — either import the preset in the CLI's framework registry, or
   ship it as an `RspfxPlugin` (via `definePlugin`/`registerPlugin` from
   `plugin-api`) so projects can opt in without a CLI change.
6. **Scaffolding** — add a project template to `packages/templates`
   (`components/<Pascal>.<ext>`, web part class, styles) and a playground page
   variant.

That's the whole contract: compiler contributions + adapter + base class +
template. Nothing in the build, packaging, or dev pipeline changes.

## Fluent UI adapter

`@mbsks/rspfx-fluent-adapter` is **optional** (enable with `fluent: true` in
`rspfx.config.ts`) and **React-only**:

- `FluentWebPart<TProps, TState> extends ReactWebPart` — full web part with Fluent
  UI boilerplate.
- `onThemeChanged()` syncs the SharePoint theme (`context.themeProvider` /
  `ThemeProvider.addChangeListener`) into a Fluent `ThemeProvider`, so web parts
  track the tenant theme live.

Notes: bundle React per web part (official SPFx behavior — do not externalize it);
be aware of React version skew in tenants running an older React on the page.
