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

const rspackConfig = createRspackConfig(projectConfig, { mode: 'production' });

// one-shot production compile to dist/ + release/
await build(projectConfig);

// watch mode / dev server (workbench-first development)
await startDevServer(projectConfig, { port: 4321 });
```

## API

- `createRspackConfig(project, opts)` — typed Rspack configuration factory
- `build(project, opts)` — production build (manifests + assets)
- `watch(project, opts)` — incremental rebuilds
- `startDevServer(project, opts)` — Rspack dev server with HMR/fast refresh

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- License: MIT
