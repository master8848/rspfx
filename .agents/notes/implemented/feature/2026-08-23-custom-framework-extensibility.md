# Agent Note: Custom framework extensibility via plugin registry

Status: implemented

## Context

Builtin `FrameworkId` (`packages/core/src/config.ts:4`) enumerated six ids and `FrameworkPreset<F extends FrameworkId>` rejected external names, so adding a framework required CLI and `packages/framework-*` changes; enterprises maintaining internal UI stacks needed a project-local extension point without forking the toolchain, and the existing plugin registry (`packages/plugin-api/src/registry.ts:5` `registerPlugin`/`getPlugins`) already provided a synchronous in-memory hook executed via `jiti` in `apps/cli/src/config.ts:69`.

## Decision

Open `FrameworkId` to `| (string & {})` in `packages/core/src/config.ts:4` and `packages/plugin-api/src/types.ts:29` to `FrameworkPreset<F extends string = FrameworkId>` with `name: F`; update `loadFrameworkPreset` (`packages/dev-runtime/src/project.ts:737`) to check `getPlugins().find(p => p.frameworkPreset?.name === framework)` before `importFramework` and return the registry preset with `moduleUrl: ''`, keeping `createRequire` package resolution and `resolveContributionLoaders` (`packages/dev-runtime/src/project.ts:759`) for builtin packages; document the contract as reference in `docs/custom-framework.md` and sync signatures in `docs/frameworks.md:57` and `docs/internal-api.md:22`; fact homes remain `docs/internal-api.md` and `docs/frameworks.md`.

## Consequences

Projects register a preset in `rspack.config.ts`/`vite.config.ts`/`rsbuild.config.ts` via `definePlugin`/`registerPlugin` (`@mbsks/rspfx-plugin-api`) with `framework: 'my-framework' as const` and `RspfxPlugin`/`rspfxVite`/`rspfxRsbuild` (`@mbsks/rspfx-plugin`) consume `contributions`/`vite`/`rsbuild` with `fastRefresh` from `dev.fastRefresh`/`RSPFX_FAST_REFRESH=1`/`--refresh`; `rspfx doctor` and `rspfx new` list only builtin ids and `resolveContributionLoaders` rewrites only `rules[].use` and Babel strings, so templates remain builtin-only and missing-package warnings still emit when the registry provides the preset but builds succeed.

