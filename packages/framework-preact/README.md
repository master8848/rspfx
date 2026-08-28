# @mbsks/rspfx-framework-preact

Preact framework package for [RSPFx](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Works with Vite, Rsbuild, and Rspack.

Provides the `PreactWebPart` base class with fast refresh: Rspack via `@rspack/plugin-preact-refresh`, Vite and Rsbuild via their Preact refresh plugins — same `FrameworkPreset` for all three bundlers.

## Install

```sh
npm i @mbsks/rspfx-framework-preact
```

Requires `preact` `^10.24` as a peer dependency.

## Usage

```ts
import { PreactWebPart } from '@mbsks/rspfx-framework-preact/webpart';
import { preset } from '@mbsks/rspfx-framework-preact';
import type { ComponentChild } from 'preact';

interface IMyProps { description: string; }

export default class MyWebPart extends PreactWebPart<IMyProps> {
  protected renderComponent(props: IMyProps): ComponentChild {
    // return your Preact tree using props
    return null as unknown as ComponentChild;
  }
}
```

## API

- `PreactWebPart` — base web part class (from `@mbsks/rspfx-framework-preact/webpart`)
- `preset` — `FrameworkPreset` compiler contributions (from the package index)

## Links

- [Documentation](https://rspfx.mbsks.me) — [Frameworks](https://rspfx.mbsks.me/docs/frameworks)
- [Preact example](https://github.com/master8848/rspfx/tree/main/examples/preact)
- [GitHub](https://github.com/master8848/rspfx)
- License: MIT
