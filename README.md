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
packages/plugin           the RspfxPlugin / rspfxVite bundler plugins carrying the project config
packages/plugin-api       FrameworkPreset / extension hooks
packages/diagnostics      logger, errors, telemetry, benchmarks
packages/compiler-rspack  Rspack config factory, TS via swc, SCSS, assets
packages/manifest-generator  component manifests, manifests.js, sp-* deps
packages/sppkg-builder    .sppkg ZIP assembly (AppManifest, features, assets)
packages/manifest-server  dev certificates in ~/.rspfx/certs (serving is handled by the compiler dev server)
packages/dev-runtime      serve emulation, websocket refresh, fast-refresh runtime
packages/framework-*      per-framework presets + web part classes (vanilla, react, solid, preact, vue, svelte)
packages/fluent-adapter   optional Fluent UI web part base (React-only)
packages/sharepoint-runtime  shims/bridges for sp-* packages
packages/templates        project scaffolding templates
examples/                 smoke apps (react, solid, vue, svelte, preact, shadcn, vanilla, modern-search)
reference/                captured SPFx format ground truth (FORMATS.md, component IDs)
docs/                     user + architecture documentation
```

- **Custom folder layouts** — `paths` in the bundler config plugin options
  (`srcDir`, `webpartsDir`, `configDir`) relocates the default `src/` +
  `src/webparts/` + `config/` layout.
- **Project config is a bundler plugin** — the `RspfxPlugin` in
  `rspack.config.ts` (or `rspfxVite` in `vite.config.ts`) from
  `@mbsks/rspfx-plugin` carries the project config (name, framework, dev,
  build, …); the CLI finds it by its marker symbol and uses its options.

`examples/modern-search` is a real production solution — PnP Modern Search
(4 web parts, ~178 files, Fluent UI 8, MGT, PnPjs) — migrated from Heft +
webpack + gulp to RSPFX with zero web part code changes. See its README and
[docs/migration-case-study.md](docs/migration-case-study.md).

## Documentation

The repo ships an installable agent skill for building SPFx with RSPFX (covers
both the modern RSPFX toolchain and the official Microsoft Heft toolchain).
Install it in any agent project:

```sh
npx skills add master8848/rspfx
```

It lives at [`skills/rspfx/SKILL.md`](skills/rspfx/SKILL.md).

[![skills.sh](https://skills.sh/b/master8848/rspfx)](https://skills.sh/master8848/rspfx)

| Topic | Doc |
|---|---|
| Why RSPFX (vs the official toolchain) | [docs/why-rspfx.md](docs/why-rspfx.md) |
| Quick start (new projects) | [docs/getting-started.md](docs/getting-started.md) |
| Command reference | [docs/commands.md](docs/commands.md) |
| Build, package, deploy, CI | [docs/building-packages.md](docs/building-packages.md) |
| Move an existing project off gulp/Heft | [docs/migrating-from-gulp-heft.md](docs/migrating-from-gulp-heft.md) |
| Migration overview | [docs/migration-from-spfx.md](docs/migration-from-spfx.md) |
| Real-world case study (PnP Modern Search) | [docs/migration-case-study.md](docs/migration-case-study.md) |
| Why you should NOT migrate (yet) | [docs/why-not-to-migrate.md](docs/why-not-to-migrate.md) |
| Framework support | [docs/frameworks.md](docs/frameworks.md) |
| Fast refresh | [docs/fast-refresh.md](docs/fast-refresh.md) |
| Compatibility guarantees | [docs/compatibility.md](docs/compatibility.md) |
| Architecture | [ARCHITECTURE.md](ARCHITECTURE.md), [docs/architecture.md](docs/architecture.md), [docs/internal-api.md](docs/internal-api.md) |
| Roadmap | [docs/roadmap.md](docs/roadmap.md) |

## Status & roadmap

M0 (reference capture) and M1 (foundation + packaging core) are complete; later
phases are in progress. See [docs/roadmap.md](docs/roadmap.md).

## License

MIT — see [LICENSE](LICENSE).
