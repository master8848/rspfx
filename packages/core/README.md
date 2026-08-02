# @mbsks/rspfx-core

Zero-dependency core of [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain powered by Rspack.

Contains the shared foundation used by every RSPFX package: SPFx types, the base web part, project config, and environment helpers. It has **no dependencies** — no framework, no bundler, no Node APIs — and runs anywhere.

## Install

```sh
npm i @mbsks/rspfx-core
# or: pnpm add @mbsks/rspfx-core
```

Requires the `@microsoft/sp-core-library` and `@microsoft/sp-webpart-base` peer packages.

## Usage

```ts
import { defineConfig, resolveConfig } from '@mbsks/rspfx-core';
import { EnvironmentType } from '@mbsks/rspfx-core';
import { Version } from '@mbsks/rspfx-core';

const config = resolveConfig(
  defineConfig({ framework: 'react', spfxVersion: '1.22' })
);
```

## API

- `defineConfig(config)` / `resolveConfig(config)` — typed project config with defaults
- `RspfxConfig`, `BuildConfig`, `DevConfig`, `DeployConfig`, `PlaygroundConfig` — config types
- `FrameworkId`, `SpfxTarget` — framework and SPFx target unions
- `EnvironmentType`, `PropertyPaneFieldType` — SPFx-compatible enums
- `Version` — SPFx-style version parsing/comparison
- Base web part (`BaseWebPart` with `renderInto`/`disposeFrom`/`getComponentProps` hooks) — extend to build your own web parts

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- [Internal API contract](https://github.com/master8848/rspfx/blob/main/docs/internal-api.md)
- License: MIT
