# RSPFX

**An SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Works with Vite, Rsbuild, and Rspack.**

RSPFX is a drop-in replacement for the official SPFx toolchain. It builds web parts that load in the SharePoint workbench and install as `.sppkg` — without webpack, Heft, or gulp.

## Principles

- **Never webpack / Heft / gulp.** Those strings never appear in build output or generated projects. `@microsoft/sp-*` is externalized — you only install it if your code imports it.
- **Pick your bundler.** Vite is default. Rsbuild and Rspack also work. No bundler config needed for standard layouts — `config/config.json` and your manifests are enough.
- **Framework-agnostic core.** `@mbsks/rspfx-core` has zero dependencies. Frameworks plug in via `FrameworkPreset`.
- **Workbench-first.** Same as `gulp serve`: dev server on `:4321`, debug manifests, browser opens only with `--browser`.

## Quick start

From this repository:

```sh
bun install
bun run build        # build all @mbsks/rspfx-* packages
bun run test         # run the vitest suite
```

Use the CLI in your own projects (installed globally from npm):

```sh
npm i -g @mbsks/rspfx-cli
rspfx new my-app
cd my-app
rspfx dev         # dev server + workbench
rspfx package     # production build → .sppkg
```

Existing SPFx project (Heft/Gulp) — no manual config needed:

```sh
npm i -g @mbsks/rspfx-cli
cd my-existing-spfx-app
rspfx migrate --dry-run   # preview changes
rspfx migrate             # apply: backs up to .rspfx/migrate-backup.json
bun install
rspfx dev                 # same manifests work for both toolchains
bun run build             # or rspfx build — bundler config is optional, Vite/Rspack is used internally
```

> **Tip:** You do not need to manually install `@microsoft/sp-*` for most web parts. The toolchain externalizes them and emits `"type": "component"` manifest entries so SharePoint resolves its built-in copies. Install them only if your code imports a specific `sp-*` runtime (e.g. `@microsoft/sp-http`).

### Query SharePoint lists — prefer PnPjs

Use `@pnp/sp` over raw `fetch`/`SPHttpClient` for list queries — it handles `select`/`expand`/`filter`/batching and SharePoint REST details for you.

```sh
bun add @pnp/sp @pnp/graph
```

```ts
import { spfi } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import { SPFx } from "@pnp/sp/behaviors/spfx";

const sp = spfi().using(SPFx(this.context));
const items = await sp.web.lists.getByTitle("Orders").items.select("Title", "Status").filter(`Status eq 'Active'`)();
```

`SPHttpClient` from `@microsoft/sp-http` remains available as a fallback for direct REST calls — install it only if you need it.

## Commands

| Command | What it does |
|---|---|
| `rspfx new <name>` | Scaffold a new project — web part, extension, or library |
| `rspfx migrate` | Migrate an existing Heft/Gulp project — see [docs/migrating-from-gulp-heft.md](docs/migrating-from-gulp-heft.md) (`--dry-run`, `--bundler`, `--revert`) |
| `rspfx dev` | Start the dev server — local preview at `http://localhost:4321`, or HTTPS workbench when a tenant is set. Works on official SPFx projects too ([hybrid mode](docs/hybrid-dev.md)) |
| `rspfx dev --refresh` | Same, with state-preserving fast refresh |
| `rspfx build` | Production compile to `dist/` + `release/` (manifests + assets) |
| `rspfx package` | Build + assemble `sharepoint/solution/<name>.sppkg` |
| `rspfx deploy` | Package + upload to the app catalog (REST creds via `config.deploy` or env vars; prints manual steps if none) |
| `rspfx doctor` | Environment/config/port/dependency checks; exit code 1 on failures |
| `rspfx analyze` | Build + bundle size report to `.rspfx/analyze.html` |
| `rspfx clean` | Remove `dist`, `release`, `temp`, `.rspfx`, `node_modules/.cache`, `sharepoint/solution` |

## Same manifest for Heft/Gulp and RSPFX

`config/config.json`, `config/package-solution.json`, and `src/*/*.manifest.json` work unchanged for both toolchains — no fork.

Keep both toolchains side-by-side: leave `gulpfile.js` and `config/rig.json` alongside `vite.config.ts` (default) and share the same `config/` and `src/` manifests.

Use dual npm scripts in `package.json` to switch: `"build": "rspfx build"` vs `"build:heft": "heft build --clean"`, `"dev": "rspfx dev"` vs `"dev:heft": "gulp serve"`.

