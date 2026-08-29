# Choosing a framework

TL;DR: Pick the framework your team already knows. RSPFx supports React, Vue, Svelte, Solid, Preact, and vanilla with the same build flow.

Official SPFx ships React only. RSPFx adds the rest as presets with loaders and base classes.

## Framework table

| Framework | Official SPFx | RSPFx | Fast refresh |
|---|---|---|---|
| React | yes | yes | yes |
| Vanilla TS | yes | yes | reload only |
| Preact | no | yes | yes |
| Vue | no | yes | yes |
| Svelte | no | yes | yes |
| Solid | no | yes | yes |

All presets live in `@mbsks/rspfx-framework-*`. Each preset adds SWC options, loaders, and HMR plugins. See [Styling](../styling/styling.md) and [Fast refresh](../styling/fast-refresh.md).

## How to decide

Use this checklist to choose:

- **You use React at work** - pick React. Your team can reuse code and Fluent UI when you stay on React 18.
- **You want a small bundle** - pick Preact or Solid. They ship less JS with full HMR.
- **You want single file components** - pick Vue or Svelte. You get scoped styles and built in HMR.
- **You need no framework** - pick vanilla. You render with plain DOM APIs.

For a new web part with no constraints, React is the safe default. For small interactive parts, Preact and Solid are good alternatives.

## Set the framework

Set the framework at scaffold time and in your bundler config:

```sh
rspfx new my-app --framework vue --yes
```

```ts
// vite.config.ts
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxVite({ name: 'my-app', framework: 'vue', spfxVersion: '1.24' })] };
```

Valid values are `react`, `vanilla`, `preact`, `vue`, `svelte`, and `solid`. See [../reference/commands.md](../../reference/commands.md).

## Adapter pattern

Each framework exposes a headless adapter you can test off DOM:

```ts
import { createVanillaAdapter } from '@mbsks/rspfx-framework-vanilla/headless';
const adapter = createVanillaAdapter<{ name: string }>((props) => props.name);
adapter.mount(root, { name: 'a' });
adapter.update(root, { name: 'b' });
adapter.unmount(root);
```

For SPFx, wire it with `defineWebPart`:

```ts
import { defineWebPart } from '@mbsks/rspfx-webpart-base';
import { createReactAdapter } from '@mbsks/rspfx-framework-react/headless';
export default defineWebPart<{ name: string }>({
  adapterFactory: () => createReactAdapter((props) => <Hello {...props} />),
});
```

Each package has three entry points: preset, `/headless`, and `/webpart`. The preset is Node safe. The adapter runs in the browser.

See [Custom framework guide](./custom-framework-guide.md) for the contract.

## Need Angular, Lit, or Qwik

RSPFx does not ship those presets. You can add them with a custom `FrameworkPreset` and `BaseWebPart`. See [Custom framework guide](./custom-framework-guide.md).

## Fluent UI note

`@mbsks/rspfx-fluent-adapter` is React only. It syncs the SharePoint theme. Install it with `@fluentui/react` on React 18. It does not support React 19 yet. See [React 19](./react-19.md).

For tech details, see [../../reference/frameworks-reference.md](../../reference/frameworks-reference.md).
