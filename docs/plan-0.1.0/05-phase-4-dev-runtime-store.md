# Phase 4 — Dev Runtime Store & State Machine (Expanded)

## 4.1 Detailed Goal & Rationale

**Goal:** Replace the ad-hoc mutable state in `dev-runtime` with a single observable, deterministic, push-based runtime. Make `rspfx dev` testable without timers or browser, halve poll traffic, and stop conflating fast-refresh HMR with full `location.reload()`.

**Current pain (why this phase must precede Phase 5):**

* `packages/dev-runtime/src/serve.ts:146-375` holds 5 independent mutables (`let origin: string` at `:155`, `let server: StartDevServerResult|undefined` at `:156`, `let closing: boolean` at `:157`, `let restarting: boolean` at `:315`, `let pendingFingerprint: string|undefined` at `:316`, `let browserOpened: boolean` at `:295`, `originRef: {value:string}` pattern repeated in `vite.ts:430` and `rsbuild.ts:140`). `drainRestarts` at `:317-352` is a `while` loop with `restarting` guard and `fingerprintDependencyScope` re-check at `:339`. No single source of truth; impossible to assert state in a test without stubbing `fs`, timers, and `startDevServer`.
* `packages/dev-runtime/src/reload.ts:18-42` exposes only `current:number` and `tick():void`. No `subscribe(listener)` or `broadcast` abstraction. Clients cannot observe without polling `/__rspfx_hot.json`. `createReloadClientScript()` at `:45-99` runs `poll()` unconditionally every 500ms (`interval=500` at `:53`) even when WS is connected; `ws.onmessage` at `:79` falls through to `fetch` for `hash|ok|still-ok` (double network round-trip). No `clearTimeout` on `ws.onopen/onmessage`, no backoff, no SSE fallback.
* `packages/dev-runtime/src/refresh.ts:17-56` ignores `_framework: FrameworkId` param (at `:18`), stores only `preserved:boolean`, `disposed:boolean`, `epoch:number`. `manifests.ts:44-77` calls `refreshRuntime.preserveState()/restoreState()` inside `regenerate()` but `serve.ts:272-279` still does `if(!fastRefresh) reload.tick()`-style logic ad-hoc (`serve.ts:272` currently always ticks; plan calls for `if(!fastRefresh)` guard). Solid/Svelte signals that should be preserved across HMR get a full reload instead.
* `packages/dev-runtime/src/project.ts:387-459` `readProject()` is impure: line `:395` calls `ensureProjectConfigs()` which at `:149-385` creates `config/serve.json`, `write-manifests.json`, `package-solution.json`, `config.json`, `teams/manifest.json` + PNG icons via `fs.writeFileSync`. Tests cannot read a fixture without mutating it. `ensureProjectConfigs` is not idempotent in watch mode.
* No devtools surface. `docs/fast-refresh.md:33` promises overlay but `serve.ts` only logs `logger.success/info`. Nothing exposes `window.__RSPFX__`.

**Rationale after:**

* A Svelte-store-shaped `DevStore` + explicit state machine (`idle→starting→running→restarting→closed`) gives deterministic `machine.send({type:'DEPENDENCY_CHANGED', fingerprint})` and `machine.getState()` in tests. Poll fallback becomes irrelevant when WS pushes; network halves.
* Pure `readProject` enables fixture-driven parity tests that Phase 5 depends on. Explicit `ensureProjectConfigs` becomes a CLI command (`rspfx doctor --fix` or `rspfx migrate --ensure-configs`) not a side effect of every `dev`/`build`.

No CI changes in this phase.

---

## 4.2 Breaking Changes

**Surface break is minimal (dev-only). Intentionally breaking to fix purity.**

