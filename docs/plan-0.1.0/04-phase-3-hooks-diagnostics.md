# Phase 3 — Hooks & Diagnostics

## 3.1 Detailed Goal & Rationale

**Goal:** Turn the ad-hoc `unknown`-typed hook bags (`CompilerHooks.beforeCompile?: (config:unknown)=>unknown`, `PackageHooks.beforePackage?: (ctx:{manifests:unknown[], files:{path,content}[]})=>void` at `/Volumes/New Volume/code/spfx/packages/plugin-api/src/types.ts:58-88`) into a **typed, composable, observable HookBus** and upgrade `diagnostics` from a colored `console.write` logger (`/Volumes/New Volume/code/spfx/packages/diagnostics/src/logger.ts:42`) into structured, level-aware, sampled telemetry with per-phase error attribution. After Phase 3, every `beforeCompile`/`afterStats`/`beforeGenerate`/`afterGenerate`/`beforeStart`/`afterStart`/`beforePackage` hook is `HookResult<T>` (`Result<T,RspfxError>`) with exhaustive `RspfxErrorCode`, log output is structured JSON when `RSPFX_LOG_JSON=1`, and `apps/cli/src/cli.ts:25` `guard` formats via `diagnostics/format.ts:1` miette-style.

**Current pain (why Hooks must precede Dev Store/Bundler Kernel):**

* `packages/plugin-api/src/types.ts:58-88` exposes 7 hook points but all params/results are `unknown` or unbranded (`config:unknown` returns `unknown`, `webParts:unknown`, `manifests:unknown[]`, `files:{path:string,content:Uint8Array}[]`). Phase 1 will brand them as `Result`/`Map` but Phase 3 must make them **composable** (`composeHooks(...fns) => (ctx)=> HookResult<Ctx>`) and **observable** (`HookBus.emit('beforeCompile', ctx) => Promise<HookResult<Ctx>>`). Today `packages/plugin/src/rspack.ts:59` `apply` just loops `for(const p of getPlugins()){ p.compilerHooks?.beforeCompile?.(config) }` ignoring return value; `packages/plugin/src/vite.ts:298` and `rsbuild.ts:185` duplicate the loop with different `any` casts. Hook execution order is import order (global `Map` insertion order), not explicit priority; no `onError: 'throw'|'continue'` per Phase 1 `instance.ts:281` plan.
* `packages/diagnostics/src/logger.ts:1-57` is 57 LOC: `type LogLevel = 'error'|'warn'|'info'|'debug'|'success'` at `:1`, `createLogger(name:string):Logger` at `:42` with `process.env.RSPFX_LOG_LEVEL` gated `configuredLevel():number` at `:29-40` mapping `error→0, warn→1, info/success→2, debug→3`, `COLORS:Record<LogLevel,string>` at `:13`, `RANKS` at `:21`. No `child()`, no structured `fields`, no `traceId`, no `sampleRate`, no `json` sink, no `isLevelEnabled`. Every CLI command creates `createLogger('rspfx')` anew; `packages/diagnostics/src/trace.ts:1`, `benchmark.ts:1`, `format.ts:1` already exist but `logger.ts` does not call them. `apps/cli/src/cli.ts:21-41` `guard` does `switch(err.code)` non-exhaustive and `logger.error(err.message)` without `cause` chain.
* `packages/diagnostics/src/codes.ts:1` `RspfxErrorCode` is `string & {__brand}` after Phase 1, but no hook aggregates multiple `RspfxError`s (e.g. `beforePackage` file validation returns array of `Issue`s, not single error). `packages/plugin-api/src/types.ts:77` `beforePackage` `files: Map<string,Uint8Array>` now typed but no `HookPhase` discriminator for `onError`.
* `packages/diagnostics/src/error.ts:1-14` `cause?: unknown` (Phase 1 → `RspfxError|Error`) still single-cause; hooks need multi-error accumulation (`AggregateRspfxError`). No `error.cause` chain rendered in `format.ts`.
* DX: `RSPFX_LOG_LEVEL=debug` floods `resolveContributionLoaders` at `dev-runtime/src/project.ts:813` and `createRspackConfig` cache miss at `compiler-rspack/src/config.ts:92`; `RSPFX_LOG_JSON` does not exist for `--json` CLI. `docs/AGENTS.md:Fact homes` requires `RSPFX_LOG_LEVEL` env var documented in `docs/commands.md#environment-variables`, Currently only `logger.ts:29` reads it, undocumented beyond code.

**After:** `plugin-api/src/hook-bus.ts:1` owns `HookBus` with `register`, `compose`, `emit` returning `HookResult<Ctx>` and `onError` handling. `diagnostics/src/logger.ts:42` exposes `Logger` with `child(fields)`, `withLevel`, `isLevelEnabled`, structured `log(level, msg, fields?)`, JSON sink at `RSPFX_LOG_JSON=1`, and `createDiagnosticFormatter` delegating to `format.ts`. `diagnostics/src/trace.ts` wraps `logger` for span timing; `diagnostics/src/codes.ts` errors compose via `AggregateRspfxError`. CLI `guard` becomes exhaustive and single-home for error rendering.

**Non-goal:** No dev store/machines (Phase 4), no bundler kernel/caching (Phase 5), no `rspack`/`vite`/`rsbuild` adapter change beyond wiring `HookBus` into `kernel.ts` later. No CI changes.

---

## 3.2 All Breaking Changes — Before/After Snippets

### 1. Hook signatures typified + `HookResult` + `Map` shape — `plugin-api/src/types.ts:58-88`

**Before (Phase 0 baseline, `unknown`):**

```ts
// /Volumes/New Volume/code/spfx/packages/plugin-api/src/types.ts:58-88
export interface CompilerHooks { beforeCompile?(config: unknown): unknown; afterStats?(stats: unknown): void; }
export interface ReleaseHooks { beforeGenerate?(ctx:{production:boolean; webParts:unknown}):void; afterGenerate?(ctx:{manifests:unknown[]; releaseDir:string}):void; }
export interface PackageHooks { beforePackage?(ctx:{manifests:unknown[]; files:{path:string,content:Uint8Array}[]}):void; afterPackage?(ctx:{sppkgPath:string}):void; }
export interface RspfxExtension { name:string; frameworkPreset?:FrameworkPreset; compilerHooks?:CompilerHooks; releaseHooks?:ReleaseHooks; devHooks?:DevHooks; packageHooks?:PackageHooks; }
```

**After (Phase 3, typed `HookResult` + `Map` + `readonly`):**

