# Phase 1 — Foundation: Types, Registry, Errors (P0 breaking)

> **Part of:** `docs/plan-0.1.0.md` → split by phase. Depends on Phase 0 baseline; enables Phase 2 & Phase 3.
> **No CI changes**.


### Goal & Rationale

**Goal:** Make the type system the single source of truth; eliminate the global singleton registry; make `RspfxError` exhaustive and `Result`-typed; preserve literal `framework` through `defineConfig` without `Record<string,unknown>` widening. After Phase 1, every public API is `strict:true` + `noExplicitAny`-clean, `FrameworkPreset<T>` is generic over a branded `FrameworkId`, and tests can run in parallel (`vitest.config.ts:22` no longer needs `singleFork:true`).

**Rationale (5 maintainer lenses):**

* **TanStack (type-safe headless):** Current `FrameworkPreset` is `F extends string = FrameworkId` but used as plain `FrameworkPreset` (untyped) in `framework-react/src/index.ts:5` — no `satisfies` check, no `vite`/`rsbuild` discriminant. Custom frameworks cannot augment via module declaration (`declare module '@mbsks/rspfx-plugin-api' { interface FrameworkRegistry }`) so consumers get `unknown[]` erosion.
* **Solid (signals/owner):** Global `registry = new Map` (`plugin-api/src/registry.ts:3`) is a process singleton. Tests in `parity.test.ts:141-265` rely on `rmRetry` + `singleFork:true` to avoid cross-test pollution. `createRSPFX()` builder returning isolated `RSpfxInstance` is the Solid “owner” pattern applied to plugins — each test gets its own owner.
* **Svelte (compiler/runes):** `defineConfig` currently ` (c: RspfxConfig) => RspfxConfig` widens `framework: 'react'` to `string` (`core/src/config.ts:64`). Svelte 5 runes need literal preservation for `defineWebPart<TProps>` inference (Phase 2). Adding `const` generic fixes inference without a runtime cost.
* **Rust (Result/ownership):** `RspfxError.code: string` (`diagnostics/src/error.ts:4`) and `cause?: unknown` lose exhaustiveness — `apps/cli/src/cli.ts:25 switch(err.code)` is non-exhaustive and silently falls to generic `logger.error`. Branded `RspfxErrorCode` + `Result<T,E>` + `ZipPath/ComponentId` newtypes bring Rust ownership/error discipline to TS.
* **Rspack/Rsbuild (cache/lazyCompilation):** `resolveConfig` `Partial<RspfxConfig> & Record<string,unknown>` (`core/src/config.ts:103`) allows dust (`sourcemap` passthrough, unknown `teams` shape) that busts cache keys. Strict `Result<RspfxConfig,Issue[]>` forces validation at CLI entry (`apps/cli/src/config.ts:55 loadConfig`) and yields a stable `config` for kernel hashing (Phase 5).

### All Breaking Changes (before/after)

#### 1. `FrameworkPreset` signature — `packages/plugin-api/src/types.ts:29`

**Before:**

```ts
// packages/plugin-api/src/types.ts:29
export interface FrameworkPreset<F extends string = FrameworkId> {
  name: F;
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions;
  vite?(opts: { fastRefresh: boolean }): FrameworkViteContributions;
  rsbuild?(opts: { fastRefresh: boolean }): FrameworkRsbuildContributions;
}
// usage — untyped, unknown[] allowed
export const preset: FrameworkPreset = { name: 'react', contributions() { return { rules: [] as unknown[] } } }
```

**After:**

```ts
// packages/plugin-api/src/types.ts:29
export type FrameworkIdCore = 'vanilla' | 'react' | 'solid' | 'preact' | 'vue' | 'svelte';
export type FrameworkId = FrameworkIdCore | (string & { __custom?: never });

export interface RspackContribs {
  rules?: import('@rspack/core').RuleSetRule[];
  plugins?: import('@rspack/core').Configuration['plugins'];
  resolve?: { alias?: Record<string,string>; extensions?: string[] };
  swc?: { jsc?: Record<string,unknown> };
  define?: Record<string,string>;
}
export interface FrameworkPreset<T extends FrameworkId = FrameworkId> {
  readonly name: T;
  rspack(opts: { fastRefresh: boolean }): RspackContribs; // renamed from contributions
  vite?(opts: { fastRefresh: boolean }): FrameworkViteContribs;
  rsbuild?(opts: { fastRefresh: boolean }): RsbuildContribs;
  // deprecated alias for one major:
  /** @deprecated use rspack() */
  contributions?: (opts:{fastRefresh:boolean})=>RspackContribs;
}

// Module augmentation for custom frameworks
declare module '@mbsks/rspfx-plugin-api' {
  interface FrameworkRegistry { react: typeof import('@mbsks/rspfx-framework-react').preset }
}

// usage — satisfies enforces literal, no unknown[]
import { preset as reactPreset } from '@mbsks/rspfx-framework-react';
const preset = reactPreset satisfies FrameworkPreset<'react'>; // error if name mismatch
```

**Break:** `contributions` → `rspack`, `unknown[]` gone, `name` is now literal-branded `T`. Custom frameworks must use `(string & {__custom?:never})` or module augmentation.

#### 2. `RspfxExtension` hooks — `packages/plugin-api/src/types.ts:58`

**Before:**