| Area | Before | After |
|---|---|---|
| `readProject` purity | `packages/dev-runtime/src/project.ts:387` `export function readProject(...)` calls `ensureProjectConfigs` at `:395` (writes files) | `readProject` is pure read. New `ensureProjectConfigs(projectRoot, paths, config)` remains exported but must be called explicitly. Codemod: `readProject` callers that relied on side effect must add `ensureProjectConfigs` before first run (CLI `dev.ts`/`build.ts`). |
| `ReloadController` shape | `packages/dev-runtime/src/reload.ts:10-16` `{path, current, clientScript, tick, handle}` with silent `let current` | `ReloadController extends { subscribe(listener:(tick:number)=>void):()=>void; broadcast():void }`. `tick()` still exists but now notifies subscribers. `clientScript` decomposition: `createReloadClientScript(opts:{wsPath, pollFallbackMs})`. |
| `RefreshRuntime` wiring | `refresh.ts:17` `createRefreshRuntime(_framework, opts?)` with `preserveState/restoreState` no-ops per framework | `createRefreshRuntime(framework, {store})` subscribes to store `tick/reload` and suppresses `reload.tick()` when `fastRefresh===true` and framework HMR ack received. `_framework` becomes used (`solid`→signal preserve, `svelte`→`$set` preserve, `react`→`react-refresh` ack). |
| `Reload client` contract | `reload.ts:45` hard-coded `500ms` interval, `fetch` + WS race | `interval: 250ms` when `fastRefresh===false`, `500ms` fallback only when WS `onclose`; `clearTimeout(pollTimer)` on `ws.onopen` and on `ws.onmessage` authoritative tick. Poll disabled when `store.status==='closed'`. |
| `window.__RSPFX__` | absent | Dev-only global `window.__RSPFX__ = { store, getManifestsJs():string, getCompileContext():CompileContext, version:string }` behind `__RSPFX_DEVTOOLS__` flag or `rspfx dev --devtools`. Not shipped in production builds. |

**Before snippet — impure read + scattered state:**
```ts
// packages/dev-runtime/src/project.ts:387
export function readProject(projectRoot, paths, versionOverride, rspfxConfig){
  loadDotEnv(projectRoot);
  ensureProjectConfigs(projectRoot, resolvedPaths, rspfxConfig); // ← writes config/*.json
  // ... read package.json, config.json, serve.json
}

// packages/dev-runtime/src/serve.ts:315
let restarting = false;
let pendingFingerprint: string|undefined;
const drainRestarts = async()=>{ if(restarting||closing) return; while(...){ restarting=true; ... }};
let origin = `${scheme}://${hostname}:${port}`; // originRef pattern
```

**After snippet — pure read + store:**
```ts
// packages/dev-runtime/src/project.ts:387
export function readProject(projectRoot, paths, versionOverride, rspfxConfig): ReadProjectResult {
  // pure: no ensureProjectConfigs, no writes
  loadDotEnv(projectRoot);
  // ... reads only
}
export function ensureProjectConfigs(projectRoot, paths, rspfxConfig): void { /* writes */ }

// packages/dev-runtime/src/store.ts (new)
export type DevStatus = 'idle'|'starting'|'running'|'restarting'|'closed';
export interface DevStoreSnapshot { mode:ServeMode; origin:string; tick:number; status:DevStatus; error?:RspfxError; fingerprint?:string; }
```

No `pnpm build` contract change; `core` zero-deps preserved.

---

## 4.3 File-by-File Breakdown (Absolute Paths + Line Numbers)

### New files

* **`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/store.ts:1`** — Minimal observable store, Svelte-store shape, no `solid-js` dep. Exports `createStore(initial: DevStoreSnapshot)`, `DevStore` interface, `subscribe`, `get`, `set(patch)`, `update(fn)`. Must handle `Object.is` equality, batched notifications, `unsubscribe` idempotence. ~90 LOC.

* **`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/machine.ts:1`** — Explicit state machine. Exports `createDevMachine(store, opts:{ startOnce:(port?)=>Promise<StartDevServerResult>, fingerprintOf:()=>string, logger })`, `DevMachine`, `DevEvent` union (`{type:'START'}|{type:'RESTART', fingerprint}|{type:'DEPENDENCY_CHANGED',fingerprint}|{type:'BUILD_DONE'}|{type:'CLOSE'}|{type:'ERROR',error}`), `DevState` (`{value: DevStatus, context:{origin, tick, fingerprint, error?}}`). Implements `send(event)`, `getState()`, `subscribe`. Replaces `drainRestarts` loop at `serve.ts:317-352` with transition table. ~180 LOC.

* **`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/routes.ts:1`** *(shared with Phase 5)* — Extract route handlers: `createManifestRoute(regenerator, reload)`, `createHotRoute(reload)`, `createMockApiRoute(projectRoot, origin)`, `createLocalPageRoute(projectName, components, reload)`. Pure functions returning `{path, handler}` tuples for reuse in `serve.ts:205-244`, `vite.ts:493-511`, `rsbuild.ts:190-215`. ~80 LOC.

* **`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/path.ts:1`** — `decodeIfEncoded(p:string):string` extracted from `vite.ts:618-640` and `plugin/src/rspack.ts` `%20` handling. Handles `file://` via `fileURLToPath`, iterative `decodeURIComponent`, `%2520` stability loop. Single source. ~35 LOC.

