# @mbsks/rspfx-framework-vanilla

Vanilla JS/TS framework adapter for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain powered by Rspack.

The default adapter with no framework runtime: extend `BaseWebPart` directly.

## Install

```sh
npm i @mbsks/rspfx-framework-vanilla
```

## Usage

```ts
import { BaseWebPart } from '@mbsks/rspfx-core';
import { adapter, preset } from '@mbsks/rspfx-framework-vanilla';

export default class MyWebPart extends BaseWebPart {
  protected async onInit(): Promise<void> {
    this.domElement.innerHTML = '<h1>Hello RSPFX</h1>';
  }
}
```

## API

- `adapter` / `preset` — `FrameworkAdapter` / `FrameworkPreset` registrations

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- [Vanilla example](https://github.com/master8848/rspfx/tree/main/examples/vanilla)
- License: MIT
