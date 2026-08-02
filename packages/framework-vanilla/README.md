# @mbsks/rspfx-framework-vanilla

Vanilla JS/TS framework package for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain powered by Rspack.

The default framework with no runtime: extend `BaseWebPart` directly.

## Install

```sh
npm i @mbsks/rspfx-framework-vanilla
```

## Usage

```ts
import { BaseWebPart } from '@mbsks/rspfx-core';
import { preset } from '@mbsks/rspfx-framework-vanilla';

export default class MyWebPart extends BaseWebPart {
  protected async onInit(): Promise<void> {
    this.domElement.innerHTML = '<h1>Hello RSPFX</h1>';
  }
}
```

## API

- `preset` — `FrameworkPreset` compiler contributions (from the package index)

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- [Vanilla example](https://github.com/master8848/rspfx/tree/main/examples/vanilla)
- License: MIT
