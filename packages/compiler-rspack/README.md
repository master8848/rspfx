# @mbsks/rspfx-compiler-rspack

Compiler layer of [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain powered by Rspack.

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

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- License: MIT