* **`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/devtools.ts:1`** (optional, dev-only) — `attachDevtools(store, regenerator, ctx)` that sets `window.__RSPFX__` in `local-page.ts` template and in `manifests.js` debug comment. Adds `/_rspfx/devtools.json` route (manifest diff + sparkline) when `store.devtools===true` or `process.env.RSPFX_DEVTOOLS==='1'`. ~70 LOC.

### Modified files

* **`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/serve.ts:1-424`**
  - `:1-19` imports: add `createStore` from `./store.js`, `createDevMachine` from `./machine.js`, `decodeIfEncoded` from `./path.js`, remove direct `reload`/`origin` mutables.
  - `:18-40` keep `DevRuntimeOptions/Handle/ServeSettings` but add `devtools?: boolean` to `DevRuntimeOptions`.
  - `:52` `logger` make injectable: `export function startServe(opts, deps?:{logger?:Logger, createStore?, createMachine?})` for test injection (no global `process.env` read inside lib; CLI passes `createLogger('rspfx')`).
  - `:125-159` `startServe`: instantiate `store = createStore({mode, origin: settings.origin, tick:0, status:'idle'})` replacing `let origin/server/closing/restarting/pendingFingerprint` at `:155-157` and `:315-316`. Pass `store.set` into `startOnce` closure.
  - `:159-284` `startOnce`: read `store.get().origin` via `() => store.get().origin`; after `nextServer = await startDevServer(..., {routes, staticFolders})` call `store.set({origin: nextOrigin, status:'running'})`. `nextServer.onEmit` now does `store.update(s=>({tick:s.tick+1}))` or `machine.send({type:'BUILD_DONE'})` rather than `reload.tick()` directly; guard `if(!fastRefresh) reload.tick()` at `:272-279` moved into `machine` transition.
  - `:285-312` browser open: read `store.get().origin`, keep `browserOpened` flag but also store `status:'starting'` → `running`; still once-only, `drainRestarts` no longer re-opens.
  - `:315-374` **DELETE** `let restarting/pendingFingerprint/drainRestarts` (`:315-352`) and `watchDependencyScope` callback inline; replace with `const machine = createDevMachine(store, {startOnce, fingerprintOf:()=>fingerprintDependencyScope(root, config.paths?.configDir), watcher: watchDependencyScope})` and `machine.send({type:'DEPENDENCY_CHANGED', fingerprint})` on `watchDependencyScope` cb. `close()` calls `machine.send({type:'CLOSE'})` then `store.set({status:'closed'})`.
  - Keep `localRuntimeEntry` at `:377-389` and `platformOnlyExternal` at `:399-403` (later deduped in Phase 5 via kernel).

* **`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/reload.ts:1-100`**
  - `:1-2` keep `isAllowedOrigin`.
  - `:3` keep `RSPFX_HOT_PATH`.
  - `:10-16` extend `ReloadController` with `subscribe(listener:(tick:number)=>void):()=>void; broadcast():void; dispose():void`.
  - `:18-42` `createReloadController`: maintain `listeners:Set<(n)=>void>`, `current` still `number`, `tick()` increments and `listeners.forEach(l=>l(current))` + `broadcast`. Add `subscribe`/`dispose`. Keep `handle` CORS logic at `:20-31`.
  - `:45-99` `createReloadClientScript(opts?:{pollMs?:number, wsPath?:string})`: new signature. Inside script: `var pollTimer=null; var ws=null; var pollMs= opts.pollMs ?? 250` (spec: `500→250ms`), `function schedulePoll(ms){ clearTimeout(pollTimer); pollTimer=setTimeout(poll, ms)}`, `ws.onopen = ()=>{ clearTimeout(pollTimer); pollTimer=null }`, `ws.onmessage = (e)=>{ clearTimeout(pollTimer); handleData(...); }`, `ws.onclose = ()=> schedulePoll(pollMs)`. Poll fallback uses `fetch(...).finally(()=>{ if(!ws || ws.readyState!==1) schedulePoll(interval) })`. SSE optional `ReadableStream` branch behind `if('ReadableStream' in window)`. Fix fallthrough double-fetch at `:85-88` (remove second `fetch` on `hash|ok|still-ok`; just call `handleData` directly if message already contains `build` number).

