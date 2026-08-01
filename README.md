# RSPFX

**An SPFx-compatible build toolchain powered by Rspack. Replaces Heft + webpack + gulp.**

RSPFX is a complete, from-scratch replacement for the official SharePoint Framework
toolchain. It builds SPFx client-side web parts that load in the SharePoint workbench
and install as `.sppkg` packages through the app catalog — without ever touching
webpack, Heft, or gulp.

## Principles

- **Never webpack / Heft / gulp.** Those strings never appear in the runtime, the
  build output, or `node_modules` of generated projects. Only `@microsoft/sp-*`
  runtime dependencies are allowed in generated projects, exactly as official SPFx.
- **Rspack is the only bundler.** The compiler layer is a thin, owned config factory
  around Rspack; nothing else produces bundles.
- **Framework-agnostic core.** `@mbsks/rspfx-core` has zero dependencies — no framework, no
  bundler, no Node APIs. Frameworks plug in via the `FrameworkPreset` contract.
- **Workbench-first development.** The SharePoint workbench is the primary dev
  surface, exactly like official `gulp serve`: an HTTPS manifest server on
  `:4321`, debug manifests, auto-opened browser.

## Quick start

From this repository:

```sh
pnpm install
pnpm build        # build all @mbsks/rspfx-* packages
pnpm test         # run the vitest suite
```

Use the CLI in your own projects (installed globally from npm once published):

```sh
npm i -g @mbsks/rspfx-cli
rspfx new my-app
cd my-app
rspfx dev         # dev server + workbench
rspfx package     # production build → .sppkg
```

## Commands

| Command | What it does |
|---|---|
| `rspfx new <name>` | Scaffold a new SPFx project (interactive prompts; flags for non-interactive) |
| `rspfx dev` | Start the dev environment: Rspack dev server + `:4321` HTTPS manifest server, auto-open workbench |
| `rspfx dev --refresh` | Dev mode with state-preserving fast refresh where the framework supports it |
| `rspfx playground` | Standalone localhost sandbox — no SharePoint needed |
| `rspfx build` | Production compile to `dist/` + `release/` (manifests + assets) |
| `rspfx package` | Build + assemble `sharepoint/solution/<name>.sppkg` |
| `rspfx deploy` | Package + upload to the app catalog (REST creds via `config.deploy` or env vars; prints manual steps if none) |
| `rspfx doctor` | Environment/config/port/dependency checks; exit code 1 on failures |
| `rspfx analyze` | Build + bundle size report to `.rspfx/analyze.html` |
| `rspfx clean` | Remove `dist`, `release`, `temp`, `.rspfx`, `node_modules/.cache` |

## Supported targets

- **Frameworks:** vanilla, React, Solid, Preact, Vue, Svelte (Angular deferred)
- **SPFx targets:** 1.20, 1.21, 1.22
- **Node:** 20+; **pnpm** recommended (pnpm/npm/yarn all supported)

## Project structure

```
apps/cli                  the rspfx binary (composition root)
apps/playground           standalone playground host
packages/core             SPFx types, base web part, config — zero dependencies
packages/plugin-api       FrameworkAdapter / FrameworkPreset / plugin hooks
packages/diagnostics      logger, errors, telemetry, benchmarks
packages/compiler-rspack  Rspack config factory, TS via swc, SCSS, assets
packages/manifest-generator  component manifests, manifests.js, sp-* deps
packages/sppkg-builder    .sppkg ZIP assembly (AppManifest, features, assets)
packages/manifest-server  :4321 HTTPS server, certs, node_modules proxy
packages/dev-runtime      serve emulation, websocket refresh, fast-refresh runtime
packages/framework-*      per-framework adapters (vanilla, react, solid, preact, vue, svelte)
packages/fluent-adapter   optional Fluent UI web part base (React-only)
packages/sharepoint-runtime  shims/bridges for sp-* packages
packages/templates        project scaffolding templates
reference/                captured SPFx format ground truth (FORMATS.md, component IDs)
docs/                     user + architecture documentation
```

## Status & roadmap

M0 (reference capture) and M1 (foundation + packaging core) are complete; later
phases are in progress. See [docs/roadmap.md](docs/roadmap.md).

## License

MIT — see [LICENSE](LICENSE).