```ts
export interface CompilerHooks { beforeCompile?(config: unknown): unknown; afterStats?(stats: unknown): void; }
export interface PackageHooks { beforePackage?(ctx:{manifests:unknown[], files:{path:string,content:Uint8Array}[]}):void; }
export interface RspfxExtension { name:string; frameworkPreset?:FrameworkPreset; compilerHooks?:CompilerHooks; ... }
```

**After:**

```ts
// packages/diagnostics/src/result.ts (new)
export type Result<T,E> = { ok:true; value:T } | { ok:false; error:E };
export type HookResult<T> = Result<T,RspfxError>;

// packages/plugin-api/src/types.ts:58
export type BeforeCompile = (ctx: CompileContext) => HookResult<CompileContext> | void;
export type BeforePackage = (ctx:{ readonly manifests:readonly ComponentManifest[]; files: Map<string,Uint8Array> })
  => Map<string,Uint8Array> | HookResult<Map<string,Uint8Array>> | void;

export interface CompilerHooks { beforeCompile?: BeforeCompile; afterStats?: (stats: Stats) => void; }
export interface PackageHooks { beforePackage?: BeforePackage; afterPackage?: (ctx:{sppkgPath:string})=>void; }
export interface RspfxExtension {
  readonly name: string;
  readonly frameworkPreset?: FrameworkPreset;
  readonly compilerHooks?: CompilerHooks;
  readonly packageHooks?: PackageHooks;
  // ...
  readonly onError?: (err:RspfxError, phase:HookPhase) => 'throw' | 'continue';
}
export function definePlugin(p:{name:string; hooks:{beforeCompile?:BeforeCompile[]}}):RspfxExtension
export function composeHooks(...hs:BeforeCompile[]): BeforeCompile
```

**Break:** `unknown` gone from `beforeCompile`/`beforePackage`; `files` is now `Map<string,Uint8Array>` not ` {path,content}[]`; must return `Result` not `unknown`. `afterStats` now typed `Stats` not `unknown`.

#### 3. `RspfxError.code: string` → branded `RspfxErrorCode` — `packages/diagnostics/src/codes.ts:1` + `error.ts:3`

**Before:**

```ts
// packages/diagnostics/src/error.ts:3
export class RspfxError extends Error {
  readonly code: string;
  constructor(code: string, message:string, cause?: unknown) { super(message); this.code = code; this.cause = cause; }
}
// usage
throw new RspfxError('CONFIG_NOT_FOUND', '...');
switch(err.code){ case 'BUILD_FAILED': ... } // non-exhaustive, no error if misspelled
```

**After:**

```ts
// packages/diagnostics/src/codes.ts:1
export const RspfxErrorCode = {
  ANALYZE_NO_DIST: 'ANALYZE_NO_DIST',
  BUILD_FAILED: 'BUILD_FAILED',
  // ... all 27 codes enumerated
  VITE_NO_ENTRY: 'VITE_NO_ENTRY',
} as const;
export type RspfxErrorCode = typeof RspfxErrorCode[keyof typeof RspfxErrorCode] & { readonly __brand: unique symbol };

// packages/diagnostics/src/error.ts:3
export class RspfxError extends Error {
  readonly code: RspfxErrorCode;
  readonly cause?: RspfxError | Error;
  constructor(code: RspfxErrorCode, message:string, cause?: RspfxError | Error) {
    super(message); this.name='RspfxError'; this.code=code; if(cause) this.cause=cause;
  }
}
// usage — exhaustive
switch(err.code){
  case RspfxErrorCode.BUILD_FAILED: ...
  case RspfxErrorCode.COMPILE_FAILED: ...
  default: const _exhaustive: never = err.code; // compile error if new code added and not handled
}
```

**Break:** `code` is no longer `string`; string literal `'BUILD_FAILED'` without import fails typecheck. `cause` narrowed to `RspfxError|Error` (was `unknown`).

#### 4. `defineConfig` literal preservation — `packages/core/src/config.ts:4,64`

**Before:**

```ts
export function defineConfig(config: RspfxConfig): RspfxConfig { return config; }
// widens:
const cfg = defineConfig({ name:'a', framework:'react', spfxVersion:'1.23', dev:{}, build:{} });
// typeof cfg.framework -> FrameworkId (string), literal 'react' lost
```

**After:**

```ts
export function defineConfig<const T extends RspfxConfig>(config: T): T { return config; }
// plus overload for validation:
export function parseRSPFXConfig(raw: unknown): Result<RspfxConfig, Issue[]>; // Phase 8, but type setup here
// usage preserves literal:
const cfg = defineConfig({ name:'a', framework:'react' as const, spfxVersion:'1.23', dev:{}, build:{} } as const);
// typeof cfg.framework -> 'react' (literal), enables FrameworkRegistry lookup
```

Also change `resolveConfig` signature **Phase 1 only** (full valibot in Phase 8):

```ts
// before
export function resolveConfig(config: RspfxConfig | (Partial<RspfxConfig> & Record<string,unknown>)): RspfxConfig
// after Phase 1 (intermediate, without valibot yet)
export function resolveConfig(config: RspfxConfig | Partial<RspfxConfig>): Result<RspfxConfig, Issue[]> | RspfxConfig
// recommended new name for strict path:
export function tryResolveConfig(config: unknown): Result<RspfxConfig, Issue[]>
```

**Break:** `resolveConfig` previously accepted `Record<string,unknown>` dust; after Phase 1 it rejects unknown keys (type error). `defineConfig` now generic `const T`; passing a widened `FrameworkId` variable will infer `string` not `'react'` and may break `FrameworkPresetUnion` discriminant.

