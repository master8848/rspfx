# @mbsks/rspfx-framework-solid

Solid framework adapter for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain powered by Rspack.

Provides the `SolidWebPart` base class with `babel-preset-solid` compilation.

## Install

```sh
npm i @mbsks/rspfx-framework-solid
```

Requires `solid-js` `^1.9` as a peer dependency.

## Usage

```ts
import { SolidWebPart } from '@mbsks/rspfx-framework-solid/webpart';
import { adapter, preset } from '@mbsks/rspfx-framework-solid';

export default class MyWebPart extends SolidWebPart {
  protected async renderComponent(root: HTMLElement): Promise<void> {
    // mount your Solid root into root
  }
}
```

## API

- `SolidWebPart` — base web part class (from `@mbsks/rspfx-framework-solid/webpart`)
- `adapter` / `preset` — `FrameworkAdapter` / `FrameworkPreset` registrations

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- [Solid example](https://github.com/master8848/rspfx/tree/main/examples/solid)
- License: MIT
