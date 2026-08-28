# @mbsks/rspfx-dev-runtime

Dev runtime for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Works with Vite, Rsbuild, and Rspack.

Implements the workbench-first development experience: serve emulation, websocket-based refresh, state-preserving fast refresh, and project discovery (reads the project's bundler config plugin options).

## Install

```sh
npm i @mbsks/rspfx-dev-runtime
```

## Usage

```ts
import { startServe } from '@mbsks/rspfx-dev-runtime';
import { resolveConfig } from '@mbsks/rspfx-core';

const handle = await startServe({
  projectRoot: process.cwd(),
  config: resolveConfig({ name: 'my-app', framework: 'react', spfxVersion: '1.23' }),
  port: 4321,
  fastRefresh: true,
});
await handle.close();
```

## API

- `startServe(opts)` — dev server + manifest server + workbench launch (`opts: DevRuntimeOptions { projectRoot, config, port?, fastRefresh?, noBrowser?, tenantDomain?, mode? }`)
- `readProject(projectRoot, paths?, versionOverride?, rspfxConfig?)` — read package.json/config.json/serve.json, discover web parts
- `loadFrameworkPreset(framework, projectRoot?)` — resolve framework preset (compiler contributions)
- `createRefreshRuntime(framework, opts?)` — state-preservation refresh runtime
- `createCompileContext(opts)` — build a `CompileContext` for the compiler
- `DevRuntimeHandle`, `DevRuntimeOptions` — types

## Links

- [Documentation](https://rspfx.mbsks.me) — [Commands](https://rspfx.mbsks.me/docs/commands) · [Fast Refresh](https://rspfx.mbsks.me/docs/fast-refresh)
- [GitHub](https://github.com/master8848/rspfx)
- License: MIT