* **`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/refresh.ts:1-57`**
  - `:1-17` add import `import type { DevStore } from './store.js'` and `FrameworkId` usage.
  - `:17-56` `createRefreshRuntime(framework, opts:{store:DevStore, onPreserve?, onRestore?})`: subscribe to `store` (`store.subscribe(s=>{ if(s.tick>epoch) ... })`). Use `_framework` switch: `'solid'` → preserve `createSignal` entries (no `dispose`), `'svelte'` → `$set` path, `'react'/'preact'/'vue'` → HMR ack counters. Suppress `reload.tick()` when `fastRefresh && framework!=='vanilla'` and `preserved===true` (wire at `serve.ts:272` guard). Keep `dispose/preserveState/restoreState/epoch` getters at `:24-55` but add `ackHmr():void`.

* **`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/project.ts:149-459`**
  - `:149-385` `ensureProjectConfigs`: unchanged but add `/** @deprecated use explicit CLI command; readProject no longer calls this */` JSDoc and export `ensureProjectConfigs` as pure side-effect entry point.
  - `:387-459` `readProject`: **REMOVE** line `:395` `ensureProjectConfigs(...)`. Add `loadDotEnv` stays. New signature `export function readProjectPure` alias or keep same name but pure; add `export function readProjectWithEnsure` for CLI compat shim calling `ensureProjectConfigs` then `readProject`. Update `readProject` docs to state purity and `fs.existsSync` only.
  - `:602-665` `discoverWebParts` unchanged.
  - `:748-777` `createCompileContext` add `originRef?:{value:string}` optional for Phase 5 kernel.

* **`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/manifests.ts:1-89`**
  - `:34-88` `createManifestRegenerator`: accept `store?: DevStore` param, call `store?.set({tick})` after regenerate; keep `regeneration` dedup at `:43-79`. Wire `opts.refreshRuntime?.preserveState()` at `:45` (now subscribed via store) — keep but deprecate direct call in favor of `store.subscribe`.

* **`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/index.ts:1-37`**
  - Add exports: `export {createStore} from './store.js'`, `export {createDevMachine} from './machine.js'`, `export {decodeIfEncoded} from './path.js'`, types `DevStoreSnapshot`, `DevMachine`, `DevEvent`.

* **`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/deps-watch.ts:61-157`**
  - Keep `fingerprintDependencyScope` at `:21-48` and `watchDependencyScope` at `:61-157`. Add `fingerprint` to store via machine event; ensure `onChange` debounces to `machine.send` not direct `drainRestarts`. No file change required except docs linking to store.

* **`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/local-page.ts:40-147`**
  - `:40-48` `buildLocalPageHtml`: inject `opts.devtoolsScript` (from `devtools.ts`) when `devtools===true`; add `<script>window.__RSPFX__=...` snippet after `:140` `__RSPFX_COMPONENTS__` block. Keep XSS freeze at `:141`.

* **`/Volumes/New Volume/code/spfx/packages/compiler-rspack/src/dev-server.ts:143-230`**
  - No direct change but `startDevServer` at `:143` will receive `routes` from `routes.ts` helper; ensure `corsMiddleware` at `:30-53` stays. Add `experiments` pass-through for Phase 5 caching (no Phase 4 change).

* **`/Volumes/New Volume/code/spfx/packages/plugin/src/vite.ts:40-82`**
  - `:40-82` `%20` patch block **DELETED** after `path.ts` extraction; import `decodeIfEncoded` from `@mbsks/rspfx-dev-runtime`. Keep `VITE_ENV` at `:84-98`.

* **`/Volumes/New Volume/code/spfx/packages/plugin/src/rspack.ts:59-105`**
  - No Phase 4 change; but import `decodeIfEncoded` for later Phase 5.

* **`/Volumes/New Volume/code/spfx/packages/plugin/src/rsbuild.ts:38-51`**
  - No Phase 4 change.

---

## 4.4 Ordered Implementation Steps