#### 5. `getPlugins()`/`registerPlugin` → `createRSPFX` builder — `packages/plugin-api/src/registry.ts:3` + new `instance.ts`

**Before:**

```ts
// packages/plugin-api/src/registry.ts:3
const registry = new Map<string,RspfxExtension>();
export function registerPlugin(p:RspfxExtension){ registry.set(p.name,p) }
export function getPlugins():RspfxExtension[]{ return [...registry.values()] }
// consumer
import { registerPlugin } from '@mbsks/rspfx-plugin-api';
registerPlugin({ name:'my-plugin', frameworkPreset: reactPreset });
// compiler internally
import { getPlugins } from '@mbsks/rspfx-plugin-api';
for(const p of getPlugins()){ apply(p) }
```

**After:**

```ts
// packages/plugin-api/src/instance.ts (new)
export interface RspfxInstance {
  use(plugin: RspfxExtension): this;
  presetFor(framework: FrameworkId): FrameworkPreset | undefined;
  readonly hooks: HookBus; // composeHooks aggregate
  createCompileContext(opts: Omit<CompileContext,'externals'>): CompileContext;
  readonly plugins: readonly RspfxExtension[];
}
export function createRSPFX(opts?:{ plugins?:RspfxExtension[] }): RspfxInstance {
  const map = new Map<string,RspfxExtension>();
  for(const p of opts?.plugins ?? []) map.set(p.name,p);
  return {
    use(plugin){ map.set(plugin.name,plugin); return this; },
    presetFor(id){ return [...map.values()].find(p=>p.frameworkPreset?.name===id)?.frameworkPreset; },
    get plugins(){ return [...map.values()]; },
    hooks: createHookBus(map),
    createCompileContext: (o)=> buildContext(o, map),
  };
}

// shim retained for one major (deprecated)
// packages/plugin-api/src/registry.ts:3
/** @deprecated use createRSPFX(). Use registerPlugin only for legacy singletons. */
export function registerPlugin(p:RspfxExtension):void { globalRegistry.set(p.name,p); }
export function getPlugins():RspfxExtension[]{ warnOnce('deprecated'); return [...globalRegistry.values()]; }
```

**Break:** `getPlugins()` without an instance is deprecated and will warn; new code must thread `RSpfxInstance` through `apps/cli/src/config.ts:35 discoverPlugins(cwd) → createRSPFX({plugins})` and into `plugin/src/rspack.ts:59 new RspfxPlugin({rspfx})`, `vite.ts:298`, `rsbuild.ts:185`, `dev-runtime/src/serve.ts:146`. Singleton import order no longer matters.

#### 6. Newtypes — `packages/core/src/newtypes.ts` (new) and `platform.ts:20`

**Before:**

```ts
export const PLATFORM_ONLY_PREFIXES: readonly string[] = ['@msinternal', ...];
export function isPlatformOnlyModule(r:string):boolean{ return PLATFORM_ONLY_PREFIXES.some(p=> r===p || r.startsWith(p+'/')) }
type ComponentId = string; type ZipPath = string; // unbranded, typo-prone
```

**After:**

```ts
// packages/core/src/newtypes.ts
export type ComponentId = string & { readonly __brand: 'ComponentId' };
export function parseComponentId(s:string): Result<ComponentId, RspfxError> {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    ? {ok:true, value: s as ComponentId}
    : {ok:false, error: new RspfxError(RspfxErrorCode.INVALID_MANIFEST_ID, `invalid ComponentId ${s}`)}
}
export type ZipPath = string & { readonly __brand: 'ZipPath' };
export function parseZipPath(s:string): Result<ZipPath,RspfxError> {
  if(s.includes('..') || s.startsWith('/') || s.includes('\\')) return {ok:false, error: new RspfxError(RspfxErrorCode.SPPKG_TRAVERSAL, `traversal in ${s}`)}
  return {ok:true, value: s as ZipPath}
}
export type Lcid = number & { readonly __brand: 'Lcid' };
export type CultureName = string & { readonly __brand:'CultureName' };
export const LCID_TO_CULTURE: ReadonlyMap<Lcid,CultureName> = new Map([...]);
export function localeToCultureName(lcid:Lcid): CultureName { ... }

// packages/core/src/platform.ts:20
import type { PlatformPrefix } from './newtypes.js';
export const PLATFORM_ONLY_PREFIXES: readonly PlatformPrefix[] = [
  '@msinternal' as PlatformPrefix,
  '@azure/msal-browser-1p' as PlatformPrefix,
  '@azure/msal-browser-legacy-1p' as PlatformPrefix,
];
export function isPlatformOnlyModule(req: PlatformPrefix | string): boolean { ... }
```

**Break:** `PLATFORM_ONLY_PREFIXES` narrowed from `string[]` to branded `PlatformPrefix[]`; `ComponentId` etc. now opaque — `string` assignment requires `parse*` or `as ComponentId` with lint suppression.

### File-by-File Task Breakdown

