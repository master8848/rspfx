# @mbsks/rspfx-sharepoint-runtime

SharePoint runtime bridges for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Works with Vite, Rsbuild, and Rspack.

Shims and bridges that let `@microsoft/sp-*` packages run in the local playground sandbox: mock web part context, playground loaders, and environment emulation.

## Install

```sh
npm i @mbsks/rspfx-sharepoint-runtime
```

Requires the `@microsoft/sp-webpart-base` and `@microsoft/sp-core-library` peer packages.

## Usage

```ts
import {
  createMockWebPartContext,
  createPlaygroundLoader,
  PLAYGROUND_SERVICE_KEY
} from '@mbsks/rspfx-sharepoint-runtime';

const context = createMockWebPartContext({ tenantDomain: 'contoso.sharepoint.com' });
```

## API

- `createMockWebPartContext(opts)` — SPFx-like context for the local sandbox
- `createPlaygroundLoader(...)` — load web parts in the playground
- `PLAYGROUND_SERVICE_KEY` — service key used by the playground runtime

## Links

- [Documentation](https://rspfx.mbsks.me) — [Local Preview](https://rspfx.mbsks.me/docs/local-preview)
- [GitHub](https://github.com/master8848/rspfx)
- License: MIT
