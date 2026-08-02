# @mbsks/rspfx-plugin-api

Plugin API of [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain powered by Rspack.

Lets you extend the toolchain with `RspfxExtension` instances: framework presets, compiler hooks, and package hooks.

## Install

```sh
npm i @mbsks/rspfx-plugin-api
```

## Usage

```ts
import { definePlugin, registerPlugin, getPlugins } from '@mbsks/rspfx-plugin-api';
import type { FrameworkPreset } from '@mbsks/rspfx-plugin-api';

const preset: FrameworkPreset = {
  name: 'my-framework',
  contributions() {
    return { swc: { jsc: { parser: { syntax: 'typescript' } } } };
  }
};

registerPlugin(definePlugin({ name: 'my-framework', frameworkPreset: preset }));
```

## API

- `definePlugin(plugin)` — typed plugin factory
- `registerPlugin(plugin)` / `getPlugins()` — global registry (wired by the CLI)
- Types: `RspfxExtension`, `FrameworkPreset`, `FrameworkRspackContributions`, `CompilerHooks`, `PackageHooks`

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- [Internal API contract](https://github.com/master8848/rspfx/blob/main/docs/internal-api.md)
- License: MIT
