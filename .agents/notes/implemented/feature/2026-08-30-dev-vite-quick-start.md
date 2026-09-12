# Agent Note: rspfx dev:vite quick start

Status: implemented

## Context

Trying RSPFx dev required manually writing `vite.config.ts` with `rspfxVite`/`rspfxViteDev`, picking `spfxVersion`/`framework`, and connecting `tsconfig.json`. Older yo projects (`1.11` with `rush-stack-compiler-4.1` `includes/base.json` missing, `node@14.20.0`) hit `builtin:vite-transform Tsconfig not found`, `ESM syntax in a file loaded as CommonJS (vite.config.ts:1:1)`, and Node 14 incompatibility. There was no one-command path to try dev mode quickly in any existing SPFx project.

## Decision

Add `apps/cli/src/commands/dev-vite.ts:1` `runDevVite` behind `rspfx dev:vite` (`vite:dev` alias) in `apps/cli/src/cli.ts:209`. It checks Node `>=20` (Vite 8 `>=20.19`), detects `spfxVersion` from `package.json.@microsoft/sp-core-library` (`packages/core/src/versions.ts:13`, legacy `1.11`–`1.19` registered via `registerSpfxVersion` for dev-only), detects `framework` from `dependencies`, finds `tsconfig.json` / `tsconfig.build.json` / `tsconfig.app.json` / `tsconfig*.json` with `build.tsconfigPath` alias (`packages/core/src/config.ts:32` `BuildConfig.tsconfigPath`, `RspfxConfig.tsconfigPath`), sets `package.json type: module` + `devDependencies.@mbsks/rspfx-plugin-dev` + `vite` + script `dev:vite`, and generates `vite.config.ts` with `rspfxViteDev` from `@mbsks/rspfx-plugin-dev/vite` when no bundler config exists (`apps/cli/src/config.ts:25` `CONFIG_CANDIDATES` now includes `vite.config.mts/.mjs/.cjs`). Handle `--dry-run`/`--force`/`--tsconfig`/`--port`/`--mode`/`--tenant`/`--refresh`/`--browser`. Lean plugin `packages/plugin-dev/src/vite.ts:36` `resolveTsconfigRaw(root, explicit)` and `packages/plugin/src/vite.ts:138` `resolveTsconfigRawForVite(root, explicit)` now accept explicit path, stub missing `rush-stack-compiler-*/includes/base.json`, and return `esbuild.tsconfigRaw` fallback; `config()` merges it and forces `server.https` only in `sharepoint` mode. `apps/cli/src/bundler-bin.ts:88` injects `VITE_CONFIG_NATIVE_IGNORE_WARNING=true`. Add `packages/dev-runtime/src/tsconfig.ts:1` helpers exported from `packages/dev-runtime/src/index.ts:22`. Document as quickest path in `docs/guide/dev-vite.md:1`, update `docs/guide/try-mode.md:1`, `docs/guide/dev-plugin.md:1`, `docs/getting-started.md:1`, and `docs/commands.md` + `docs/reference/commands.md` with `## rspfx dev:vite`.

## Consequences

`npx @mbsks/rspfx-cli dev:vite --dry-run` previews and `npx @mbsks/rspfx-cli dev:vite` scaffolds + starts Vite on `:4321` in any SPFx project without migration; `tsconfig.json` (yo default) needs no config, custom `tsconfig*.json` is linked via `build.tsconfigPath`; legacy `1.11` works dev-only on Node 20+. `gulp serve`/`heft build` remain for production until `rspfx migrate`. Docs make `dev:vite` the advertised easiest try (`docs/guide/index.md:1`). Fact home for flags remains `docs/commands.md` per `docs/AGENTS.md`.