| # | Absolute Path | Lines | Action | Detail |
|---|---|---|---|---|
| 1.1 | `/Volumes/New Volume/code/spfx/packages/plugin-api/src/types.ts` | `1-89` | **Rewrite** | Introduce `FrameworkIdCore` (`'vanilla'\|'react'\|'solid'\|'preact'\|'vue'\|'svelte'`), `FrameworkId` branded `(string & {__custom?:never})`, `RspackContribs` with `RuleSetRule` not `unknown[]`, rename `contributions` → `rspack` keep deprecated alias, add `FrameworkRegistry` declaration, replace `CompilerHooks`/`PackageHooks` `unknown` with `HookResult`/`Map<string,Uint8Array>`/`ComponentManifest`. Add `definePlugin`, `composeHooks` exports. Remove `FrameworkPresetUnion` manual union or generate from `FrameworkRegistry`. |
| 1.2 | `/Volumes/New Volume/code/spfx/packages/plugin-api/src/registry.ts` | `1-15` | **Refactor** | Keep `definePlugin` pure. Move `registry` Map to `instance.ts`; keep `registerPlugin`/`getPlugins` as deprecated shim delegating to `globalInstance` with `console.warn` once. Add `@deprecated` JSDoc linking to `createRSPFX`. |
| 1.3 | `/Volumes/New Volume/code/spfx/packages/plugin-api/src/instance.ts` | **new** | **Create** | Implement `RspfxInstance` + `createRSPFX` as above. Owns `Map<string,RspfxExtension>`, `HookBus`, `createCompileContext` wrapper. Export from `index.ts`. Must be tree-shakable and not import `node:` APIs (stays like `core` except `plugin-api` may import `diagnostics`). |
| 1.4 | `/Volumes/New Volume/code/spfx/packages/plugin-api/src/index.ts` | `1-10` | **Export** | Add `export { createRSPFX } from './instance.js'` and `export type { RspfxInstance }`, `export { definePlugin as definePluginNew }` if avoiding name clash, re-export `Result`. |
| 1.5 | `/Volumes/New Volume/code/spfx/packages/core/src/config.ts` | `4-66,103` | **Break** | Change `type FrameworkId` to import from `newtypes` or keep but align with `FrameworkIdCore`. Change `defineConfig` to `defineConfig<const T extends RspfxConfig>(c:T):T`. Add `tryResolveConfig` returning `Result<RspfxConfig,Issue[]>`. Keep `resolveConfig` as deprecated wrapper that throws on `Err` for backward compat. Remove `& Record<string,unknown>` widening. |
| 1.6 | `/Volumes/New Volume/code/spfx/packages/core/src/newtypes.ts` | **new** | **Create** | Implement `ComponentId`, `ZipPath`, `Lcid`, `CultureName`, `PlatformPrefix`, `Locale` enum, `parse*`, `LCID_TO_CULTURE`, `localeToCultureName`. No dependencies. Add `Uuid` style validation per `reference/sp-component-ids.json` shape. |
| 1.7 | `/Volumes/New Volume/code/spfx/packages/core/src/platform.ts` | `20-28` | **Type-narrow** | Import `PlatformPrefix`; change `PLATFORM_ONLY_PREFIXES: readonly PlatformPrefix[]`; update `isPlatformOnlyModule(request: string \| PlatformPrefix)`. Ensure no runtime change. |
| 1.8 | `/Volumes/New Volume/code/spfx/packages/core/src/index.ts` | `1-21` | **Export** | Re-export `tryResolveConfig`, `newtypes` (`ComponentId`, `ZipPath`, etc.), keep `defineConfig` generic. |
| 1.9 | `/Volumes/New Volume/code/spfx/packages/diagnostics/src/codes.ts` | `1-32` | **Brand** | Convert `enum RspfxErrorCode` to `const` object + branded type (or keep `enum` but add branded intersection `& {__brand}` via type). Add missing codes needed for newtypes (`INVALID_MANIFEST_ID` already exists; ensure `SPPKG_TRAVERSAL` used by `ZipPath`). Make exhaustive. |
| 1.10 | `/Volumes/New Volume/code/spfx/packages/diagnostics/src/error.ts` | `1-14` | **Break** | Change `code: string` → `code: RspfxErrorCode`, `cause?: RspfxError\|Error` (was `unknown`). Add `isRspfxError(e:unknown):e is RspfxError`. Update `constructor` signature. |
| 1.11 | `/Volumes/New Volume/code/spfx/packages/diagnostics/src/result.ts` | **new** | **Create** | `export type Result<T,E> = {ok:true;value:T}\|{ok:false;error:E}` + helpers `ok(T)`, `err(E)`, `map`, `andThen`, `unwrap`. Used by `tryResolveConfig` and hooks. No deps. |
| 1.12 | `/Volumes/New Volume/code/spfx/packages/diagnostics/src/index.ts` | `1-7` | **Export** | Add `export type {Result}` and `export { RspfxErrorCode }` branded. |
| 1.13 | `/Volumes/New Volume/code/spfx/packages/framework-react/src/index.ts` | `5-50` | **Migrate** | Replace `preset: FrameworkPreset` with `preset satisfies FrameworkPreset<'react'>`; rename `contributions` → `rspack`; keep `contributions` as deprecated alias calling `rspack`. Update `FrameworkRspackContributions` → `RspackContribs` import. |
| 1.14 | `/Volumes/New Volume/code/spfx/packages/framework-solid/src/index.ts` | `26-40` | Same | `preset satisfies FrameworkPreset<'solid'>`, `rspack` rename. |
| 1.15 | `/Volumes/New Volume/code/spfx/packages/framework-vanilla/src/index.ts` | `3-8` | Same | Minimal preset; add `satisfies FrameworkPreset<'vanilla'>`. |
| 1.16 | `/Volumes/New Volume/code/spfx/packages/framework-preact/src/index.ts` | `1-?` | Same | All 6 frameworks uniform. |
| 1.17 | `/Volumes/New Volume/code/spfx/packages/framework-vue/src/index.ts` | `1-?` | Same | Same. |
| 1.18 | `/Volumes/New Volume/code/spfx/packages/framework-svelte/src/index.ts` | `1-?` | Same | Same (further Svelte 5 change deferred to Phase 7). |
| 1.19 | `/Volumes/New Volume/code/spfx/packages/core/src/marker.ts` | `1-31` | **Augment** | Add optional `Symbol.for('@mbsks/rspfx/instance')` marker for `RSpfxInstance` injection? Or keep as-is; document that `RSPFX_PLUGIN_MARKER` + `RSPFX_PLUGIN_OPTIONS` remain for `apps/cli/src/config.ts:35 findRspfxPlugin` scanning. No break. |
| 1.20 | `/Volumes/New Volume/code/spfx/apps/cli/src/config.ts` | `35-93` | **Refactor** | Replace `resolveConfig(plugin[RSPFX_PLUGIN_OPTIONS])` with `tryResolveConfig` + `Result` handling. Add `discoverPlugins(cwd):RspfxExtension[]` (scan `jiti` plugins) and `createRSPFX({plugins})` builder; pass `rspfx` instance to `new RspfxPlugin({rspfx})`. Update `LoadedProject` to carry `rspfx: RspfxInstance`. |
| 1.21 | `/Volumes/New Volume/code/spfx/apps/cli/src/cli.ts` | `21-41` | **Exhaustive** | Change `guard` to `if (error instanceof RspfxError) switch(error.code)` with exhaustive `default: never`. Import `RspfxErrorCode`. Add `miette`-style formatter hook (prep for Phase 3 `format.ts`). |
| 1.22 | `/Volumes/New Volume/code/spfx/packages/plugin/src/rspack.ts` | `53-193` | **Inject** | Constructor `new RspfxPlugin({name, framework, rspfx?:RSpfxInstance})`; if `rspfx` provided use it, else fallback to deprecated `getPlugins()`. Replace `loadFrameworkPreset(opts.framework)` with `rspfx.presetFor(opts.framework) ?? loadFrameworkPreset`. Update `apply` to read `rspfx.hooks.beforeCompile`. |
| 1.23 | `/Volumes/New Volume/code/spfx/packages/plugin/src/vite.ts` | `298` | Same | Accept `rspfx` param, thread through `rspfxVite({rspfx})`. |
| 1.24 | `/Volumes/New Volume/code/spfx/packages/plugin/src/rsbuild.ts` | `185` | Same | Same injection. |
| 1.25 | `/Volumes/New Volume/code/spfx/packages/dev-runtime/src/serve.ts` | `146` | Same | `startServe({rspfx, logger})` instead of global `getPlugins()`. |
| 1.26 | `/Volumes/New Volume/code/spfx/packages/plugin-api/tests/preset.types.test.ts` | **new** | **Create** | `expectTypeOf` suite: `expectTypeOf(reactPreset).toEqualTypeOf<FrameworkPreset<'react'>>()`, `frameworkId: 'react' satisfies FrameworkId`, `custom: 'my-custom' satisfies FrameworkId` (via `string &`), `rspackContribs` has no `unknown[]`. |
| 1.27 | `/Volumes/New Volume/code/spfx/tsconfig.base.json` | `1-43` | **Verify** | Ensure `strict:true` `18`, `noUncheckedIndexedAccess:true` `19` already; add `noImplicitOverride:true` already. No change but verify `paths` still only `@mbsks/*` aliases. |