```ts
// /Volumes/New Volume/code/spfx/packages/plugin-api/src/types.ts:58 + new hook-bus.ts:1
import type { Result, RspfxError } from '@mbsks/rspfx-diagnostics';
import type { CompileContext } from '@mbsks/rspfx-dev-runtime'; // or core newtypes
import type { ComponentManifest } from '@mbsks/rspfx-manifest-generator';

export type HookPhase = 'beforeCompile'|'afterCompile'|'beforeGenerate'|'afterGenerate'|'beforeStart'|'afterStart'|'beforePackage'|'afterPackage';
export type HookResult<T> = Result<T, RspfxError | AggregateRspfxError>;
export type BeforeCompile = (ctx: CompileContext) => HookResult<CompileContext> | void | Promise<HookResult<CompileContext>|void>;
export type AfterStats = (stats: import('@rspack/core').Stats | import('vite').RollupStats) => void | Promise<void>;
export type BeforeGenerate = (ctx: { readonly production: boolean; readonly webParts: readonly WebPartEntry[] }) => HookResult<typeof ctx> | void;
export type AfterGenerate = (ctx: { readonly manifests: readonly ComponentManifest[]; readonly releaseDir: string }) => void;
export type BeforePackage = (ctx: { readonly manifests: readonly ComponentManifest[]; readonly files: ReadonlyMap<ZipPath, Uint8Array> }) => HookResult<ReadonlyMap<ZipPath,Uint8Array>> | ReadonlyMap<ZipPath,Uint8Array> | void;
export type AfterPackage = (ctx: { readonly sppkgPath: ZipPath }) => void;
export type OnHookError = (err: RspfxError, phase: HookPhase, pluginName: string) => 'throw' | 'continue';

export interface CompilerHooks { beforeCompile?: BeforeCompile; afterStats?: AfterStats; }
export interface ReleaseHooks { beforeGenerate?: BeforeGenerate; afterGenerate?: AfterGenerate; }
export interface DevHooks { beforeStart?: (ctx:{mode:'local'|'sharepoint'; port?:number})=>HookResult<typeof ctx>|void; afterStart?: (ctx:{url:string})=>void; }
export interface PackageHooks { beforePackage?: BeforePackage; afterPackage?: AfterPackage; }

export interface RspfxExtension {
  readonly name: string;
  readonly frameworkPreset?: FrameworkPreset;
  readonly compilerHooks?: CompilerHooks;
  readonly releaseHooks?: ReleaseHooks;
  readonly devHooks?: DevHooks;
  readonly packageHooks?: PackageHooks;
  readonly onError?: OnHookError;
  readonly priority?: number; // lower runs first; default 100
}

export function definePlugin(p:{ name:string; priority?:number; hooks:{ beforeCompile?:BeforeCompile; beforePackage?:BeforePackage; }; onError?:OnHookError }): RspfxExtension;
export function composeHooks<T>(...hooks: Array<(ctx:T)=>HookResult<T>|void>): (ctx:T)=>HookResult<T>;
```

**Break:** `config:unknown -> CompileContext`, `files:{path,content}[] -> ReadonlyMap<ZipPath,Uint8Array>`, `manifests:unknown[] -> readonly ComponentManifest[]`, return `unknown` → `HookResult<T>|void`. `definePlugin` now validates `priority`/`onError`. Old `registerPlugin({compilerHooks:{beforeCompile:(c:any)=>c}})` still type-checks with `any` but `unknown` without cast is error (by design — Phase 1 exit required `unknown[] →0`).

### 2. Hook execution via `HookBus` — new `plugin-api/src/hook-bus.ts:1` + deprecation of direct loops

**Before:**

```ts
// /Volumes/New Volume/code/spfx/packages/plugin/src/rspack.ts:129 (before)
for(const p of getPlugins()){
  const r = p.compilerHooks?.beforeCompile?.(ctx.config as unknown);
  if(r) ctx.config = r as unknown; // silent any cast, ignores Result
}
// /Volumes/New Volume/code/spfx/packages/plugin/src/vite.ts:298 + rsbuild.ts:185 similar duplicates
```

**After:**

```ts
// /Volumes/New Volume/code/spfx/packages/plugin-api/src/hook-bus.ts:1 (new)
export interface HookBus {
  readonly onError: OnHookError;
  emitBeforeCompile(ctx: CompileContext): Promise<HookResult<CompileContext>>;
  emitBeforePackage(ctx:{manifests:readonly ComponentManifest[]; files:ReadonlyMap<ZipPath,Uint8Array>}): Promise<HookResult<ReadonlyMap<ZipPath,Uint8Array>>>;
  // ... per phase
}
export function createHookBus(plugins: readonly RspfxExtension[], opts?:{ logger?:Logger; onError?:OnHookError }): HookBus {
  const sorted = [...plugins].sort((a,b)=> (a.priority??100)-(b.priority??100));
  return {
    async emitBeforeCompile(ctx){
      let cur = ctx;
      const errors: RspfxError[] = [];
      for(const p of sorted){
        if(!p.compilerHooks?.beforeCompile) continue;
        try {
          const res = await p.compilerHooks.beforeCompile(cur);
          if(res && typeof res==='object' && 'ok' in res){
            if(!res.ok){
              const decision = p.onError?.(res.error as RspfxError, 'beforeCompile', p.name) ?? opts?.onError?.(res.error as RspfxError,'beforeCompile',p.name) ?? 'throw';
              if(decision==='throw') return {ok:false, error: res.error} as HookResult<CompileContext>;
              errors.push(res.error as RspfxError);
              continue;
            }
            cur = (res as {value:CompileContext}).value ?? cur;
          }
        } catch(e){
          const err = e instanceof RspfxError ? e : new RspfxError(RspfxErrorCode.HOOK_FAILED, `beforeCompile:${p.name}`, e as Error);
          const decision = p.onError?.(err,'beforeCompile',p.name) ?? 'throw';
          if(decision==='throw') return {ok:false, error:err};
          errors.push(err);
        }
      }
      return errors.length ? {ok:false, error: new AggregateRspfxError(errors)} as any : {ok:true, value:cur};
    },
    // emitBeforePackage aggregates Map mutations
  };
}

// adapters:
const bus = createHookBus(rspfx.plugins, { logger });
const result = await bus.emitBeforeCompile(ctx);
if(!result.ok) throw result.error;
ctx = result.value;
```

**Break:** Hook loops no longer inline `for...` with `as unknown`; must await `HookBus.emit*`. Synchronous `beforeCompile` returning `void` still works (normalized to `ok:true`). Multiple errors now `AggregateRspfxError` not single throw — callers that `catch(e)` as single `RspfxError` should handle `cause` array.

### 3. Logger structural upgrade — `diagnostics/src/logger.ts:1-57`

**Before:**

