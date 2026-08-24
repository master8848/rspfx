# Framework Support

Every framework is a pluggable package behind one contract split across two
entry points: a `FrameworkPreset` (how the compiler is configured for that
framework) and a self-mounting `<Cap>WebPart` class (how the web part mounts into
the DOM in the browser). The core is framework-agnostic; nothing in
`@mbsks/rspfx-core`, `compiler-rspack`, or the packaging pipeline knows about any
particular framework.

## Headless adapter contract

`HeadlessAdapter<TProps>` (from `@mbsks/rspfx-core/headless`) decouples rendering from the SPFx lifecycle:

```ts
interface HeadlessAdapter<TProps extends Record<string, unknown>> {
  readonly mount: (root: HTMLElement, props: TProps) => void;
  readonly update: (root: HTMLElement, props: TProps) => void;
  readonly unmount: (root: HTMLElement) => void;
}
```

Each framework exports a pure factory `createXAdapter` returning this contract. Adapters are testable off-DOM:

```ts
import { createVanillaAdapter } from '@mbsks/rspfx-framework-vanilla/headless';
const adapter = createVanillaAdapter<{ name: string }>((props) => props.name);
adapter.mount(root, { name: 'a' });
adapter.update(root, { name: 'b' });
adapter.unmount(root);
```

SPFx lifecycle is owned by `@mbsks/rspfx-webpart-base`:

```ts
import { HeadlessWebPart, defineWebPart } from '@mbsks/rspfx-webpart-base';
import { createReactAdapter } from '@mbsks/rspfx-framework-react/headless';
export default defineWebPart<{ name: string }>({
  adapterFactory: () => createReactAdapter((props) => <Hello {...props} />),
});
```

## Mount semantics

Adapters implement mount/update/unmount per framework:

| Adapter | mount | update | unmount |
|---|---|---|---|
| `createReactAdapter` | `createRoot(root).render(vnode)` | `root.render(vnode)` | `root.unmount()` |
| `createPreactAdapter` | `render(vnode, root)` | `render(vnode, root)` | `render(null, root)` |
| `createVueAdapter` | `createApp(comp).mount(root)` | unmount + create + mount | `app.unmount()` |
| `createSvelteAdapter` | `new Component({ target: root, props })` | `$destroy` + recreate | `$destroy()` |
| `createSolidAdapter` | `render(() => comp, root)` | dispose + recreate | dispose |
| `createVanillaAdapter` | `replaceChildren(node)` | `replaceChildren(node)` | `replaceChildren()` |

`HeadlessWebPart.render()` calls `adapter.mount(this.domElement, this.getComponentProps())`; `onDispose()` calls `adapter.unmount`. Property-pane updates flow via `adapter.update`.

## Package layout

Each `@mbsks/rspfx-framework-<fw>` package is split into three entry points:

- **Index** (`@mbsks/rspfx-framework-<fw>`) — `preset` only. Node-safe (the CLI imports it to collect compiler contributions); never imports `@mbsks/rspfx-webpart-base`.
- **`/headless` subpath** (`@mbsks/rspfx-framework-<fw>/headless`) — the `createXAdapter` factory (browser, no SPFx dependency). Testable with `jsdom`.
- **`/webpart` subpath** (`@mbsks/rspfx-framework-<fw>/webpart`) — thin `HeadlessWebPart` shim (`extends HeadlessWebPart` + `createAdapter()` delegates to `createXAdapter`). Kept for one major as `@deprecated`.

```ts
import { createReactAdapter } from '@mbsks/rspfx-framework-react/headless';
import { ReactWebPart } from '@mbsks/rspfx-framework-react/webpart'; // shim, deprecated
```

## JSX and compiler configuration

All `.ts/.tsx/.jsx/.js` goes through Rspack's `builtin:swc-loader` (parser: jsx,
decorators, importMeta). Each framework preset contributes its own swc options,
rules, and plugins via `FrameworkPreset.contributions({ fastRefresh })`:

```ts
interface FrameworkPreset<F extends string = FrameworkId> {
  name: F; // F is FrameworkId | (string & {}) — custom frameworks use FrameworkPreset<string> / name: string
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

`@mbsks/rspfx-fluent-adapter` is a standalone optional package (**React-only**, not enabled via scaffold flags):

- `FluentWebPart<TProps, TState> extends ReactWebPart` — full web part with Fluent
  UI boilerplate.
- `onThemeChanged()` syncs the SharePoint theme (`context.themeProvider` /
  `ThemeProvider.addChangeListener`) into a Fluent `ThemeProvider`, so web parts
  track the tenant theme live.
- Install it explicitly (`pnpm add @mbsks/rspfx-fluent-adapter @fluentui/react`) and extend `FluentWebPart` in your web part class.

Notes: bundle React per web part (official SPFx behavior — do not externalize it);
be aware of React version skew in tenants running an older React on the page.