No migration required for dev: `rspfx dev` synthesizes config from the manifests and runs zero-config on an official project (see [docs/hybrid-dev.md](docs/hybrid-dev.md)).

To fully migrate, run `rspfx migrate` (backs up to `.rspfx/migrate-backup.json`); revert with `rspfx migrate --revert` or `git restore . && git clean -fd .rspfx && bun install`, then delete the generated `vite.config.ts`/`rspack.config.ts` — Heft returns as before. See [docs/migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx](docs/migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx).

## Supported targets

| Framework | Heft/Gulp (Microsoft) | RSPFX |
|---|---|---|
| React, vanilla | ✅ | ✅ |
| Vue, Svelte, Solid, Preact | — | ✅ RSPFX-only |
| Angular | ✅ Heft-only (deferred in RSPFX) | — |

Frameworks plug in via `FrameworkPreset` in `@mbsks/rspfx-core`; see [docs/frameworks.md](docs/frameworks.md).

- **SPFx targets:** see [docs/compatibility.md#spfx-version-matrix](docs/compatibility.md#spfx-version-matrix) and `packages/core/src/versions.ts:13`
- **Node:** 20+; **Bun** recommended for repo development (consumers can use npm/yarn/pnpm/bun)

> **Tip:** If you need Vue/Svelte/Solid/Preact, use RSPFX — Microsoft's toolchain supports only React/vanilla (and Angular via Heft). For React/vanilla either toolchain works; keep the same manifests and switch via scripts (see [Same manifest for Heft/Gulp and RSPFX](#same-manifest-for-heftgulp-and-rspfx)).

## Project structure

See [docs/architecture.md#package-map](docs/architecture.md#package-map) for the full package map.

Full plan lives in [ARCHITECTURE.md](ARCHITECTURE.md).

`examples/modern-search` is a real production solution — PnP Modern Search (4 web parts, ~178 files, Fluent UI 8, MGT, PnPjs) — migrated from Heft + webpack + gulp to RSPFX with zero web part code changes. See its README and [docs/migration-case-study.md](docs/migration-case-study.md).

## Documentation

The repo ships an installable agent skill for building SPFx with RSPFX (covers both the modern RSPFX toolchain and the official Microsoft Heft toolchain). Install it in any agent project:

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
| Hybrid dev on official projects (gulp/Heft) | [docs/hybrid-dev.md](docs/hybrid-dev.md) |
| Project structure & file paths | [docs/project-structure.md](docs/project-structure.md) |
| Deployment guide (catalog, Teams/Outlook, CDN) | [docs/deployment.md](docs/deployment.md) |
| Build, package, deploy, CI | [docs/building-packages.md](docs/building-packages.md) |
| Move an existing project off gulp/Heft | [docs/migrating-from-gulp-heft.md](docs/migrating-from-gulp-heft.md) |
| Migration overview | [docs/migration-from-spfx.md](docs/migration-from-spfx.md) |
| Real-world case study (PnP Modern Search) | [docs/migration-case-study.md](docs/migration-case-study.md) |
| Why you should NOT migrate (yet) | [docs/why-not-to-migrate.md](docs/why-not-to-migrate.md) |
| Framework support | [docs/frameworks.md](docs/frameworks.md) |
| Multi-webpart & extensions | [docs/multi-webpart.md](docs/multi-webpart.md) |
| Teams & Outlook install | [docs/teams-outlook-install.md](docs/teams-outlook-install.md) |
| Fast refresh | [docs/fast-refresh.md](docs/fast-refresh.md) |
| Compatibility guarantees | [docs/compatibility.md](docs/compatibility.md) |
| Architecture | [ARCHITECTURE.md](ARCHITECTURE.md), [docs/architecture.md](docs/architecture.md), [docs/internal-api.md](docs/internal-api.md) |
| Roadmap | [docs/roadmap.md](docs/roadmap.md) |
| Contributing & changelog | [CONTRIBUTING.md](CONTRIBUTING.md) (publishing, tags, changelog rule), [CHANGELOG.md](CHANGELOG.md) |

## Status & roadmap

M0 (reference capture) and M1 (foundation + packaging core) are complete; later phases are in progress. See [docs/roadmap.md](docs/roadmap.md).

## License

MIT — see [LICENSE](LICENSE).
