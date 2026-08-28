# @mbsks/rspfx-framework-react

React framework package for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Works with Vite, Rsbuild, and Rspack.

Provides the `ReactWebPart` base class with fast refresh: Rspack via `@rspack/plugin-react-refresh`, Vite via `@vitejs/plugin-react`, Rsbuild via its React plugin — same `FrameworkPreset` works with all three bundlers (`rspfxVite` / `rspfxRsbuild` / `RSpfxPlugin`).

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

- [Documentation](https://rspfx.mbsks.me) — [Frameworks](https://rspfx.mbsks.me/docs/frameworks) · [Fast Refresh](https://rspfx.mbsks.me/docs/fast-refresh)
- [React example](https://github.com/master8848/rspfx/tree/main/examples/react) · [Vite React](https://github.com/master8848/rspfx/tree/main/examples/vite-react) · [Rsbuild React](https://github.com/master8848/rspfx/tree/main/examples/rsbuild-react)
- [GitHub](https://github.com/master8848/rspfx)
- License: MIT