### Implementation Steps (ordered)

1. **Land `diagnostics` primitives first** — Create `result.ts` with `Result<T,E>` helpers; brand `RspfxErrorCode` in `codes.ts` (keep enum runtime as `const` object for tree-shaking); update `error.ts` to `code:RspfxErrorCode` + `cause:RspfxError|Error`. Run `pnpm typecheck` — expect ~30 call sites to fail (`cli.ts:26`, `build.ts`, `sppkg-builder`); fix them to import `RspfxErrorCode` constant. Keep a `string` overload deprecated for one PR if needed, then delete.
2. **Land `core` newtypes + `defineConfig<const T>`** — Create `newtypes.ts`; update `platform.ts:20` to `PlatformPrefix[]`; update `config.ts:4` `FrameworkId` to `FrameworkIdCore | (string & {__custom})` and `defineConfig<const T>`; add `tryResolveConfig` returning `Result`. Run `pnpm test` — no runtime behavior change yet. Verify `core` still zero deps (`grep dependencies packages/core/package.json`).
3. **Rewrite `plugin-api/types.ts:29,58`** — Replace `unknown[]` with typed `RspackContribs`; rename `contributions` → `rspack` (keep deprecated alias that delegates). Introduce `FrameworkRegistry` empty interface for augmentation; change `FrameworkPreset` to `FrameworkPreset<T extends FrameworkId>`. Update `CompilerHooks`/`PackageHooks` to `HookResult`/`Map`. Run `pnpm typecheck` — all 6 framework presets will error, which is expected.
4. **Fix all 6 framework presets** — Edit `framework-react/solid/vanilla/preact/vue/svelte/src/index.ts` to `satisfies FrameworkPreset<'id'>` and `rspack()`; keep `contributions` as deprecated wrapper `contributions(opts){ return this.rspack(opts) }`. Verify no `unknown[]` remains (grep `unknown` in `framework-*/src` must be 0).
5. **Introduce `instance.ts` + shim `registry.ts`** — Create `instance.ts` with `createRSPFX`; refactor `registry.ts` to keep `registerPlugin`/`getPlugins` as shim (weak `Map` + `onceWarn`). Export from `index.ts`. No consumer change yet, but `vitest` can now `import {createRSPFX} from '@mbsks/rspfx-plugin-api'`.
6. **Thread instance through CLI + plugins** — Update `apps/cli/src/config.ts:35` to `discoverPlugins` + `createRSPFX({plugins})`; update `apps/cli/src/cli.ts:21 guard` to exhaustive `switch(err.code)`; update `plugin/src/rspack.ts:71 constructor` to accept `rspfx?:RSpfxInstance` and fallback; same for `vite.ts`, `rsbuild.ts`, `dev-runtime/src/serve.ts:146`. Wire `createCompileContext` via `instance.createCompileContext` instead of direct import.
7. **Add `expect-type` suite** — Create `plugin-api/tests/preset.types.test.ts` with `expect-type` (or `expectTypeOf` from `vitest`). Add `diagnostics/tests/result.test.ts` for `ok/err` helpers. Run `pnpm test` — should pass with `singleFork:true` still; then try `singleFork:false` with per-test `createRSPFX()` isolation in one test file to prove isolation works (Phase 1 exit).
8. **Local verification & deprecation** — Run `pnpm build`, `pnpm typecheck`, `pnpm test`. Grep `grep -rn "unknown\[\]" packages/plugin-api packages/core` must be 0 in public APIs (only `internal` helpers may use `unknown` internally). Grep `grep -rn "registerPlugin\|getPlugins" apps/cli packages/plugin` must show only shim + one fallback. Tag deprecated JSDocs with `@deprecated since 0.1.0 — use createRSPFX`.

