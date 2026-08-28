# @mbsks/rspfx-compiler-rspack

Rspack backend of [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Vite and Rsbuild are supported via [`@mbsks/rspfx-plugin`](https://rspfx.mbsks.me/docs/architecture) (`rspfxVite` / `rspfxRsbuild`). This package is the **Rspack-only** compiler; the triple-bundler toolchain is Vite (default) · Rsbuild · Rspack.

A thin, owned configuration factory around **Rspack** (no webpack, Heft, or gulp anywhere): TypeScript via SWC, SCSS, PostCSS/Tailwind, asset handling, dev server, and fast refresh wiring.

## Install

```sh
npm i @mbsks/rspfx-compiler-rspack
```

## Usage

```ts
import { createRspackConfig, build, watch, startDevServer } from '@mbsks/rspfx-compiler-rspack';
import type { CompileContext } from '@mbsks/rspfx-compiler-rspack';

// ctx is the CompileContext assembled by dev-runtime (project + config + entries)
declare const ctx: CompileContext;

const rspackConfig = await createRspackConfig(ctx);

// one-shot production compile to dist/
const result = await build(ctx);

// watch mode
const handle = watch(ctx, (stats, errors) => {
  if (errors.length) console.error(errors);
});

// dev server (workbench-first development)
const server = await startDevServer(ctx, { port: 4321 });
await server.close();
```

## API

- `createRspackConfig(ctx)` — async typed Rspack configuration factory (`ctx: CompileContext`)
- `build(ctx)` — production build (`ctx: CompileContext`)
- `watch(ctx, onDone)` — incremental rebuilds (`onDone: (stats, errors) => void`)
- `startDevServer(ctx, opts)` — Rspack dev server with HMR/fast refresh (`opts: DevServerOptions`)

## Links

- [Documentation](https://rspfx.mbsks.me) — [Getting Started](https://rspfx.mbsks.me/docs/getting-started) · [Commands](https://rspfx.mbsks.me/docs/commands)
- See [`@mbsks/rspfx-plugin`](https://www.npmjs.com/package/@mbsks/rspfx-plugin) for Vite (`rspfxVite`) and Rsbuild (`rspfxRsbuild`) backends
- [GitHub](https://github.com/master8848/rspfx)
- License: MIT