1. **Create `store.ts`** (`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/store.ts:1`): implement `createStore`, `subscribe`, `get`, `set`, `update`. Unit test `store.test.ts` (no fs): subscribe gets initial, set batches, unsubscribe stops, `Object.is` prevents noop. ~0.5d.
2. **Extract `path.ts`** (`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/path.ts:1`): move `decodeIfEncoded` from `vite.ts:618` (tests at `vite.ts:618-640` and `rspack.ts:40`-style patch). Add `path.test.ts` for `%20`, `%2520`, `file://`, `space` paths. ~0.5d.
3. **Refactor `reload.ts`** (`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/reload.ts:18`): add `subscribe/broadcast/dispose`, fix client script to `clearTimeout` on WS open/message, poll 250ms fallback, remove double-fetch. Test `reload.test.ts`: `tick()->listener called`, `subscribe unsubscribe`, `clientScript` contains `clearTimeout` and `ws.onopen`. ~1d.
4. **Create `machine.ts`** (`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/machine.ts:1`): implement `createDevMachine` with table `idle→starting→running→restarting→closed`, events `START/DEPENDENCY_CHANGED/CLOSE/BUILD_DONE/ERROR`. Unit test `machine.test.ts` with fake `startOnce` and `fingerprintOf`; assert `getState()` transitions without timers. ~2d.
5. **Make `project.ts` pure** (`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/project.ts:387`): delete `ensureProjectConfigs` call at `:395`, add `readProjectPure` alias, keep `ensureProjectConfigs` exported. Update `project.test.ts` to assert no `fs.writeFileSync` on missing `config/serve.json`. Add `ensureProjectConfigs.test.ts`. ~1d.
6. **Create `routes.ts`** (`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/routes.ts:1`): extract manifest/hot/mock/local-page route factories. Test route handlers return correct `Content-Type` and `Cache-Control`. ~0.5d.
7. **Wire `refresh.ts`** (`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/refresh.ts:17`): use `framework` param, accept `store`, implement `ackHmr` and `fastRefresh` suppress path. Test `refresh.test.ts`: `solid` preserves epoch, `tick` suppressed when `fastRefresh && preserved`. ~1d.
8. **Rewrite `serve.ts`** (`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/serve.ts:125-375`): instantiate store+machine, replace `origin/closing/restarting/pendingFingerprint/browserOpened` mutables, replace `drainRestarts` `:317-352` with `machine.send`, wire `reload.subscribe` to `store`, guard `reload.tick()` when `fastRefresh`. Keep `startOnce` but read `store.get().origin`. Inject logger. Integration test `serve.test.ts` using `machine.getState()` without `setTimeout` polling. ~2d.
9. **Wire `manifests.ts`+`local-page.ts`** (`manifests.ts:34`, `local-page.ts:40`): pass store to regenerator, inject `window.__RSPFX__` when `devtools`. Test `manifests.test.ts` tick increments. ~0.5d.
10. **Remove duplication in `vite.ts`/`rsbuild.ts`** (`vite.ts:40`, `rsbuild.ts:38`): import `decodeIfEncoded` from dev-runtime, delete inline patches. Verify `pnpm build` (`packages/*` ESM to `dist/`) still emits `.js` imports. ~0.5d.
11. **Add `devtools.ts` + overlay** (`devtools.ts:1`, `local-page.ts:140`): manifest diff + sparkline Behind `rspfx dev --devtools`. Manual check `http://localhost:4321/_rspfx/devtools.json`. ~0.5d.
12. **Docs** (`docs/architecture.md:97`, `docs/internal-api.md:109`): update dev-mode flow `File save → Rspack rebuild → store.tick → WS push → browser` and note `readProject` purity.

Total sequencing ~10d single-thread; steps 1-3 parallelizable.

---

## 4.5 Types / Data Structures

