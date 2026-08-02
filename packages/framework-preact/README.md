# @mbsks/rspfx-framework-preact

Preact framework package for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain powered by Rspack.

Provides the `PreactWebPart` base class with fast refresh via `@rspack/plugin-preact-refresh`.

## Install

```sh
npm i @mbsks/rspfx-framework-preact
```

Requires `preact` `^10.24` as a peer dependency.

## Usage

```ts
import { PreactWebPart } from '@mbsks/rspfx-framework-preact/webpart';
import { preset } from '@mbsks/rspfx-framework-preact';

export default class MyWebPart extends PreactWebPart {
  protected async renderComponent(root: HTMLElement): Promise<void> {
    // render your Preact tree into root
  }
}
```

## API

- `PreactWebPart` — base web part class (from `@mbsks/rspfx-framework-preact/webpart`)
- `preset` — `FrameworkPreset` compiler contributions (from the package index)

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- [Preact example](https://github.com/master8848/rspfx/tree/main/examples/preact)
- License: MIT
