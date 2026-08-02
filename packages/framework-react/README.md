# @mbsks/rspfx-framework-react

React framework adapter for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain powered by Rspack.

Provides the `ReactWebPart` base class with fast refresh support via `@rspack/plugin-react-refresh`.

## Install

```sh
npm i @mbsks/rspfx-framework-react
```

Requires `react` and `react-dom` `^18` as peer dependencies.

## Usage

```ts
import { ReactWebPart } from '@mbsks/rspfx-framework-react/webpart';
import { adapter, preset } from '@mbsks/rspfx-framework-react';

export default class MyWebPart extends ReactWebPart {
  protected async renderComponent(root: HTMLElement): Promise<void> {
    // render your React tree into root
  }
}
```

## API

- `ReactWebPart` — base web part class (from `@mbsks/rspfx-framework-react/webpart`)
- `adapter` / `preset` — `FrameworkAdapter` / `FrameworkPreset` registrations

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- [React example](https://github.com/master8848/rspfx/tree/main/examples/react)
- License: MIT
