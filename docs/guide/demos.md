# Demos

TL;DR: RSPFx ships runnable examples for every bundler and framework. Clone the repo, install deps, and run `rspfx dev` to see them in action.

Every example in `examples/` builds with `rspfx build` and packages with `rspfx package`. Each one outputs a valid `.sppkg` to `sharepoint/solution/`.

## Run any demo

```sh
git clone https://github.com/master8848/rspfx
cd rspfx/examples/react
bun install
rspfx dev
```

Open `http://localhost:4321` for local preview. Add `--tenant https://contoso.sharepoint.com` for the workbench. See [Getting started](./getting-started.md).

## Featured external demo

| Demo | Stack | Repo |
|---|---|---|
| Play Fish - SPFx Chess | Solid 1.9, Tailwind v4, Stockfish 18 WASM, chessground, Rspack, SPFx 1.22 | [master8848/spfx-with-rspfx-chess-demo](https://github.com/master8848/spfx-with-rspfx-chess-demo) |

Play Fish runs Stockfish as WebAssembly in a Web Worker. It uses Solid, Tailwind v4, and chessground for the board. It shows how RSPFx handles WASM, workers, and Tailwind in one `rspack.config.ts`.

## All demos at a glance

| Demo | Framework | Bundler | Path |
|---|---|---|---|
| feedback (React 19) | React 19 | Vite 8 | `examples/vite-react19` |
| hello-react | React 18 | Rspack | `examples/react` |
| hello-react (Vite) | React 18 | Vite | `examples/vite-react` |
| hello-react (Rsbuild) | React 18 | Rsbuild | `examples/rsbuild-react` |
| hello-solid | Solid | Rspack | `examples/solid` |
| hello-solid (Rsbuild) | Solid | Rsbuild | `examples/rsbuild-solid` |
| hello-vanilla | Vanilla TS | Rspack | `examples/vanilla` |
| hello-vanilla (Vite) | Vanilla TS | Vite | `examples/vite-vanilla` |
| hello-preact | Preact | Rspack | `examples/preact` |
| hello-vue | Vue 3 | Rspack | `examples/vue` |
| hello-svelte | Svelte | Rspack | `examples/svelte` |
| shadcn | React 18 + Tailwind v4 | Rspack | `examples/shadcn` |
| mixed | React 18 | Vite | `examples/mixed` |
| modern-search | React 17 + Fluent UI 8 | Rspack | `examples/modern-search` |

All examples use deterministic GUIDs for tests. Do not install two variants with the same ID on one tenant. Regenerate IDs with `crypto.randomUUID()`.

## Demos by framework

Framework is set at scaffold time with `--framework` and in the plugin options.

- **React:** `examples/react`, `examples/vite-react`, `examples/rsbuild-react`, `examples/shadcn`, `examples/mixed`, `examples/vite-react19`. See [Choosing a framework](./frameworks/choosing-a-framework.md).
- **Vanilla:** `examples/vanilla`, `examples/vite-vanilla`.
- **Vue, Svelte, Solid, Preact:** `examples/vue`, `examples/svelte`, `examples/solid`, `examples/rsbuild-solid`, `examples/preact`. The chess demo also uses Solid.

All frameworks support `rspfx dev --refresh` where HMR is available. See [Fast refresh](./styling/fast-refresh.md).

## Demos by bundler

RSPFx exposes one plugin per bundler with the same options:

- **Vite** - `rspfxVite()` in `vite.config.ts`: `examples/vite-react`, `examples/vite-vanilla`, `examples/mixed`, `examples/vite-react19`.
- **Rspack** - `RspfxPlugin` in `rspack.config.ts`: `examples/react`, `examples/preact`, `examples/vue`, `examples/svelte`, `examples/solid`, `examples/vanilla`, `examples/shadcn`, `examples/modern-search`.
- **Rsbuild** - `rspfxRsbuild()` in `rsbuild.config.ts`: `examples/rsbuild-react`, `examples/rsbuild-solid`.

See [../reference/architecture.md](../reference/architecture.md) for the pipeline.

## Production and multi-component demos

- **modern-search** - Real world search solution with 4 web parts, 178 TS files, and 16 permission scopes. See [Migration case study](./migration/migration-case-study.md).
- **mixed** - One solution with a web part, an extension, and a library. See [Multi web part](./project-setup/multi-webpart.md).
- **shadcn** - Tailwind v4 styling without Fluent UI. See [Styling](./styling/styling.md).

## Commands per demo

```sh
rspfx dev
rspfx build
rspfx package
rspfx doctor
rspfx analyze
```

For more detail, see [../reference/commands.md](../reference/commands.md) and [../reference/architecture.md](../reference/architecture.md).