```ts
// packages/dev-runtime/src/store.ts:1
export type DevStatus = 'idle'|'starting'|'running'|'restarting'|'closed';
export interface DevStoreSnapshot {
  readonly mode: ServeMode;          // 'local'|'sharepoint' from serve.ts:22
  readonly origin: string;           // e.g. https://localhost:4321
  readonly tick: number;             // monotic build counter (reload.current)
  readonly status: DevStatus;
  readonly error?: RspfxError;       // branded code from diagnostics/codes.ts:1
  readonly fingerprint?: string;     // deps-watch fingerprint
  readonly framework?: FrameworkId;  // for refresh wiring
  readonly fastRefresh: boolean;
  readonly devtools?: boolean;
}
export interface DevStore {
  get(): DevStoreSnapshot;
  set(patch: Partial<DevStoreSnapshot>): void;
  update(fn:(s:DevStoreSnapshot)=>Partial<DevStoreSnapshot>): void;
  subscribe(listener:(s:DevStoreSnapshot)=>void): ()=>void; // Svelte-store shape
}

// packages/dev-runtime/src/machine.ts:1
export type DevEvent =
  | { type:'START'; port?:number }
  | { type:'DEPENDENCY_CHANGED'; fingerprint:string }
  | { type:'BUILD_DONE'; stats?:unknown }
  | { type:'ERROR'; error:RspfxError }
  | { type:'CLOSE' };
export interface DevState { value: DevStatus; context: DevStoreSnapshot; }
export interface DevMachine {
  getState(): DevState;
  send(ev:DevEvent): void;
  subscribe(l:(s:DevState)=>void):()=>void;
  dispose():void;
}

// packages/dev-runtime/src/reload.ts:10
export interface ReloadController {
  readonly path: string; // '/__rspfx_hot.json' at :3
  readonly current: number;
  readonly clientScript: string;
  tick(): void;
  broadcast(): void; // push to WS subscribers + tick
  subscribe(listener:(tick:number)=>void):()=>void;
  handle(req:unknown, res:HotJsonResponse):void;
  dispose():void;
}
export function createReloadClientScript(opts?:{
  wsPath?: string; // default RSPFX_HOT_PATH
  pollMs?: number; // default 250 when fastRefresh off, 500 fallback
  sse?: boolean;   // use ReadableStream SSE when fetch supports it
}): string;

// packages/dev-runtime/src/refresh.ts:8
export interface RefreshRuntimeOptions {
  store: DevStore;
  onPreserve?:()=>void;
  onRestore?:()=>void;
  onAckHmr?:(framework:FrameworkId)=>void;
}

// packages/dev-runtime/src/routes.ts:1
export interface Route { path:string; handler:(req:unknown,res:unknown,next?:(e?:unknown)=>void)=>void }
export function createReloadRoutes(reload:ReloadController): Route[];
export function createManifestRoute(regenerator:ManifestRegenerator, reload:ReloadController): Route;
export function createLocalPageRoute(opts:LocalPageOptions & {devtools?:boolean}): Route;

// window surface (dev-only)
declare global {
  interface Window {
    __RSPFX__?: {
      store: { get():DevStoreSnapshot; subscribe:DevStore['subscribe'] };
      getManifestsJs(): string;
      getCompileContext(): CompileContext; // from dev-runtime/project.ts:748
      version: string;
    }
  }
}
```

Store is deliberately framework-free: no `solid-js` signal, just callback set. Machine keeps Rust-style exhaustive switch on `DevEvent["type"]` (mirrors `diagnostics/codes.ts:1` branded error pattern from Phase 1).

---

## 4.6 Migration Notes

* **For `rspfx dev` callers:** nothing. `startServe({projectRoot, config, fastRefresh, port, tenantDomain, mode})` at `serve.ts:125` signature unchanged; `store`/`machine` internal.
* **For direct `readProject` users** (tests, `plugin/src/rspack.ts:80`, `rsbuild.ts:127`, `vite.ts:284`): if you relied on auto-creation of `config/serve.json` etc., add `ensureProjectConfigs(projectRoot, resolved.paths, config)` before `readProject`. A deprecated shim `readProjectWithEnsure` is exported for one major (`project.ts:387` docs). Codemod: `rg ensureProjectConfigs packages --rename`.
* **For `ReloadController` consumers** (`serve.ts:146`, `vite.ts:429`, `rsbuild.ts:139`): add `reload.subscribe(tick=>store.set({tick}))` if you observe ticks; `reload.tick()` still works but `broadcast()` is preferred for WS push.
* **For custom `refresh.ts` forks:** `createRefreshRuntime(framework, {store})` now requires `store`. Pass `store` from `serve.ts` instead of `undefined`. `_framework` at `refresh.ts:18` becomes observed; solid/svelte preserve no longer needs manual `if(previous) previous()` hack.
* **Devtools:** `rspfx dev --devtools` or `RSPFX_DEVTOOLS=1` enables `window.__RSPFX__` and `/_rspfx/devtools.json`. No prod impact.

---

## 4.7 Exit Criteria (Functional)

