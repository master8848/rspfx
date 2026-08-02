# @mbsks/rspfx-framework-vue

Vue framework adapter for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain powered by Rspack.

Provides the `VueWebPart` base class with `vue-loader` SFC compilation.

## Install

```sh
npm i @mbsks/rspfx-framework-vue
```

Requires `vue` `^3.5` as a peer dependency.

## Usage

```ts
import { VueWebPart } from '@mbsks/rspfx-framework-vue/webpart';
import { adapter, preset } from '@mbsks/rspfx-framework-vue';

export default class MyWebPart extends VueWebPart {
  protected async renderComponent(root: HTMLElement): Promise<void> {
    // mount your Vue app into root
  }
}
```

## API

- `VueWebPart` — base web part class (from `@mbsks/rspfx-framework-vue/webpart`)
- `adapter` / `preset` — `FrameworkAdapter` / `FrameworkPreset` registrations

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- [Vue example](https://github.com/master8848/rspfx/tree/main/examples/vue)
- License: MIT