```ts
// /Volumes/New Volume/code/spfx/packages/diagnostics/src/logger.ts:1-57
export type LogLevel = 'error'|'warn'|'info'|'debug'|'success';
export interface Logger { error(message:string):void; warn(message:string):void; info(message:string):void; debug(message:string):void; success(message:string):void; }
const RANKS:Record<LogLevel,number> = {error:0,warn:1,info:2,success:2,debug:3};
function configuredLevel():number{ switch(process.env.RSPFX_LOG_LEVEL){ case 'error':return 0; case 'warn':return 1; case 'debug':return 3; default:return 2; } }
export function createLogger(name:string): Logger {
  function write(level:LogLevel, stream:NodeJS.WriteStream, message:string){
    if(RANKS[level]>configuredLevel()) return;
    stream.write(`${COLORS[level]}[${name}] ${level}: ${message}${RESET}\n`);
  }
  return { error:(m)=>write('error',process.stderr,m), warn:(m)=>write('warn',process.stderr,m), info:(m)=>write('info',process.stdout,m), debug:(m)=>write('debug',process.stdout,m), success:(m)=>write('success',process.stdout,m) };
}
```

**After:**

```ts
// /Volumes/New Volume/code/spfx/packages/diagnostics/src/logger.ts:1 + codes.ts:1, error.ts:3, format.ts:1, trace.ts:1
export type LogLevel = 'error'|'warn'|'info'|'debug'|'success'|'trace';
export type LogFields = Record<string, string|number|boolean|undefined>;
export interface Logger {
  readonly name: string;
  error(message:string, fields?:LogFields): void;
  warn(message:string, fields?:LogFields): void;
  info(message:string, fields?:LogFields): void;
  debug(message:string, fields?:LogFields): void;
  success(message:string, fields?:LogFields): void;
  trace(message:string, fields?:LogFields): void; // gated trace, maps to debug in color mode
  child(fields: LogFields): Logger;                // e.g. logger.child({ plugin:'my-plugin', phase:'beforeCompile' })
  isLevelEnabled(level:LogLevel): boolean;
  withLevel(level: LogLevel): Logger;             // sampling shim for hook bus
}
export interface LoggerOptions {
  readonly sinks?: Array<(entry: LogEntry)=>void>; // test injection
  readonly json?: boolean;                          // reads RSPFX_LOG_JSON=1
  readonly level?: LogLevel;
}
export interface LogEntry { level:LogLevel; name:string; message:string; fields:LogFields; timestamp:string; error?:RspfxError; }
export function createLogger(name:string, opts?:LoggerOptions): Logger {
  const json = opts?.json ?? process.env.RSPFX_LOG_JSON === '1';
  const levelRank = RANKS[opts?.level ?? (process.env.RSPFX_LOG_LEVEL as LogLevel) ?? 'info'];
  function write(level:LogLevel, message:string, fields?:LogFields){
    if(RANKS[level] > levelRank) return;
    if(json){
      process.stdout.write(JSON.stringify({ level, name, message, fields, timestamp: new Date().toISOString() })+'\n');
    } else {
      const fieldStr = fields && Object.keys(fields).length ? ` ${Object.entries(fields).map(([k,v])=>`${k}=${String(v)}`).join(' ')}` : '';
      const stream = level==='error'||level==='warn' ? process.stderr : process.stdout;
      stream.write(`${COLORS[level]}[${name}] ${level}: ${message}${fieldStr}${RESET}\n`);
    }
  }
  return {
    name,
    error:(m,f)=> write('error', m, f), warn:(m,f)=> write('warn',m,f), info:(m,f)=> write('info',m,f),
    debug:(m,f)=> write('debug',m,f), success:(m,f)=> write('success',m,f), trace:(m,f)=> write(levelRank>=RANKS.trace ? 'trace':'debug', m, f),
    isLevelEnabled:(l)=> RANKS[l] <= levelRank,
    child:(f)=> createLogger(name, { ...opts, sinks: [...(opts?.sinks??[]), (e)=> write(e.level, e.message, {...e.fields, ...f})] }),
    withLevel:(l)=> createLogger(name, {...opts, level:l}),
  };
}
export function createDiagnosticFormatter(logger:Logger): (err:RspfxError|AggregateRspfxError)=>string {
  // delegates to diagnostics/format.ts:1 miette-style with code/cause chain
  return (err)=> formatError(err, { color: !logger.isLevelEnabled('trace') /* json check */ });
}
```

**Break:** `Logger` now has `trace`, `child`, `isLevelEnabled`, `name`, `withLevel`; second param `fields` added (optional, backward compat — old `logger.info('msg')` still compiles). `process.env.RSPFX_LOG_JSON` new; `RSPFX_LOG_LEVEL` now also accepts `trace`. Color code at `logger.ts:42` `write` signature changes from `write(level, stream, message)` to `write(level, message, fields?)` — internal only, not public break.

### 4. Error aggregation — `diagnostics/src/error.ts:3` + `codes.ts:1`

**Before:**

```ts
// /Volumes/New Volume/code/spfx/packages/diagnostics/src/error.ts:3
export class RspfxError extends Error { readonly code:string; constructor(code:string, message:string, cause?:unknown){ super(message); this.code=code; this.cause=cause; } }

// codes.ts string enum
export enum RspfxErrorCode { BUILD_FAILED='BUILD_FAILED', CONFIG_NOT_FOUND='CONFIG_NOT_FOUND', ... }
```

**After:**

```ts
// /Volumes/New Volume/code/spfx/packages/diagnostics/src/codes.ts:1 (branded, from Phase 1, now with HOOK_FAILED, PACKAGE_VALIDATION, AGGREGATE)
export const RspfxErrorCode = {
  HOOK_FAILED: 'HOOK_FAILED',
  PACKAGE_VALIDATION: 'PACKAGE_VALIDATION',
  AGGREGATE: 'AGGREGATE',
  INVALID_MANIFEST_ID: 'INVALID_MANIFEST_ID',
  SPPKG_TRAVERSAL: 'SPPKG_TRAVERSAL',
  // ... 27 total
} as const;

// /Volumes/New Volume/code/spfx/packages/diagnostics/src/error.ts:3
export class RspfxError extends Error {
  readonly code: RspfxErrorCode;
  readonly cause?: RspfxError | Error;
  constructor(code: RspfxErrorCode, message:string, cause?:RspfxError|Error){ super(message); this.name='RspfxError'; this.code=code; if(cause) this.cause=cause; }
}
export class AggregateRspfxError extends Error {
  readonly code = RspfxErrorCode.AGGREGATE as RspfxErrorCode;
  readonly errors: readonly RspfxError[];
  constructor(errors: readonly RspfxError[], message = `${errors.length} hook errors`){
    super(message); this.name='AggregateRspfxError'; this.errors = errors;
  }
}
export function isRspfxError(e:unknown): e is RspfxError { return e instanceof RspfxError || e instanceof AggregateRspfxError || (typeof e==='object' && e!==null && 'code' in e); }
```

