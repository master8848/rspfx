# Demos

Runnable RSPFX examples in `examples/` plus one external project. Every example scaffolds via `rspfx new`, builds with `rspfx build`, and packages with `rspfx package` to `sharepoint/solution/*.sppkg`.

Clone the repo and run any demo with `rspfx dev` on `http://localhost:4321` (local preview) or `https://localhost:4321` when a tenant is set via `dev.tenantUrl` or `--tenant`. See [getting-started.md](getting-started.md) and [commands.md](commands.md).

## Featured — external

| Demo | Stack | Repo |
|---|---|---|
| Play Fish — SPFx Chess | Solid 1.9 · Tailwind v4 · Stockfish 18 Lite WASM · chessground · Rspack · SPFx 1.22 | [master8848/spfx-with-rspfx-chess-demo](https://github.com/master8848/spfx-with-rspfx-chess-demo) |

Play Fish is a SharePoint web part that plays chess against Stockfish 18 Lite in the browser.

Engine runs as WebAssembly (~7 MB, single-threaded) in a Web Worker, so the UI never blocks. UI is Solid.js with Tailwind v4 and [chessground](https://github.com/lichess-org/chessground). Rules are [chess.js](https://github.com/jhlywa/chess.js) (castling, en passant, promotion, checkmate/stalemate, PGN). Board supports drag & drop, animations, last-move/check highlights, legal-move dots, flip, and keyboard navigation.

Games persist to a SharePoint list `Chess Games` (created on first use via PnPjs, columns PGN/Moves/Result/WhiteElo/BlackElo/WhiteName/BlackName/Site) and fall back to localStorage demo mode without a SharePoint context. Includes 7 Elo levels (700–2800), thinking timer, confetti on win, and theme-aware styling (`data-theme="light|dark"`).

What it proves for RSPFX: non-React framework at a modern version, ~7 MB WASM asset handling, Web Worker chunk, Tailwind v4 PostCSS pipeline, and a single `rspack.config.ts` with `RspfxPlugin` (`packages/plugin/src/index.ts`). See the demo repo for `pnpm dev` / `pnpm build` / `pnpm package` and deployment steps.

## All demos at a glance

| Demo | Framework | Bundler | Path | Highlights |
|---|---|---|---|---|
| hello-react | React 18 | Rspack | [examples/react](https://github.com/master8848/rspfx/tree/main/examples/react) | `ReactWebPart` from `@mbsks/rspfx-framework-react`, `rspack.config.ts` + `RspfxPlugin`, auto `jsx: react-jsx` |
| hello-react (Vite) | React 18 | Vite | [examples/vite-react](https://github.com/master8848/rspfx/tree/main/examples/vite-react) | Same web part via `rspfxVite()` in `vite.config.ts`, `vite build` per bundle |
| hello-react (Rsbuild) | React 18 | Rsbuild | [examples/rsbuild-react](https://github.com/master8848/rspfx/tree/main/examples/rsbuild-react) | Same web part via `rspfxRsbuild()` in `rsbuild.config.ts`, `rsbuild build` per bundle |
| hello-vanilla | Vanilla TS | Rspack | [examples/vanilla](https://github.com/master8848/rspfx/tree/main/examples/vanilla) | No framework, `renderComponent()` returns DOM, `rspack.config.ts` |
| hello-vanilla (Vite) | Vanilla TS | Vite | [examples/vite-vanilla](https://github.com/master8848/rspfx/tree/main/examples/vite-vanilla) | Same vanilla web part via `vite.config.ts` + `rspfxVite()` |
| hello-preact | Preact | Rspack | [examples/preact](https://github.com/master8848/rspfx/tree/main/examples/preact) | `PreactWebPart` from `@mbsks/rspfx-framework-preact`, `jsxImportSource: preact` |
| hello-vue | Vue 3 | Rspack | [examples/vue](https://github.com/master8848/rspfx/tree/main/examples/vue) | `VueWebPart` from `@mbsks/rspfx-framework-vue`, SFC `Hello.vue` with `<script setup lang="ts">` |
| hello-svelte | Svelte | Rspack | [examples/svelte](https://github.com/master8848/rspfx/tree/main/examples/svelte) | `SvelteWebPart` from `@mbsks/rspfx-framework-svelte`, `Hello.svelte` scoped styles |
| hello-solid | Solid | Rspack | [examples/solid](https://github.com/master8848/rspfx/tree/main/examples/solid) | `SolidWebPart` from `@mbsks/rspfx-framework-solid`, `jsxImportSource: solid-js` + `babel-preset-solid` |
| shadcn | React 18 + Tailwind v4 | Rspack | [examples/shadcn](https://github.com/master8848/rspfx/tree/main/examples/shadcn) | `shadcn/ui` components (`components/ui/*`, `cn()` in `components/lib/utils.ts`), `globals.css` with `@theme inline` tokens |
| mixed | React 18 | Vite | [examples/mixed](https://github.com/master8848/rspfx/tree/main/examples/mixed) | Multi-component: web part + application customizer + library, `vite.config.ts` + `rspfxVite()` |
| modern-search | React 17 · Fluent UI 8 | Rspack | [examples/modern-search](https://github.com/master8848/rspfx/tree/main/examples/modern-search) | PnP Modern Search v4.23.3 migrated from Heft/webpack, 4 web parts, 14 locales, see [migration-case-study.md](migration-case-study.md) |

All `examples/*` share deterministic GUIDs for docs and tests (e.g. `react` and `vite-react` both use component `11111111-1111-4111-8111-111111111101`, solution `22222222-2222-4222-8222-222222222201`). Do not install two variants with overlapping IDs on the same tenant; regenerate with `crypto.randomUUID()`. See [project-structure.md](project-structure.md) and `examples/README.md`.

## By framework

Framework is set via `--framework` at scaffold time (`rspfx new --framework vue`) and via `framework:` in plugin options (`@mbsks/rspfx-plugin` / `@mbsks/rspfx-core`). Each framework ships a preset with loaders/SWC options and a `*WebPart` base class plus a headless adapter (`@mbsks/rspfx-framework-<fw>/headless`).

- React: [examples/react](https://github.com/master8848/rspfx/tree/main/examples/react), [examples/vite-react](https://github.com/master8848/rspfx/tree/main/examples/vite-react), [examples/rsbuild-react](https://github.com/master8848/rspfx/tree/main/examples/rsbuild-react), [examples/shadcn](https://github.com/master8848/rspfx/tree/main/examples/shadcn), [examples/mixed](https://github.com/master8848/rspfx/tree/main/examples/mixed). See [frameworks.md](frameworks.md) and [custom-framework.md](custom-framework.md).

- Vanilla: [examples/vanilla](https://github.com/master8848/rspfx/tree/main/examples/vanilla), [examples/vite-vanilla](https://github.com/master8848/rspfx/tree/main/examples/vite-vanilla).

- Vue / Svelte / Solid / Preact: [examples/vue](https://github.com/master8848/rspfx/tree/main/examples/vue), [examples/svelte](https://github.com/master8848/rspfx/tree/main/examples/svelte), [examples/solid](https://github.com/master8848/rspfx/tree/main/examples/solid), [examples/preact](https://github.com/master8848/rspfx/tree/main/examples/preact). External Solid example is the chess demo above.

All frameworks support `rspfx dev --refresh` where the preset provides HMR (see [fast-refresh.md](fast-refresh.md)).

## By bundler

RSPFX exposes one plugin per bundler with the same options shape. Pick the config file, not a different API:

- Vite — `rspfxVite()` in `vite.config.ts`: [examples/vite-react](https://github.com/master8848/rspfx/tree/main/examples/vite-react), [examples/vite-vanilla](https://github.com/master8848/rspfx/tree/main/examples/vite-vanilla), [examples/mixed](https://github.com/master8848/rspfx/tree/main/examples/mixed). Vite is the default for new projects.

- Rspack — `RspfxPlugin` in `rspack.config.ts`: [examples/react](https://github.com/master8848/rspfx/tree/main/examples/react), [examples/preact](https://github.com/master8848/rspfx/tree/main/examples/preact), [examples/vue](https://github.com/master8848/rspfx/tree/main/examples/vue), [examples/svelte](https://github.com/master8848/rspfx/tree/main/examples/svelte), [examples/solid](https://github.com/master8848/rspfx/tree/main/examples/solid), [examples/vanilla](https://github.com/master8848/rspfx/tree/main/examples/vanilla), [examples/shadcn](https://github.com/master8848/rspfx/tree/main/examples/shadcn), [examples/modern-search](https://github.com/master8848/rspfx/tree/main/examples/modern-search). External chess demo also uses Rspack.

- Rsbuild — `rspfxRsbuild()` in `rsbuild.config.ts`: [examples/rsbuild-react](https://github.com/master8848/rspfx/tree/main/examples/rsbuild-react).

See [architecture.md](architecture.md) for the pipeline and [building-packages.md](building-packages.md) for `rspfx build` / `rspfx package` outputs.

## Production-scale and multi-component

- [examples/modern-search](https://github.com/master8848/rspfx/tree/main/examples/modern-search) — PnP Modern Search v4.23.3 (~178 TS files, 24 SCSS modules, 4 web parts, Graph `webApiPermissionRequests`, Handlebars/Adaptive Cards/MGT). Validates that a large real-world SPFx solution compiles unchanged under RSPFX. See [migration-case-study.md](migration-case-study.md) and `examples/modern-search/README.md`.

- [examples/mixed](https://github.com/master8848/rspfx/tree/main/examples/mixed) — one solution with a web part (`src/webparts/hello`), an application customizer (`src/extensions/banner`), and a library (`src/libraries/utils`), plus `assets/favicon.svg` and localized `loc/en-us.ts`. See [project-structure.md](project-structure.md) and [multi-webpart.md](multi-webpart.md).

- [examples/shadcn](https://github.com/master8848/rspfx/tree/main/examples/shadcn) — styling reference for Tailwind v4 CSS-first and shadcn/ui without Fluent UI. See [styling.md](styling.md) and [favicon-and-assets.md](favicon-and-assets.md).

## Running a demo

```sh
git clone https://github.com/master8848/rspfx
cd rspfx/examples/react        # or preact/vue/svelte/solid/vanilla/shadcn/mixed/...
bun install                    # or pnpm install / npm install
rspfx dev                      # http://localhost:4321 — add --tenant https://contoso.sharepoint.com for workbench
rspfx build                    # → dist/ + release/
rspfx package                  # → sharepoint/solution/*.sppkg
```

Each example also supports `rspfx doctor`, `rspfx clean`, and `rspfx analyze` via `apps/cli/src/commands/*`. External chess demo uses `pnpm` and `rspack.config.ts` — `pnpm install && pnpm dev` auto-fetches the Stockfish engine, then `pnpm build` / `pnpm package`.

## Links

- All in-repo examples: [github.com/master8848/rspfx/tree/main/examples](https://github.com/master8848/rspfx/tree/main/examples) and `examples/README.md`.
- Chess demo: [github.com/master8848/spfx-with-rspfx-chess-demo](https://github.com/master8848/spfx-with-rspfx-chess-demo) (Solid, Tailwind v4, Stockfish 18 Lite WASM, Rspack, SPFx 1.22).
- Frameworks: [frameworks.md](frameworks.md), custom presets [custom-framework.md](custom-framework.md), fast refresh [fast-refresh.md](fast-refresh.md).
- Migration story for `modern-search`: [migration-case-study.md](migration-case-study.md), [migrating-from-gulp-heft.md](migrating-from-gulp-heft.md).
