# @mbsks/rspfx-framework-solid

Solid framework package for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Works with Vite, Rsbuild, and Rspack.

Provides the `SolidWebPart` base class with `babel-preset-solid` compilation.

## Install

```sh
npm i @mbsks/rspfx-framework-solid
```

Requires `solid-js` `^1.9` as a peer dependency.

## Usage

```ts
import { SolidWebPart } from '@mbsks/rspfx-framework-solid/webpart';
import { preset } from '@mbsks/rspfx-framework-solid';
import type { JSX } from 'solid-js';

interface IMyProps { description: string; }

export default class MyWebPart extends SolidWebPart<IMyProps> {
  protected renderComponent(props: IMyProps): JSX.Element {
    // return your Solid JSX using props
    return null as unknown as JSX.Element;
  }
}
```

## API

- `SolidWebPart` — base web part class (from `@mbsks/rspfx-framework-solid/webpart`)
- `preset` — `FrameworkPreset` compiler contributions (from the package index)

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- [Solid example](https://github.com/master8848/rspfx/tree/main/examples/solid)
- License: MIT