### Data Structures / Types to Introduce

```ts
// packages/diagnostics/src/result.ts
export type Result<T,E> = { ok:true; value:T } | { ok:false; error:E };
export function ok<T>(value:T): Result<T,never> { return {ok:true,value} }
export function err<E>(error:E): Result<never,E> { return {ok:false,error} }
export function map<T,U,E>(r:Result<T,E>, fn:(t:T)=>U): Result<U,E> { return r.ok ? ok(fn(r.value)) : r }
export function andThen<T,U,E>(r:Result<T,E>, fn:(t:T)=>Result<U,E>): Result<U,E> { return r.ok ? fn(r.value) : r }
export type Issue = { path: (string|number)[]; message: string; code: RspfxErrorCode };

// packages/diagnostics/src/codes.ts — branded
export const RspfxErrorCode = {
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  PLUGIN_NOT_FOUND: 'PLUGIN_NOT_FOUND',
  INVALID_MANIFEST_ID: 'INVALID_MANIFEST_ID',
  SPPKG_TRAVERSAL: 'SPPKG_TRAVERSAL',
  COMPILE_FAILED: 'COMPILE_FAILED',
  // ... 27 total, exhaustive
} as const;
export type RspfxErrorCode = typeof RspfxErrorCode[keyof typeof RspfxErrorCode] & { readonly __brand: unique symbol };

// packages/plugin-api/src/types.ts
export type FrameworkIdCore = 'vanilla'|'react'|'solid'|'preact'|'vue'|'svelte';
export type FrameworkId = FrameworkIdCore | (string & { __custom?: never });
export interface FrameworkRegistry {} // augmentation point
export type FrameworkIdFromRegistry = keyof FrameworkRegistry extends never ? FrameworkId : keyof FrameworkRegistry & FrameworkId;
export interface RspackContribs {
  rules?: import('@rspack/core').RuleSetRule[];
  plugins?: import('@rspack/core').Configuration['plugins'];
  resolve?: { alias?: Record<string,string>; extensions?: string[] };
  swc?: { jsc?: Record<string,unknown> };
  define?: Record<string,string>;
}
export interface FrameworkPreset<T extends FrameworkId = FrameworkId> {
  readonly name: T;
  rspack(opts:{fastRefresh:boolean}): RspackContribs;
  vite?(opts:{fastRefresh:boolean}): ViteContribs;
  rsbuild?(opts:{fastRefresh:boolean}): RsbuildContribs;
  /** @deprecated */ contributions?: (opts:{fastRefresh:boolean})=>RspackContribs;
}

// packages/plugin-api/src/instance.ts
export interface HookBus {
  readonly beforeCompile: BeforeCompile[];
  readonly beforePackage: BeforePackage[];
  compose(): { beforeCompile: BeforeCompile; beforePackage: BeforePackage };
}
export interface RspfxInstance {
  use(plugin: RspfxExtension): this;
  presetFor(framework: FrameworkId): FrameworkPreset | undefined;
  readonly plugins: readonly RspfxExtension[];
  readonly hooks: HookBus;
  createCompileContext(opts: { projectRoot:string; config:RspfxConfig; entries:Entry[]; externals:string[]; localizedAliases:Record<string,string>; fastRefresh:boolean; production:boolean }): CompileContext;
}
export function createRSPFX(opts?:{ plugins?: RspfxExtension[] }): RspfxInstance;

// packages/core/src/newtypes.ts
export type ComponentId = string & { readonly __brand:'ComponentId' };
export type ZipPath = string & { readonly __brand:'ZipPath' };
export type Lcid = number & { readonly __brand:'Lcid' };
export type CultureName = string & { readonly __brand:'CultureName' };
export type PlatformPrefix = '@msinternal' | '@azure/msal-browser-1p' | '@azure/msal-browser-legacy-1p' | (string & { __platform?:never });
export enum Locale { EN_US = 1033, FR_FR = 1036, DE_DE = 1031 /* ... */ }
export const LCID_TO_CULTURE: ReadonlyMap<Lcid,CultureName>;

// packages/core/src/config.ts
export function defineConfig<const T extends RspfxConfig>(config: T): T;
export function tryResolveConfig(raw: unknown): Result<RspfxConfig, Issue[]>;
/** @deprecated use tryResolveConfig */
export function resolveConfig(config: Partial<RspfxConfig>): RspfxConfig; // throws on Err

// packages/diagnostics/src/error.ts
export class RspfxError extends Error {
  readonly code: RspfxErrorCode;
  readonly cause?: RspfxError | Error;
  constructor(code: RspfxErrorCode, message:string, cause?: RspfxError | Error);
}
export function isRspfxError(e: unknown): e is RspfxError;
```

