# @mbsks/rspfx-framework-react

React framework package for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain powered by Rspack.

Provides the `ReactWebPart` base class with fast refresh support via `@rspack/plugin-react-refresh`.

## Install

```sh
npm i @mbsks/rspfx-framework-react
```

Requires `react` and `react-dom` `^18` as peer dependencies.

## Usage

```ts
import { ReactWebPart } from '@mbsks/rspfx-framework-react/webpart';
import { preset } from '@mbsks/rspfx-framework-react';
import type { ReactElement } from 'react';

interface IMyProps { description: string; }

export default class MyWebPart extends ReactWebPart<IMyProps> {
  protected renderComponent(props: IMyProps): ReactElement {
    // return your React element using props
    return null as unknown as ReactElement;
  }
}
```

## API

- `ReactWebPart` — base web part class (from `@mbsks/rspfx-framework-react/webpart`)
- `preset` — `FrameworkPreset` compiler contributions (from the package index)

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- [React example](https://github.com/master8848/rspfx/tree/main/examples/react)
- License: MIT