**Break:** `code:string -> RspfxErrorCode` (branded) already in Phase 1; Phase 3 adds `AggregateRspfxError` as secondary throw from `HookBus`. `cause:unknown -> RspfxError|Error` narrower; `AggregateRspfxError.errors` new.

---

## 3.3 File-by-File Breakdown (Absolute Paths + Line Numbers)

| # | Absolute Path | Lines | Action | Detail |
|---|---|---|---|---|
| 3.1 | `/Volumes/New Volume/code/spfx/packages/diagnostics/src/logger.ts` | `1-57` | **Rewrite** | Add `LogLevel trace` at `:1`, `LogFields`/`LogEntry`/`LoggerOptions` at `:3-25`, `child`/`isLevelEnabled`/`withLevel`/`trace` at `:42-57`, JSON sink (`RSPFX_LOG_JSON`) branching, field serialization. Keep `COLORS` `:13` + `RANKS` `:21` but add `trace:4`. Keep `configuredLevel():number` `:29` but add `trace→4`, `json` check. Export `LogEntry` for tests. ~95 LOC after. |
| 3.2 | `/Volumes/New Volume/code/spfx/packages/diagnostics/src/codes.ts` | `1-32` | **Extend** | Add `HOOK_FAILED`, `PACKAGE_VALIDATION`, `AGGREGATE` (phase 3), ensure all 27 codes enumerated as `as const` + branded type `& {__brand}`. Add JSDoc per code linking to hook phase. |
| 3.3 | `/Volumes/New Volume/code/spfx/packages/diagnostics/src/error.ts` | `1-14` | **Extend** | Keep `RspfxError` branded `code:RspfxErrorCode` from Phase 1; add `AggregateRspfxError` class, `isRspfxError`, `isAggregateRspfxError`. Add `flatCauseChain(err): RspfxError[]` helper for `format.ts`. |
| 3.4 | `/Volumes/New Volume/code/spfx/packages/diagnostics/src/format.ts` | `1-?` | **Modify** | Add `formatError(err:RspfxError|AggregateRspfxError, opts:{color:boolean}):string` miette-style with `code` prefix, `message`, `cause` chain indented, `errors[]` enumerated for aggregate. Used by `apps/cli/src/cli.ts:25` guard and `logger` json field `error`. |
| 3.5 | `/Volumes/New Volume/code/spfx/packages/diagnostics/src/trace.ts` | `1-?` | **Modify** | Add `createTracer(logger:Logger): { span(name:string, fn:()=>Promise<T>):Promise<T>; time<T>(name:string, fn:()=>T):T }` that logs `trace` entry `enter/exit` with `durationMs` via `benchmark.ts:1`. Used by `HookBus` emit timing. |
| 3.6 | `/Volumes/New Volume/code/spfx/packages/diagnostics/src/index.ts` | `1-7` | **Export** | Add `export { AggregateRspfxError, isAggregateRspfxError }`, `export type { LogFields, LogEntry, LoggerOptions }`, `export { createDiagnosticFormatter }`, `export type { HookPhase }` re-export for convenience. |
| 3.7 | `/Volumes/New Volume/code/spfx/packages/plugin-api/src/types.ts` | `1-89` | **Rewrite** | Replace `FrameworkRspackContributions unknown[]` already typed in Phase 1; now replace hook `unknown` at `58-80` with Phase 3 typed signatures; add `HookPhase`, `HookResult<T>`, `BeforeCompile`/`BeforePackage` etc., `OnHookError`, `priority`, `definePlugin`/`composeHooks`. Keep `FrameworkPresetUnion` manual union or `FrameworkRegistry`. |
| 3.8 | `/Volumes/New Volume/code/spfx/packages/plugin-api/src/hook-bus.ts` | **new** | **Create** | Implements `HookBus`, `createHookBus`, `composeHooks`, priority sorting, `onError` decision, `AggregateRspfxError` accumulation, async composition, timing via `trace.ts`. ~140 LOC. Must be tree-shakable. |
| 3.9 | `/Volumes/New Volume/code/spfx/packages/plugin-api/src/instance.ts` | **new** (Phase 1) → **modify** at `:?` | **Extend** | `RSpfxInstance` now exposes `hooks: HookBus` instead of raw arrays; `createRSPFX({plugins, logger, onError})` forwards logger to `createHookBus`. Add `instance.hookBus: HookBus` getter. |
| 3.10 | `/Volumes/New Volume/code/spfx/packages/plugin-api/src/registry.ts` | `1-15` | **No change** | Keep deprecated `registerPlugin`/`getPlugins` shim with `warnOnce`; add note that bus priority overrides `Map` order. |
| 3.11 | `/Volumes/New Volume/code/spfx/packages/plugin-api/src/index.ts` | `1-10` | **Export** | Add `export { createHookBus, composeHooks } from './hook-bus.js'` and `export type { HookBus, HookPhase, HookResult, OnHookError, BeforeCompile, ... }`. |
| 3.12 | `/Volumes/New Volume/code/spfx/packages/plugin/src/rspack.ts` | `53-193` | **Modify** | Constructor `new RspfxPlugin({rspfx?:RSpfxInstance, logger?:Logger})` at `:53-88`; `apply` at `:129-182` replace inline `for(const p...)` with `const result = await rspfx.hookBus.emitBeforeCompile(ctx)` (or `createHookBus(rspfx.plugins)` if `rspfx` absent fallback to deprecated `getPlugins`). Handle `HookResult` `ok:false => throw`. Log via `logger.child({phase:'beforeCompile'}).debug`. |
| 3.13 | `/Volumes/New Volume/code/spfx/packages/plugin/src/vite.ts` | `298-371` | **Modify** | Same `HookBus` wiring for `beforeCompile`/`afterStats`; keep `decodeIfEncoded` import from Phase 4 `dev-runtime/path.ts:1`; ensure async bus does not break `Promise.all` parallel at `vite.ts:459` (await each emit serially; hooks run serially by priority, entries parallel). |
| 3.14 | `/Volumes/New Volume/code/spfx/packages/plugin/src/rsbuild.ts` | `185-215` | **Modify** | Same. |
| 3.15 | `/Volumes/New Volume/code/spfx/packages/plugin/src/shared.ts` | `1-48` | **Modify** | Keep `amdName`, `collectExternals`, `writeStatsJson` but `writeStatsJson` now logs via `logger.child({phase:'afterStats'}).trace`. |
| 3.16 | `/Volumes/New Volume/code/spfx/packages/manifest-generator/src/manifests-js.ts` | `1-?` | **Modify** | Accept `hookBus?:HookBus` param; before/after generate hooks go through bus (`emitBeforeGenerate`→ `regenerate`→ `emitAfterGenerate`). No longer direct `releaseHooks.beforeGenerate(ctx as unknown)`. |
| 3.17 | `/Volumes/New Volume/code/spfx/packages/manifest-generator/src/component-manifests.ts` | `?` | **Modify** | Same hook wiring if component manifest generation has hooks. |
| 3.18 | `/Volumes/New Volume/code/spfx/packages/sppkg-builder/src/sppkg-builder.ts` | `?` | **Modify** | Replace `packageHooks.beforePackage({manifests:unknown[], files:{path,content}[]})` with `hookBus.emitBeforePackage({manifests: readonly ComponentManifest[], files: ReadonlyMap<ZipPath,Uint8Array>})`; adaptor converts `Map`↔`{path,content}[]` for shim, but new path uses `Map`. `afterPackage` via bus. |
| 3.19 | `/Volumes/New Volume/code/spfx/packages/sppkg-builder/src/zip.ts` | `22` | **No change** | Keep traversal check using Phase 1 `ZipPath` parse; hook receives branded `ZipPath` keys. |
| 3.20 | `/Volumes/New Volume/code/spfx/packages/dev-runtime/src/serve.ts` | `146-375` | **Modify** | Pass `logger.child({service:'dev'})` into `createHookBus`; emit `beforeStart`/`afterStart` via bus at `startServe` `:159` and `:272`. Log `ws`/`reload` via `logger.trace`. |
| 3.21 | `/Volumes/New Volume/code/spfx/apps/cli/src/cli.ts` | `21-41` | **Modify** | Replace `if(err instanceof RspfxError) console.error(err.message)` with `const fmt = createDiagnosticFormatter(logger); logger.error(fmt(err))` exhaustive `switch(err.code)` + `AggregateRspfxError` branch rendering each `errors[i]`. Add `RSPFX_LOG_JSON` handling: `if(process.env.RSPFX_LOG_JSON) logger = createLogger('cli',{json:true})`. |
| 3.22 | `/Volumes/New Volume/code/spfx/apps/cli/src/config.ts` | `35-93` | **Modify** | `LoadedProject` now carries `logger: Logger` and `hookBus: HookBus`; `discoverPlugins` → `createRSPFX({plugins, logger})` at `:35`. Forward `logger` to `new RspfxPlugin({rspfx, logger})`. |
| 3.23 | `/Volumes/New Volume/code/spfx/packages/diagnostics/tests/logger.test.ts` | **new** | **Create** | Tests `isLevelEnabled`, `child` merges fields, `RSPFX_LOG_JSON=1` emits JSON, `success` rank 2 not filtered at default, `debug` filtered unless `RSPFX_LOG_LEVEL=debug`. Use `sinks` injection, no `process.stdout` stub. |
| 3.24 | `/Volumes/New Volume/code/spfx/packages/plugin-api/tests/hook-bus.test.ts` | **new** | **Create** | Tests `composeHooks`, priority order (`priority 10` before `100`), `onError: 'continue'` aggregates vs `'throw'` aborts, `AggregateRspfxError` when 2 hooks error, async hook, `HookResult` propagation. Parallelizable (no `singleFork` needed). |
| 3.25 | `/Volumes/New Volume/code/spfx/docs/commands.md` | `?` → `#environment-variables` | **Docs** | Add `RSPFX_LOG_JSON` (`1` → JSON-lines logs), `RSPFX_LOG_LEVEL` (`error|warn|info|debug|trace`), per `docs/AGENTS.md:Fact homes` — this is the single home for operator env vars. |
| 3.26 | `/Volumes/New Volume/code/spfx/docs/internal-api.md` | `?` | **Docs** | Add `HookBus`, `HookPhase`, `HookResult`, `AggregateRspfxError`, `Logger` (`child`, `isLevelEnabled`, `trace`) surfaces with exact signatures and package ` @mbsks/rspfx-diagnostics` / `@mbsks/rspfx-plugin-api`. |
| 3.27 | `/Volumes/New Volume/code/spfx/docs/architecture.md` | `?` | **Docs** | Update `diagnostics` row to `logger, RspfxError+Aggregate, trace/benchmark, codes`; `plugin-api` row to `FrameworkPreset, HookBus, hooks`. Note `RSpfxInstance.hooks: HookBus`. |

