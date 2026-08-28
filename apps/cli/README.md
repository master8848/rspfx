# @mbsks/rspfx-cli

**rspfx** — an SPFx-compatible build toolchain powered by modern tooling. Replaces Heft + webpack + gulp. Works with Vite, Rsbuild, and Rspack.

Create, develop, build, and deploy SharePoint Framework client-side web parts without ever touching webpack, Heft, or gulp. Only `@microsoft/sp-*` runtime dependencies are used, exactly as official SPFx.

## Install

```sh
npm i -g @mbsks/rspfx-cli
```

## Quick start

```sh
rspfx new my-app
cd my-app
rspfx dev        # dev server + SharePoint workbench (browser opens only with --browser)
rspfx package    # production build → sharepoint/solution/my-app.sppkg
rspfx deploy     # upload to the app catalog (REST creds required)
```

## Commands

| Command | What it does |
|---|---|
| `rspfx new <name>` | Scaffold a new SPFx project (interactive prompts; flags for non-interactive) |
| `rspfx dev` | Start the dev environment: bundler dev server (Vite / Rsbuild / Rspack) + `:4321` manifest server (HTTPS in sharepoint mode, HTTP in local preview); browser opens only with `--browser` |
| `rspfx dev --refresh` | Dev mode with state-preserving fast refresh where the framework supports it |
| `rspfx build` | Production compile to `dist/` + `release/` (manifests + assets) |
| `rspfx package` | Build + assemble `sharepoint/solution/<name>.sppkg` |
| `rspfx deploy` | Package + upload to the app catalog (creds via `config.deploy` or env vars; prints manual steps if none) |
| `rspfx doctor` | Environment/config/port/dependency checks; exit code 1 on failures |
| `rspfx analyze` | Build + bundle size report to `.rspfx/analyze.html` |
| `rspfx clean` | Remove `dist`, `release`, `temp`, `.rspfx`, `node_modules/.cache`, `sharepoint/solution` |

## Supported targets

- **Frameworks:** vanilla, React, Solid, Preact, Vue, Svelte, plus any other framework via one-file `FrameworkPreset` (`docs/custom-framework.md`)
- **SPFx targets:** 1.20, 1.21, 1.22, 1.23
- **Node:** 20+; **pnpm** recommended (pnpm/npm/yarn all supported)

## Ecosystem

| Package | Purpose |
|---|---|
| `@mbsks/rspfx-cli` | This package — the `rspfx` binary |
| `@mbsks/rspfx-core` | Zero-dependency core: types, base web part, config |
| `@mbsks/rspfx-plugin-api` | Framework preset / plugin hooks |
| `@mbsks/rspfx-plugin` | Bundler plugins (Rspack / Vite / Rsbuild) |
| `@mbsks/rspfx-diagnostics` | Logger, errors, benchmarks |
| `@mbsks/rspfx-compiler-rspack` | Rspack compiler layer |
| `@mbsks/rspfx-manifest-generator` | SPFx component manifests |
| `@mbsks/rspfx-sppkg-builder` | `.sppkg` package assembly |
| `@mbsks/rspfx-manifest-server` | Workbench HTTPS manifest server |
| `@mbsks/rspfx-dev-runtime` | Dev serve / refresh runtime |
| `@mbsks/rspfx-framework-*` | Per-framework presets + web part classes |
| `@mbsks/rspfx-fluent-adapter` | Fluent UI web part base (React) |
| `@mbsks/rspfx-sharepoint-runtime` | `@microsoft/sp-*` bridges for local preview |
| `@mbsks/rspfx-templates` | Project scaffolding |

## Documentation

- [Getting started](https://github.com/master8848/rspfx/blob/main/docs/getting-started.md)
- [Commands](https://github.com/master8848/rspfx/blob/main/docs/commands.md)
- [Architecture](https://github.com/master8848/rspfx/blob/main/docs/architecture.md)
- [Migration from official SPFx](https://github.com/master8848/rspfx/blob/main/docs/migration-from-spfx.md)

## License

MIT
