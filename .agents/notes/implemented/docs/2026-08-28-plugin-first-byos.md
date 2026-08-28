# Agent Note: Plugin-first BYOS with Vite default

Status: implemented

## Context

Scaffolding via `rspfx new` required maintaining `packages/templates/src/index.ts:62` `FRAMEWORK_RUNTIME_DEPS` (`vue@^3.5.13`, `svelte@^4.2.19` etc.), `packages/templates/src/index.ts:185` `bundlerDevDeps` (`vite@^8.0.0`), `packages/core/src/versions.ts:14` `SPFX_VERSIONS` docs, and `TOOLCHAIN_VERSION` pins; Vite already ships `create-vite` starters and `better-t-stack`/`TanStack Router` cover full-stack scaffolding, while `packages/plugin/src/vite.ts:18` `rspfxVite()`, `packages/plugin/src/rsbuild.ts` `rspfxRsbuild()`, `packages/plugin/src/rspack.ts` `RSpfxPlugin` already support all three bundlers and any router as plain deps.

## Decision

Keep `packages/templates` and `apps/cli/src/commands/new.ts:133` unchanged (no code change) but reframe docs and agent prompt to plugin-first BYOS: update `README.md:10` Quick start to `npm create vite@latest my-app -- --template react-ts` + `npm i -D @mbsks/rspfx-plugin @mbsks/rspfx-cli` + `rspfxVite()` with `rspfx new` as shortcut and update `README.md:44` agent prompt to default Vite scaffold with any starter (`better-t-stack`, TanStack Router, `create-rsbuild`); rewrite `docs/getting-started.md:16` section 2 to recommended `create-vite` + plugin (`vite.config.ts` `rspfxVite({ name, framework, spfxVersion })`) plus other starters (`rspfxRsbuild`/`RSpfxPlugin`) and keep `rspfx new` as convenience wrapper; update `skills/rspfx/SKILL.md:24` new project and `skills/rspfx/SKILL.md:78` configuration to Vite-default BYOS; update `docs/commands.md:10` `rspfx new` and `docs/commands.md:137` bundler plugin to note BYOS and `packages/plugin/src/vite.ts`/`rsbuild.ts`/`rspack.ts` need no extra codebase changes; update `docs-web/index.md:60` start snippet to plugin flow; update `docs/project-structure.md:29`, `docs/why-rspfx.md:80`, `docs/frameworks.md:7`, `docs/architecture.md:102` to route through BYOS.

## Consequences

Docs now sell RSPFX as a Vite/Rsbuild/Rspack plugin (`@mbsks/rspfx-plugin` `rspfxVite`/`rspfxRsbuild`/`RSpfxPlugin`) — users scaffold with `npm create vite@latest`, `better-t-stack`, TanStack Router, etc. and add SPFx manifests (`src/webparts/*/*.manifest.json`, `config/package-solution.json` per `docs/project-structure.md`) with Vite as default; `rspfx new` remains as shortcut but no longer reads as the primary path; no codebase change required because `packages/plugin` already covers Vite/Rsbuild/Rspack and routers are just deps inside the Vite project (hard-linked `docs/` ↔ `docs-web/docs/` keeps VitePress in sync).
