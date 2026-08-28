# @mbsks/rspfx-framework-svelte

Svelte framework package for [RSPFx](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Works with Vite, Rsbuild, and Rspack.

Provides the `SvelteWebPart` base class with compilation: Rspack via `svelte-loader` + `svelte-hmr`, Vite via `@sveltejs/vite-plugin-svelte`, Rsbuild via its Svelte plugin.

## Install

```sh
npm i @mbsks/rspfx-framework-svelte
```

Requires `svelte` `^4.2` as a peer dependency.

## Usage

```ts
import { SvelteWebPart, type SvelteWebPartComponent } from '@mbsks/rspfx-framework-svelte/webpart';
import { preset } from '@mbsks/rspfx-framework-svelte';

interface IMyProps { description: string; }

export default class MyWebPart extends SvelteWebPart<IMyProps> {
  protected renderComponent(props: IMyProps): SvelteWebPartComponent<IMyProps> {
    // return { component, props } for Svelte
    return null as unknown as SvelteWebPartComponent<IMyProps>;
  }
}
```

## API

- `SvelteWebPart` — base web part class (from `@mbsks/rspfx-framework-svelte/webpart`)
- `preset` — `FrameworkPreset` compiler contributions (from the package index)

## Links

- [Documentation](https://rspfx.mbsks.me) — [Frameworks](https://rspfx.mbsks.me/docs/frameworks)
- [Svelte example](https://github.com/master8848/rspfx/tree/main/examples/svelte)
- [GitHub](https://github.com/master8848/rspfx)
- License: MIT
