# @mbsks/rspfx-framework-svelte

Svelte framework adapter for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain powered by Rspack.

Provides the `SvelteWebPart` base class with `svelte-loader` + `svelte-hmr` support.

## Install

```sh
npm i @mbsks/rspfx-framework-svelte
```

Requires `svelte` `^4.2` as a peer dependency.

## Usage

```ts
import { SvelteWebPart } from '@mbsks/rspfx-framework-svelte/webpart';
import { adapter, preset } from '@mbsks/rspfx-framework-svelte';

export default class MyWebPart extends SvelteWebPart {
  protected async renderComponent(root: HTMLElement): Promise<void> {
    // mount your Svelte component into root
  }
}
```

## API

- `SvelteWebPart` — base web part class (from `@mbsks/rspfx-framework-svelte/webpart`)
- `adapter` / `preset` — `FrameworkAdapter` / `FrameworkPreset` registrations

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- [Svelte example](https://github.com/master8848/rspfx/tree/main/examples/svelte)
- License: MIT
