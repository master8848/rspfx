# @mbsks/rspfx-framework-vanilla

Vanilla JS/TS framework package for [RSPFx](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Works with Vite, Rsbuild, and Rspack.

The default framework with no runtime: extend `BaseWebPart` directly.

## Install

```sh
npm i @mbsks/rspfx-framework-vanilla
```

## Usage

```ts
import { BaseWebPart } from '@mbsks/rspfx-core/webpart';
import { preset } from '@mbsks/rspfx-framework-vanilla';

interface IMyProps { description: string; }

export default class MyWebPart extends BaseWebPart<IMyProps> {
  protected getComponentProps(): IMyProps {
    return this.properties;
  }

  protected renderInto(root: HTMLElement): void {
    root.innerHTML = `<h1>Hello ${this.getComponentProps().description}</h1>`;
  }

  protected disposeFrom(root: HTMLElement): void {
    root.replaceChildren();
  }
}
```

## API

- `preset` — `FrameworkPreset` compiler contributions (from the package index)

## Links

- [Documentation](https://rspfx.mbsks.me) — [Frameworks](https://rspfx.mbsks.me/docs/frameworks)
- [Vanilla example](https://github.com/master8848/rspfx/tree/main/examples/vanilla) · [Vite Vanilla](https://github.com/master8848/rspfx/tree/main/examples/vite-vanilla)
- [GitHub](https://github.com/master8848/rspfx)
- License: MIT
