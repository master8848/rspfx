# @mbsks/rspfx-framework-vue

Vue framework package for [RSPFx](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Works with Vite, Rsbuild, and Rspack.

Provides the `VueWebPart` base class with SFC compilation: Rspack via `vue-loader`, Vite via `@vitejs/plugin-vue`, Rsbuild via its Vue plugin — one `FrameworkPreset` for all three.

## Install

```sh
npm i @mbsks/rspfx-framework-vue
```

Requires `vue` `^3.5` as a peer dependency.

## Usage

```ts
import { VueWebPart } from '@mbsks/rspfx-framework-vue/webpart';
import { preset } from '@mbsks/rspfx-framework-vue';
import type { Component } from 'vue';

interface IMyProps { description: string; }

export default class MyWebPart extends VueWebPart<IMyProps> {
  protected renderComponent(props: IMyProps): Component {
    // return your Vue component using props
    return null as unknown as Component;
  }
}
```

## API

- `VueWebPart` — base web part class (from `@mbsks/rspfx-framework-vue/webpart`)
- `preset` — `FrameworkPreset` compiler contributions (from the package index)

## Links

- [Documentation](https://rspfx.mbsks.me) — [Frameworks](https://rspfx.mbsks.me/docs/frameworks)
- [Vue example](https://github.com/master8848/rspfx/tree/main/examples/vue)
- [GitHub](https://github.com/master8848/rspfx)
- License: MIT