### Migration Notes for Consumers

**If you maintain a custom framework:**

```ts
// before
import type { FrameworkPreset } from '@mbsks/rspfx-plugin-api';
export const preset: FrameworkPreset = { name: 'my-fw', contributions(){ return { rules: [] } } }
// after
import type { FrameworkPreset } from '@mbsks/rspfx-plugin-api';
export const preset = {
  name: 'my-fw' as const,
  rspack(){ return { rules: [] } }
} satisfies FrameworkPreset<'my-fw'>;

// optional augmentation for exhaustive FrameworkRegistry
declare module '@mbsks/rspfx-plugin-api' {
  interface FrameworkRegistry { 'my-fw': typeof preset }
}
```

**If you used `registerPlugin`/`getPlugins`:**

```ts
// before
import { registerPlugin, getPlugins } from '@mbsks/rspfx-plugin-api';
registerPlugin({ name:'my-plugin', frameworkPreset: preset });
const hooks = getPlugins().flatMap(p=> p.compilerHooks?.beforeCompile ?? []);

// after
import { createRSPFX } from '@mbsks/rspfx-plugin-api';
const rspfx = createRSPFX({ plugins: [{ name:'my-plugin', frameworkPreset: preset }] });
// or incremental
const rspfx = createRSPFX().use({ name:'my-plugin', frameworkPreset: preset });
const preset2 = rspfx.presetFor('my-fw'); // typed as FrameworkPreset<'my-fw'> | undefined

// pass to bundler plugin (rspack/vite/rsbuild)
new RspfxPlugin({ name:'my-app', framework:'my-fw', rspfx })
rspfxVite({ name:'my-app', framework:'my-fw', rspfx })
```

The old `registerPlugin`/`getPlugins` remain as deprecated shim for one major (log `warn` once). New tests **must** use `createRSPFX()` per-test isolation:

```ts
// before (leaks across tests, needs singleFork:true)
import { registerPlugin } from '@mbsks/rspfx-plugin-api';
registerPlugin(fakePreset);

// after (isolated)
import { createRSPFX } from '@mbsks/rspfx-plugin-api';
const rspfx = createRSPFX({ plugins: [fakePreset] });
expect(rspfx.presetFor('react')).toBeDefined();
```

**If you used `defineConfig`/`resolveConfig`:**

```ts
// before
import { defineConfig } from '@mbsks/rspfx-core';
export default defineConfig({ name:'a', framework:'react', spfxVersion:'1.23', dev:{}, build:{} });
const cfg = resolveConfig(raw as Partial<RspfxConfig> & Record<string,unknown>);

// after — literal preserved
import { defineConfig, tryResolveConfig } from '@mbsks/rspfx-core';
export default defineConfig({ name:'a', framework:'react', spfxVersion:'1.23', dev:{}, build:{} } as const);
// rspfx framework discriminant now narrows without cast
const result = tryResolveConfig(raw);
if(!result.ok){ console.error(result.error.map(i=> i.message).join('\n')); throw result.error[0] }
```

**If you caught `RspfxError`:**

```ts
// before
catch(e){ if((e as any).code === 'CONFIG_NOT_FOUND') ... } // stringly
// after
import { RspfxError, RspfxErrorCode } from '@mbsks/rspfx-diagnostics';
catch(e){
  if(e instanceof RspfxError){
    switch(e.code){
      case RspfxErrorCode.CONFIG_NOT_FOUND: // exhaustive
      case RspfxErrorCode.PLUGIN_NOT_FOUND:
      default: const _exhaust: never = e.code;
    }
  }
}
```

### Exit Criteria (functional, not CI)

