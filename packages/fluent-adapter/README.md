# @mbsks/rspfx-fluent-adapter

Fluent UI adapter for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Works with Vite, Rsbuild, and Rspack.

Optional `FluentWebPart` base class for React web parts styled with Fluent UI v8.

## Install

```sh
npm i @mbsks/rspfx-fluent-adapter
```

Requires `@fluentui/react` `^8` and `react` `^18` as peer dependencies.

## Usage

```ts
import { FluentWebPart } from '@mbsks/rspfx-fluent-adapter';

export default class MyWebPart extends FluentWebPart {
  protected async renderComponent(root: HTMLElement): Promise<void> {
    // render your Fluent UI React tree into root
  }
}
```

## API

- `FluentWebPart` — React + Fluent UI web part base class

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- License: MIT
