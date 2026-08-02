# @mbsks/rspfx-dev-runtime

Dev runtime for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain powered by Rspack.

Implements the workbench-first development experience: serve emulation, websocket-based refresh, state-preserving fast refresh, and project discovery (`rspfx.config.ts`).

## Install

```sh
npm i @mbsks/rspfx-dev-runtime
```

## Usage

```ts
import { startServe, startPlayground, readProject, loadFrameworkPreset } from '@mbsks/rspfx-dev-runtime';

const project = await readProject(process.cwd());
const preset = await loadFrameworkPreset(project.framework);

const handle = await startServe(project, { port: 4321, refresh: true });
await handle.close();
```

## API

- `startServe(project, opts)` — dev server + manifest server + workbench launch
- `startPlayground(project, opts)` — standalone localhost sandbox (no SharePoint)
- `readProject(dir)` — load and validate `rspfx.config.ts`
- `loadFrameworkPreset(framework)` — resolve framework adapter
- `createRefreshRuntime(project)` — websocket refresh runtime
- `discoverWebParts(project)` — find web part entry points
- `DevRuntimeHandle`, `DevRuntimeOptions` — types

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- License: MIT