- [ ] `pnpm typecheck` passes locally with `strict:true`; `grep -rn "unknown\[\]" packages/plugin-api/src/types.ts` → 0 (public API). Only internal helpers may use `unknown` behind branded types.
- [ ] `grep -rn ": unknown" packages/plugin-api/src/types.ts` → 0 for `beforeCompile`/`beforePackage` params (now `CompileContext`, `Map<string,Uint8Array>`).
- [ ] All 6 framework packages `framework-{react,solid,vanilla,preact,vue,svelte}/src/index.ts` contain `satisfies FrameworkPreset<'id'>` and `rspack(`; `contributions` only as deprecated alias.
- [ ] `packages/plugin-api/tests/preset.types.test.ts` passes with `expectTypeOf` — literal `'react'` not widened to `string`; custom `FrameworkId` `(string & {__custom})` accepted.
- [ ] `packages/diagnostics/tests/result.test.ts` passes for `Result` helpers.
- [ ] `pnpm test` passes with **parallel** forks on at least one test file (prove `singleFork:true` no longer required). Keep `vitest.config.ts:24 singleFork:true` for remainder of suite but add comment `// Phase 1 proves per-test isolation; remove after full migration`.
- [ ] `apps/cli/src/cli.ts:25` exhaustive `switch(err.code)` compiles with `default: never` (adding a new `RspfxErrorCode` without updating `switch` is a type error).
- [ ] `resolveConfig` dust rejected: `resolveConfig({name:'a', framework:'react', unknownKey:123} as any)` → type error without `as any`; `tryResolveConfig` returns `Err` with `Issue[]`.
- [ ] `registerPlugin`/`getPlugins` shim still works but emits `warn` once; new code using `createRSPFX` does not warn.
- [ ] `PLATFORM_ONLY_PREFIXES` typed as `readonly PlatformPrefix[]` and `isPlatformOnlyModule('@msinternal/foo')` still `true` while `isPlatformOnlyModule('@msinternalfoo')` still `false` (no `startsWith` over-match — existing test in `core` passes).
- [ ] `pnpm build` emits ESM `dist/` with `.js` imports; `core` still zero deps (`cat packages/core/package.json | grep dependencies` → none).
- [ ] Parity test `packages/plugin/tests/parity.test.ts` still byte-identical across three bundlers after instance injection (no kernel change yet).

### Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Renaming `contributions` → `rspack` breaks every framework + consumer in one commit** | High | Keep `contributions` as deprecated alias (`contributions(opts){ return this.rspack(opts) }`) that is tested to delegate; remove only in next major after 0.1.0. Provide codemod in Phase 8 `rspfx migrate --to 0.1` to rewrite. |
| **`RspfxErrorCode` branding breaks `catch` string comparison** | High | Keep `RspfxErrorCode` values as string literals at runtime; only type is branded (`string & {__brand}`). Runtime `e.code === 'BUILD_FAILED'` still works, but type error nudges to `RspfxErrorCode.BUILD_FAILED`. Provide compat overload `new RspfxError(code: string, ...)` marked `@deprecated` that casts. |
| **Global singleton → instance migration misses one call site** — e.g. `dev-runtime/src/serve.ts:315` still calls `getPlugins()` | High | Grep-driven checklist: list every file that imports from `plugin-api` (`plugin-api/src/index.ts` exports). Update them in one PR: `apps/cli/src/config.ts:35`, `plugin/src/rspack.ts:59`, `vite.ts:298`, `rsbuild.ts:185`, `dev-runtime/src/serve.ts:146`. Add runtime assertion `if(!rspfx && getPlugins().length>0) warn('deprecated global')`. |
| **Literal `defineConfig<const T>` widens unexpectedly when consumer passes variable** | Medium | Document `as const` requirement; add `expect-type` test that `defineConfig({framework:'react'})` preserves literal while `defineConfig({framework: fwVar})` widens to `string` (expected). Provide helper `defineFramework('react')` that returns branded literal if needed. |
| **`Result` vs `throw` duality** — `resolveConfig` throws but `tryResolveConfig` returns `Result` | Medium | Keep `resolveConfig` throwing for backward compat (calls `tryResolveConfig` and `unwrap`); new CLI code uses `tryResolveConfig`. Mark `resolveConfig` `@deprecated` and log deprecation only when `Record<string,unknown>` dust is passed. |
| **Newtypes over-branding** — `ZipPath` as `string & {__brand}` forces casts everywhere (`path.join` returns `string`) | Medium | Provide `parseZipPath` + `unsafeZipPath(s:string):ZipPath` (audited, for internal `path.join` results) and `toString` is identity; `sppkg-builder/src/zip.ts:22` uses `unsafeZipPath` after traversal check. Branding is compile-time only, no runtime `new` cost. |
| **Module augmentation not discovered** — custom framework `FrameworkRegistry` merge fails if `tsconfig.base.json` `paths` empty in consumer | Low | Document augmentation pattern in `docs/internal-api.md` and in JSDoc on `FrameworkRegistry`; `tsconfig.base.json` `paths:{}` empty only applies to `packages/*/tsconfig.build.json` (published `dist`), not to consumer `tsconfig.json` where augmentation is needed. |

### Effort Estimate

**10 days** single engineer; **~6 days** with two engineers (split `diagnostics`/`core` vs `plugin-api`/`frameworks`):

* Days 1–2: `diagnostics` `Result` + branded `RspfxErrorCode` (2d). Parallelizable with `core` newtypes.
* Days 2–3: `core` `newtypes.ts` + `defineConfig<const T>` + `tryResolveConfig` (1.5d).
* Days 3–5: `plugin-api` `types.ts` rewrite + `instance.ts` + 6 framework presets (2.5d) — most churn, needs careful `unknown[]` elimination.
* Days 6–7: Thread `createRSPFX` through CLI + 3 bundler plugins + dev-runtime (2d).
* Days 8–9: `expect-type` + `Result` tests + parallel-fork proof + `pnpm test` green (1.5d).
* Day 10: Deprecation docs + migration notes + review (0.5d).

With two engineers: Engineer A takes diagnostics/core (3.5d), Engineer B takes plugin-api/frameworks (4d), then pair on CLI threading + tests (2d).

---

**Handoff:** Phase 0 is a frozen, measured baseline with no code breaks; Phase 1 is the type-system source of truth that unblocks Phase 2 (`defineWebPart` adapter) and Phase 3 (`HookResult`) without any CI proposals — verification is local `pnpm build && pnpm typecheck && pnpm test` and committed `reference/*.json` fixtures diffed against 0.0.13 hashes.