No workflow file change (`./.github/workflows` absent per constraint).

---

## 3.4 Ordered Implementation Steps

1. **Land `diagnostics` error aggregation** (`diagnostics/src/codes.ts:1` add `HOOK_FAILED`/`PACKAGE_VALIDATION`/`AGGREGATE`; `error.ts:3` add `AggregateRspfxError` + `isRspfxError`; `format.ts:1` add `formatError` with aggregate branch): unit test `diagnostics/tests/error.test.ts` (`isRspfxError` true for `RspfxError`, false for `Error`, aggregate flattens). ~0.5d. Run `pnpm typecheck`.
2. **Rewrite `logger.ts:1-57`** (`LogLevel trace`, `LogFields`, `LogEntry`, `LoggerOptions`, `child`/`isLevelEnabled`/`withLevel`, JSON sink, field serialization): add `logger.test.ts` with `sinks` injection testing `RSPFX_LOG_LEVEL=debug` filtering, `RSPFX_LOG_JSON=1` JSON shape, `child` merge. Keep existing `COLORS`/`RANKS` behavior for default `info`. ~1.5d.
3. **Add `trace.ts` span timing** (`diagnostics/src/trace.ts:1` `createTracer`): wrap `logger.trace` with `process.hrtime.bigint` duration; test `trace.test.ts` asserts `durationMs` field present. ~0.5d (parallel with 2).
4. **Rewrite `plugin-api/src/types.ts:58-88` hook signatures** (type `BeforeCompile` etc., `HookPhase`, `HookResult`, `OnHookError`, `priority`, `definePlugin`/`composeHooks`): fix `typecheck` — expect 6 framework index files + `diagnostics` call sites to error until next step; keep deprecated `unknown` overload `@deprecated` for one commit if needed. ~0.5d.
5. **Create `plugin-api/src/hook-bus.ts:1`** (`HookBus`, `createHookBus`, `composeHooks`, priority sort, `Aggregate` accumulation, async, timing): implement `emitBeforeCompile`, `emitBeforePackage`, `emitBeforeGenerate`, `emitAfter*`, `emitBeforeStart/afterStart`. Tests `hook-bus.test.ts` (~40 cases) parallel-safe. ~2d. This is the longest pole.
6. **Extend `plugin-api/src/instance.ts`** (`createRSPFX` to own `HookBus`): `RSpfxInstance` exposes `hookBus: HookBus` and `createCompileContext`; wire `logger` param through. Update `index.ts` exports. Test `instance.test.ts` isolation (two `createRSPFX` instances have independent bus). ~0.5d.
7. **Thread `HookBus` through `plugin/src/rspack.ts:129` + `vite.ts:298` + `rsbuild.ts:185`**: replace inline loops with `await hookBus.emitBeforeCompile(ctx)` handling `HookResult`. Inject `logger.child({phase:'beforeCompile', plugin:p.name})`. Run `pnpm build` (these packages ESM `.js` imports). ~1d.
8. **Wire manifest-generator + sppkg-builder hooks** (`manifests-js.ts:1`, `component-manifests.ts`, `sppkg-builder.ts`): `beforePackage` `Map` conversion shim vs new path; `AggregateRspfxError` surfacing. Add `sppkg-builder/tests/hook.test.ts` that plugin mutates `Map` (adds file) and hook returning `Err` aborts build. ~1d.
9. **Wire `dev-runtime/serve.ts:146` + `apps/cli/src/cli.ts:25` + `config.ts:35`** (`beforeStart`/`afterStart` via bus, exhaustive guard with `formatError`, `RSPFX_LOG_JSON`): test `cli/tests/guard.test.ts` aggregate rendering. ~0.5d.
10. **Docs** (`docs/commands.md#environment-variables` add `RSPFX_LOG_JSON`/`RSPFX_LOG_LEVEL=trace`, `docs/internal-api.md` HookBus/Logger surfaces, `docs/architecture.md` package map): verify relative links exist, no history narration (`previously` banned per `docs/AGENTS.md:Writing rules`). Add Agent Note `.agents/notes/implemented/hooks/2026-08-24-hooks-diagnostics.md` with uniform header `Status: implemented`. ~0.5d.
11. **Local verification gate** (`pnpm build && pnpm typecheck && pnpm test`): prove `singleFork:true` no longer needed for hook tests (parallel forks), `grep -rn "unknown" packages/plugin-api/src/types.ts` 0 in hook params, `pnpm --filter @mbsks/rspfx-plugin-api test` with `singleFork:false` green.