* `packages/dev-runtime/src/store.test.ts` + `machine.test.ts` + `reload.test.ts` + `refresh.test.ts` all pass without `setTimeout`/`fake timers` mocking `fingerprintDependencyScope`.
* `drainRestarts` loop at `serve.ts:317-352` deleted; `machine.getState().value` is `'running'` after `startServe`, `'restarting'` after `machine.send({type:'DEPENDENCY_CHANGED', fingerprint:'x'})`, `'closed'` after `close()`.
* `readProject` called on fixture missing `config/serve.json` does **not** write file (assert `fs.existsSync` still false after call). `ensureProjectConfigs` still creates it when invoked.
* `createReloadClientScript()` output contains `clearTimeout`, `ws.onopen`, `ws.onmessage` authoritative path, `setTimeout(poll, 250)` fallback, and only one `fetch` for `hash|ok|still-ok` (no double-fetch).
* Poll traffic: `fetch /__rspfx_hot.json` count in `serve.test.ts` integration halved vs baseline (WS push wins; poll fallback only on `ws.onclose`). Manual `bench/bench.mjs:59` analog shows `onEmit → manifestsJs + tick` latency unchanged.
* `refresh.ts` with `fastRefresh:true` and `framework='solid'` does **not** call `reload.tick()` on `regenerate()` (preserve path); `framework='vanilla'` still ticks.
* `pnpm build` (packages/* → dist/ ESM) passes with `.js` imports; `pnpm --filter @mbsks/rspfx-dev-runtime build` emits `dist/store.js` + `dist/machine.js`.
* `rspfx dev` local preview (`mode:'local'`) still serves `/` via `local-page.ts:40` and `/_api` via `mock-api.ts:1` on port 4321; workbench mode still opens `workbenchUrl` at `serve.ts:102` with `debugManifestsFile` param.

---

## 4.8 Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **Store over-engineered (becomes mini-redux)** | Med | Keep store ≤90 LOC, no middleware, no immer. Only `get/set/subscribe`. Machine owns transitions; store is dumb snapshot. Review denies `store.dispatch`. |
| **Purity break breaks existing `readProject` callers** | High | Ship `readProjectWithEnsure` shim for one major, mark deprecated. CLI `apps/cli/src/commands/dev.ts:27` and `build.ts:104` call `ensureProjectConfigs` explicitly before `readProject`. Tests run both paths. |
| **WS `clearTimeout` race loses tick** | High | Client keeps `seen:number|null` and compares `data.build` at `reload.ts:55-61` even after WS reconnect; poll fallback re-fetches on `ws.onclose`. Add `clientScript.test.ts` parsing script string for `clearTimeout(pollTimer)` presence. |
| **FastRefresh suppress wrong (vanilla reload lost)** | High | Gate is `if(fastRefresh && framework!=='vanilla' && refreshRuntime.preserved)`—vanilla always ticks. Test matrix `framework × fastRefresh` at `refresh.test.ts`. |
| **`window.__RSPFX__` XSS surface** | Med | Dev-only, `Object.defineProperty(writable:false)` at `local-page.ts:141` already; gate behind `--devtools` not default. Document in `docs/internal-api.md:109`. |
| **Machine+store circular updates (infinite loop)** | Med | `store.subscribe` inside `machine` is one-way; `machine.send` → `store.set` but never `store.set` → `machine.send` without event. Guard `set` with `Object.is` bail-out. |
| **Path helper regression on `%20` fixture** | Med | `path.test.ts` covers `/Volumes/New%20Volume/...`, `%2520` double-encode, `file://` URLs. Keep Vite `fsp.readFile` patch deleted only after `decodeIfEncoded` proven. |

---

## 4.9 Effort Estimate

**10d ideal, ~14d with review.**

| Step | Owner | Days |
|---|---|---|
| store + path extraction | dev-runtime | 1 |
| reload push sub + client fix | dev-runtime | 1 |
| machine + drainRestarts removal | dev-runtime | 2 |
| project purity + shim | dev-runtime | 1 |
| routes + manifest wiring | dev-runtime/compiler-rspack | 1 |
| refresh wiring + fastRefresh guard | dev-runtime/frameworks | 1 |
| serve rewrite + integration tests | dev-runtime | 2 |
| devtools overlay (optional) | dev-runtime | 0.5 |
| Docs + parity run | docs | 0.5 |

---
