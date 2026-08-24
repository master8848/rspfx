# Agent Note: Hooks Diagnostics - Typed HookBus, Structured Logger

Status: implemented

## Context

`packages/plugin-api/src/types.ts:58-88` exposed hook bags as `unknown` and `packages/diagnostics/src/logger.ts:1-57` was a colored console writer without `child`, `trace`, JSON, or field support. Hook execution was inline `for(const p of getPlugins())` loops in `packages/plugin/src/rspack.ts:59`, `vite.ts:298`, `rsbuild.ts:185` ignoring `Result`, with no priority or `onError` policy. CLI `apps/cli/src/cli.ts:25` guard was non-exhaustive and `packages/sppkg-builder/src/sppkg-builder.ts:114` `beforePackage` used array shape not `Map`.

## Decision

Add `packages/plugin-api/src/hook-bus.ts:1` with `HookBus`, `createHookBus`, `composeHooks`, `sortedPlugins` implementing priority sort (default 100, stable), `onError: 'throw'|'continue'` and `AggregateRspfxError` accumulation across `emitBeforeCompile`, `emitBeforePackage`, `emitBeforeGenerate`, `emitAfterGenerate`, `emitBeforeStart`, `emitAfterStart`, `emitAfterStats`. Extend `packages/diagnostics/src/codes.ts:1` with `HOOK_FAILED`, `PACKAGE_VALIDATION`, `AGGREGATE`, `packages/diagnostics/src/error.ts:1` with `AggregateRspfxError`, `isAggregateRspfxError`, `flatCauseChain`, `packages/diagnostics/src/format.ts:1` with `formatError` miette-style, `packages/diagnostics/src/logger.ts:1` with `trace` level, `LogFields`, `LogEntry`, `LoggerOptions`, `child`, `isLevelEnabled`, `withLevel`, JSON sink on `RSPFX_LOG_JSON=1`, `packages/diagnostics/src/trace.ts:1` with `createTracer`. Rewrite `packages/plugin-api/src/types.ts:58` to typed `BeforeCompile`, `BeforePackage` (`ReadonlyMap<ZipPath,Uint8Array>`), `HookPhase` (8 values), `HookResult`, `OnHookError`, `priority` and `packages/plugin-api/src/instance.ts:1` to expose `hooks: HookBus` via `createRSPFX({plugins, logger, onError})`. Wire `HookBus` into `packages/plugin/src/rspack.ts:129`, `vite.ts:298`, `rsbuild.ts:185`, `packages/dev-runtime/src/release.ts:39`, `packages/sppkg-builder/src/sppkg-builder.ts:114`, `packages/dev-runtime/src/serve.ts:146`, `apps/cli/src/cli.ts:21`, `apps/cli/src/config.ts:35`.

## Consequences

`HookBus` is the single hook execution order (priority, not `Map` insertion) and error accumulation point; `Logger` is structured with `RSPFX_LOG_LEVEL=trace` and `RSPFX_LOG_JSON=1` documented at `docs/commands.md#environment-variables`. CLI guard is exhaustive (`default: never`) and renders `AggregateRspfxError` via `diagnostics/format.ts:1`. `docs/internal-api.md` and `docs/architecture.md` now list the new surfaces. Tests `packages/plugin-api/tests/hook-bus.test.ts:1` and `packages/diagnostics/tests/logger.test.ts:1` prove isolation with `sinks` and priority/`onError` behavior; `pnpm build` and `pnpm test` pass.