Total **8–9d** single-thread; steps 2↔5 parallelizable (diagnostics vs plugin-api) reduces to ~6d with two engineers.

---

## 3.5 Types / Data Structures to Introduce

```ts
// /Volumes/New Volume/code/spfx/packages/diagnostics/src/logger.ts:1
export type LogLevel = 'error'|'warn'|'info'|'debug'|'success'|'trace';
export type LogFields = Record<string, string|number|boolean|undefined>;
export interface LogEntry {
  readonly level: LogLevel;
  readonly name: string;
  readonly message: string;
  readonly fields: Readonly<LogFields>;
  readonly timestamp: string; // ISO
  readonly error?: RspfxError | AggregateRspfxError;
}
export interface LoggerOptions {
  readonly level?: LogLevel;          // overrides RSPFX_LOG_LEVEL
  readonly json?: boolean;            // overrides RSPFX_LOG_JSON=1
  readonly sinks?: Array<(e: LogEntry)=>void>; // test injection, replaces stdout
}
export interface Logger {
  readonly name: string;
  error(message:string, fields?:LogFields): void;
  warn(message:string, fields?:LogFields): void;
  info(message:string, fields?:LogFields): void;
  debug(message:string, fields?:LogFields): void;
  success(message:string, fields?:LogFields): void;
  trace(message:string, fields?:LogFields): void;
  child(fields:LogFields): Logger;
  isLevelEnabled(level:LogLevel): boolean;
  withLevel(level:LogLevel): Logger;
}
export function createLogger(name:string, opts?:LoggerOptions): Logger;
export function createDiagnosticFormatter(logger:Logger): (err:RspfxError|AggregateRspfxError)=> string;

// /Volumes/New Volume/code/spfx/packages/diagnostics/src/error.ts:3
export class RspfxError extends Error {
  readonly code: RspfxErrorCode;
  readonly cause?: RspfxError | Error;
  constructor(code:RspfxErrorCode, message:string, cause?: RspfxError | Error);
}
export class AggregateRspfxError extends Error {
  readonly code: RspfxErrorCode.AGGREGATE;
  readonly errors: readonly RspfxError[];
  constructor(errors: readonly RspfxError[], message?:string);
}
export function isRspfxError(e:unknown): e is RspfxError | AggregateRspfxError;
export function isAggregateRspfxError(e:unknown): e is AggregateRspfxError;
export function flatCauseChain(e: RspfxError): RspfxError[];

// /Volumes/New Volume/code/spfx/packages/plugin-api/src/types.ts:58
export const HOOK_PHASES = ['beforeCompile','afterCompile','beforeGenerate','afterGenerate','beforeStart','afterStart','beforePackage','afterPackage'] as const;
export type HookPhase = typeof HOOK_PHASES[number];
export type HookResult<T> = import('@mbsks/rspfx-diagnostics').Result<T, RspfxError | AggregateRspfxError>;
export type BeforeCompile = (ctx: CompileContext) => HookResult<CompileContext> | void | Promise<HookResult<CompileContext>|void>;
export type BeforePackage = (ctx:{ readonly manifests: readonly ComponentManifest[]; readonly files: ReadonlyMap<ZipPath,Uint8Array> }) 
  => HookResult<ReadonlyMap<ZipPath,Uint8Array>> | ReadonlyMap<ZipPath,Uint8Array> | void | Promise<...>;
export type OnHookError = (err:RspfxError, phase:HookPhase, pluginName:string) => 'throw'|'continue';
export interface RspfxExtension {
  readonly name: string;
  readonly priority?: number; // default 100, lower first
  readonly frameworkPreset?: FrameworkPreset;
  readonly compilerHooks?: CompilerHooks;
  readonly releaseHooks?: ReleaseHooks;
  readonly devHooks?: DevHooks;
  readonly packageHooks?: PackageHooks;
  readonly onError?: OnHookError;
}

// /Volumes/New Volume/code/spfx/packages/plugin-api/src/hook-bus.ts:1
export interface HookBus {
  readonly plugins: readonly RspfxExtension[];
  emitBeforeCompile(ctx: CompileContext): Promise<HookResult<CompileContext>>;
  emitAfterStats(stats: unknown): Promise<void>;
  emitBeforeGenerate(ctx:{production:boolean; webParts:readonly WebPartEntry[]}): Promise<HookResult<typeof ctx>>;
  emitAfterGenerate(ctx:{manifests:readonly ComponentManifest[]; releaseDir:string}): Promise<void>;
  emitBeforeStart(ctx:{mode:'local'|'sharepoint'; port?:number}): Promise<HookResult<typeof ctx>>;
  emitAfterStart(ctx:{url:string}): Promise<void>;
  emitBeforePackage(ctx:{manifests:readonly ComponentManifest[]; files:ReadonlyMap<ZipPath,Uint8Array>}): Promise<HookResult<ReadonlyMap<ZipPath,Uint8Array>>>;
  emitAfterPackage(ctx:{sppkgPath:ZipPath}): Promise<void>;
}
export function createHookBus(plugins: readonly RspfxExtension[], opts?:{ logger?:Logger; onError?:OnHookError }): HookBus;
export function composeHooks<T>(...hooks: Array<(ctx:T)=>HookResult<T>|void>): (ctx:T)=> HookResult<T>;
export function sortedPlugins(plugins: readonly RspfxExtension[]): readonly RspfxExtension[];

// /Volumes/New Volume/code/spfx/packages/diagnostics/src/trace.ts:1
export interface Tracer { span<T>(name:string, fn:()=>Promise<T>):Promise<T>; time<T>(name:string, fn:()=>T):T; }
export function createTracer(logger:Logger): Tracer;
```

