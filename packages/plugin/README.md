# @mbsks/rspfx-plugin

Bundler plugins for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. **Vite (default) · Rsbuild · Rspack** — one config, three bundlers.

Provides the three thin adapters over a single compilation kernel: **Rspack** (`RSpfxPlugin`), **Vite** (`rspfxVite`), **Rsbuild** (`rspfxRsbuild`). All read the same `RSPFX_PLUGIN_MARKER` project config and share manifest / sppkg / dev-runtime.

## Install

```sh
npm i @mbsks/rspfx-plugin
# peer: @rspack/core for Rspack, vite for Vite, @rsbuild/core for Rsbuild (optional)
```

## Usage

**Rspack** — `rspack.config.ts`:

```ts
import { RSpfxPlugin, defineConfig } from '@mbsks/rspfx-plugin';

export default defineConfig({
  plugins: [new RSpfxPlugin({ framework: 'react', spfxVersion: '1.23' })]
});
```

**Vite** — `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { rspfxVite, defineConfig as defineRspfx } from '@mbsks/rspfx-plugin';

export default defineConfig({
  plugins: [rspfxVite(defineRspfx({ framework: 'react', spfxVersion: '1.23' }))]
});
```

**Rsbuild** — `rsbuild.config.ts`:

```ts
import { defineConfig } from '@rsbuild/core';
import { rspfxRsbuild, defineConfig as defineRspfx } from '@mbsks/rspfx-plugin';

export default defineConfig({
  plugins: [rspfxRsbuild(defineRspfx({ framework: 'react', spfxVersion: '1.23' }))]
});
```

`rspfx new` / `rspfx migrate` generates this for you — no manual bundler config needed for standard SPFx layouts (`src/webparts/*/`, `config/`).

## API

- `RSpfxPlugin` — Rspack/Webpack-compatible plugin
- `rspfxVite(opts)` — Vite plugin (`ViteRspfxPlugin`)
- `rspfxRsbuild(opts)` — Rsbuild plugin (`RsbuildRspfxPlugin`)
- `createKernel(opts)` — single compilation kernel (shared by all three adapters)
- `rspfxResolve` — resolve helpers
- Re-exports: `defineConfig`, `resolveConfig`, `RSPFX_PLUGIN_MARKER`, `RSPFX_PLUGIN_OPTIONS`, `RspfxConfig`

## Links

- [Documentation](https://rspfx.mbsks.me) — [Getting Started](https://rspfx.mbsks.me/docs/getting-started) · [Commands](https://rspfx.mbsks.me/docs/commands) · [Custom Framework](https://rspfx.mbsks.me/docs/custom-framework)
- [Architecture](https://github.com/master8848/rspfx/blob/main/ARCHITECTURE.md) · [Internal API](https://github.com/master8848/rspfx/blob/main/docs/internal-api.md)
- [Vite example](https://github.com/master8848/rspfx/tree/main/examples/vite-react) · [Rsbuild example](https://github.com/master8848/rspfx/tree/main/examples/rsbuild-react) · [Rspack example](https://github.com/master8848/rspfx/tree/main/examples/react)
- [GitHub](https://github.com/master8848/rspfx)
- License: MIT