`HookBus` is exhaustive on `HookPhase` (like Phase 1 `switch(err.code)` exhaustive); adding a new phase is a type error until bus method added. `Logger` `child` carries `plugin`/`phase` fields for filtering (`RSPFX_LOG_LEVEL=debug` + `grep phase=beforeCompile`). `AggregateRspfxError` replaces `cause:unknown` array erosion with typed `errors`.

---

## 3.6 Migration Notes for Consumers

**If you wrote a `RspfxExtension` with `beforeCompile(config:unknown):unknown`:**

```ts
// before
import { registerPlugin } from '@mbsks/rspfx-plugin-api';
registerPlugin({
  name: 'my-plugin',
  compilerHooks: { beforeCompile(config: unknown){ (config as any).mode='development'; return config; } },
});

// after — typed, Result, Map-aware, priority
import { definePlugin, createRSPFX } from '@mbsks/rspfx-plugin-api';
import { ok, err } from '@mbsks/rspfx-diagnostics';
import { RspfxErrorCode } from '@mbsks/rspfx-diagnostics';
const myPlugin = definePlugin({
  name: 'my-plugin',
  priority: 10, // run before framework presets (100)
  hooks: {
    beforeCompile: (ctx) => {
      // ctx is CompileContext { projectRoot, config, entries, externals, ... } typed
      if(ctx.config.framework==='svelte' && !ctx.production) return {ok:false, error: new RspfxError(RspfxErrorCode.HOOK_FAILED, 'svelte dev requires fastRefresh')};
      return {ok:true, value: ctx};
    },
  },
  // per-plugin error policy:
  onError: (e, phase) => phase==='beforePackage' ? 'continue' : 'throw',
});
const rspfx = createRSPFX({ plugins: [myPlugin] });
new RspfxPlugin({ name:'app', framework:'react', rspfx })
```

`registerPlugin` shim still works (warn once) but `createRSPFX` + `HookBus` is required for priority/`onError`.

**If you used `files:{path,content}[]` in `beforePackage`:**

```ts
// before
beforePackage(ctx:{manifests:unknown[], files:{path:string,content:Uint8Array}[]}){ ctx.files.push({path:'extra.txt', content: new Uint8Array()}); }

// after
import type { ZipPath } from '@mbsks/rspfx-core';
beforePackage(ctx:{manifests: readonly ComponentManifest[]; files: ReadonlyMap<ZipPath,Uint8Array>}){
  const next = new Map(ctx.files);
  const p = 'ClientSideAssets/extra.txt' as ZipPath; // via parseZipPath or unsafeZipPath after validation
  next.set(p, new Uint8Array());
  return next; // or {ok:true, value: next}
}
```

The old array shape is still accepted for one major via adaptor (`if(Array.isArray(ctx.files)) convert to Map`), but types now require `Map`.

**If you caught `RspfxError` stringly:**

```ts
// before
catch(e){ if((e as any).code === 'BUILD_FAILED') ... }

// after — exhaustive + aggregate
import { RspfxError, AggregateRspfxError, RspfxErrorCode } from '@mbsks/rspfx-diagnostics';
import { createDiagnosticFormatter, createLogger } from '@mbsks/rspfx-diagnostics';
const logger = createLogger('my-plugin');
try { await hookBus.emitBeforeCompile(ctx); } catch(e){
  if(e instanceof AggregateRspfxError){
    for(const err of e.errors) logger.error(err.message, { code: err.code, phase:'beforeCompile' });
    throw e;
  }
  if(e instanceof RspfxError){
    switch(e.code){
      case RspfxErrorCode.HOOK_FAILED:
      case RspfxErrorCode.PACKAGE_VALIDATION:
      case RspfxErrorCode.BUILD_FAILED: break;
      default: const _ex: never = e.code;
    }
  }
}
// render with formatter:
logger.error(createDiagnosticFormatter(logger)(e as RspfxError));
```

**If you filtered logs via `RSPFX_LOG_LEVEL=debug`:**

```ts
// before: process.env.RSPFX_LOG_LEVEL='debug' floods everything
// after: same, plus RSPFX_LOG_JSON=1 for --json, plus per-logger child fields
const pluginLogger = createLogger('rspfx').child({ plugin:'my-plugin' });
pluginLogger.debug('resolve', { alias: '@', ext: '.ts' }); // filtered unless level debug
// JSON mode:
process.env.RSPFX_LOG_JSON='1';
pluginLogger.info('compile done', { durationMs: 123, framework:'react' }); // {"level":"info","name":"rspfx",...}
```

Provide codemod at `scripts/migrate-hooks.mjs` rewriting `beforePackage(ctx:{files:{path,content}[]})` → `Map` shape and `unknown` → `CompileContext`.

---

## 3.7 Exit Criteria (Functional, No CI)

- [ ] `pnpm typecheck` passes `strict:true`; `grep -rn ": unknown" packages/plugin-api/src/types.ts` → 0 in hook params (`beforeCompile` is `CompileContext`, not `unknown`; `beforePackage` is `Map<ZipPath,Uint8Array>`).
- [ ] `grep -rn "unknown\[\]" packages/plugin-api/src/types.ts` → 0 (public hook API, same as Phase 1 exit).
- [ ] `packages/plugin-api/tests/hook-bus.test.ts` passes: priority `10` before `100`, `onError:'throw'` aborts and returns `Err` single, `onError:'continue'` accumulates `AggregateRspfxError` length 2, async hook awaited, `composeHooks(a,b)` equals `emit` sequential.
- [ ] `packages/diagnostics/tests/logger.test.ts` passes without `singleFork:true` (uses `sinks` injection): `isLevelEnabled('debug')` false at default, true at `RSPFX_LOG_LEVEL=debug`, `child({plugin:'x'})` merges fields, `RSPFX_LOG_JSON=1` emits single JSON line with `timestamp`/`fields`.
- [ ] `apps/cli/src/cli.ts:25` guard formats `AggregateRspfxError` via `createDiagnosticFormatter` — adding a new `RspfxErrorCode` without updating `switch` is a type error (`default: never`).
- [ ] `packages/plugin/src/rspack.ts:129` + `vite.ts:298` + `rsbuild.ts:185` all use `HookBus.emitBeforeCompile` (no inline `for(const p of getPlugins())` with `as unknown` remains; `grep -rn "getPlugins\(\)" packages/plugin/src` → only fallback shim).
- [ ] `manifest-generator/src/manifests-js.ts:1` + `sppkg-builder/src/sppkg-builder.ts:1` emit via `HookBus`; `sppkg-builder/tests/hook.test.ts` shows `beforePackage` returning new `Map` adds file to `.sppkg`, returning `Err` aborts `sharepoint/solution/*.sppkg` write.
- [ ] `pnpm test` passes fully with parallel forks on `hook-bus.test.ts` + `logger.test.ts` (proves isolation — global `Map` no longer needed); keep `vitest.config.ts:22 singleFork:true` for legacy suite but hook tests prove `singleFork:false` feasible (Phase 1 exit superset).
- [ ] `pnpm build` emits `packages/diagnostics/dist/logger.js` + `error.js` + `format.js` with `.js` imports, `packages/plugin-api/dist/hook-bus.js`; `core` still zero deps.
- [ ] `docs/commands.md#environment-variables` lists `RSPFX_LOG_LEVEL` + `RSPFX_LOG_JSON` with exact `trace|debug|info|warn|error` values; relative link resolves (`docs/commands.md` heading `## Environment variables`). No duplicated changelog narration in reference pages (per `docs/AGENTS.md:Writing rules`).
- [ ] Parity suite still byte-identical (HookBus is composition, not bundler kernel) — `reference/parity-*.hashes.json` diff only shows `manifest` no-change.

---

## 3.8 Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Renaming `config:unknown → CompileContext` breaks every `beforeCompile` author at once** | High | Keep `definePlugin` overload that accepts `(ctx: unknown)=>unknown` marked `@deprecated` casting to `CompileContext` for one major; bus normalizes via `if(typeof res==='object' && 'ok' in res) else cur = res as CompileContext`. Provide codemod `scripts/migrate-hooks.mjs`. |
| **`beforePackage` Map vs array confusion (old plugins push array, new expects Map)** | High | Bus shim: `if(Array.isArray(ctx.files)) { const m=new Map((ctx.files as any).map((f:{path:string,content:Uint8Array})=>[f.path as ZipPath, f.content])); next=await hook(m) ... }` plus `warnOnce('deprecated array shape')`. Test both shapes. Remove shim next major. |
| **`AggregateRspfxError` breaks `catch(e instanceof RspfxError)`** | High | `AggregateRspfxError extends Error` but `isRspfxError` returns true for both; `catch` that checks `instanceof RspfxError` must also check `isAggregateRspfxError`. Keep `RspfxError.cause` for single-error path; document `instanceof` vs `isRspfxError` guard. Runtime `e.code === 'AGGREGATE'` still works. |
| **Logger JSON mode breaks color / pipe assumption** | Medium | JSON gated on `RSPFX_LOG_JSON=1` opt-in only; default stays colored `COLORS` path at `logger.ts:42`. Add `withLevel`/`sinks` so tests don't spy `process.stdout`. Ensure `process.stderr` vs `stdout` split kept (`error`/`warn` → `stderr`). |
| **Hook order priority inversion** | Medium | Default `priority:100` preserves insertion order for unprioritized plugins (stable sort). Document `priority` as `lower = earlier`; framework presets at `100`, user plugins default `100` too, but can set `10` to front-run. Test stable sort (`a` before `b` when equal priority). |
| **Async hook stalls build (`Promise` never resolves)** | Medium | Bus has `timeoutMs` opt (default no timeout) and `trace` span `emitBeforeCompile` logs `durationMs`; if hook hangs, `logger.warn` after configurable threshold (impl via `Promise.race` with `setTimeout` warning, not rejection). No CI gate — local timeout visible. |
| **Tracing floods `debug` when HOOK + bundler both log trace** | Low | `createTracer` uses `logger.isLevelEnabled('trace')` guard; `trace` level ranked `4` above `debug` `3`, so `RSPFX_LOG_LEVEL=debug` does not emit `trace` spans; only `trace` does. Document `RSPFX_LOG_LEVEL=trace` separately. |
| **Docs link rot (`docs/commands.md#environment-variables` fragment mismatch)** | Low | Verify heading slug is exactly `## Environment variables` → `#environment-variables`; run local `pnpm test` that checks relative links (per `docs/AGENTS.md:Verification`). |

---

## 3.9 Effort Estimate

**8.5 days single engineer; ~5.5 days with two engineers (diagnostics vs bus in parallel):**

* Day 1: `diagnostics/codes.ts` + `error.ts` aggregation (`0.5d`) + `format.ts` miette branch (`0.5d`).
* Day 2–3: `logger.ts` rewrite (`trace/child/json/isLevelEnabled`) + `trace.ts` spans + `logger.test.ts`/`trace.test.ts` (`1.5d`).
* Day 3–5: `types.ts` hook typings + `hook-bus.ts` (`priority`, `onError`, `Aggregate`, async) + `hook-bus.test.ts` (`2d`) — longest pole, engineer B.
* Day 6: Thread through `plugin/src/rspack.ts`/`vite.ts`/`rsbuild.ts` + `instance.ts` (`1d`).
* Day 7: Wire `manifest-generator` + `sppkg-builder` + `dev-runtime/serve.ts` + `apps/cli/cli.ts` guard (`1d`).
* Day 8: Docs (`commands.md#environment-variables`, `internal-api.md`, `architecture.md`) + Agent Note (`docs/AGENTS.md:Non-trivial changes carry an Agent Note` at `.agents/notes/implemented/hooks/2026-08-24-hooks-diagnostics.md` with `cover` + `README.md` word budget check `wc -w`) (`0.5d`) + local verification (`pnpm build` ESM, `pnpm typecheck` strict, `pnpm test` parallel hook suite, `parity.test.ts` hash) (`0.5d`).

Parallel split: Engineer A — `diagnostics` (logger/error/format/trace) + CLI guard/docs; Engineer B — `plugin-api` (types/hook-bus/instance) + adapter wiring/manifest/sppkg.

No CI changes throughout — verification is local `pnpm build && pnpm typecheck && pnpm test && node bench/bench.mjs` against committed `reference/*.json` fixtures.


---
