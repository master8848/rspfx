# Phase 5 — Bundler Kernel & Caching (Expanded)

## 5.1 Detailed Goal & Rationale

**Goal:** Single compilation kernel consumed by three thin adapters (Rspack / Rsbuild / Vite). Versioned persistent cache + `lazyCompilation` give −40% cold start on `modern-search` (4 entries). Fix 4 P0 parity bugs that cause silent misbuilds.

**Why now (depends on Phase 4 store):**

* Duplication is the bug factory. `createRspackConfig` appears fully at `packages/compiler-rspack/src/config.ts:92-317` and is re-implemented partially at `plugin/src/rsbuild.ts:351-500` (CSS at `:376-438`, define allowlist at `:486-498`, output at `:363-371`, externals at `:362`) and again at `plugin/src/vite.ts:283-371` (define at `:300-318`, externals at `:289`). `rspack.ts:129-176` manually copies `full.output/libraryType` and `full.plugins` but never forwards `full.resolve` or `userModuleRules` from `apps/cli/src/config.ts:86` (`bundlerConfig.module.rules`). Result: `rspack build` path misses `localizedAliases` and `BUILD_TIME_ALIASES` (`config.ts:140`), `rsbuild.ts:486` DefinePlugin runs before allowlist loop (invisible), `rsbuild.ts:292` never calls `ensureCertificates`, `rsbuild.ts:351` misses `platformOnlyExternal` (`config.ts:25`).
* Cache is ad-hoc: `config.ts:118-119` `useCache = serveMode || RSPFX_CACHE=1` enables persistent cache only on serve, with no `version` hash. Switching `framework: 'react'→'vue'` or `spfxVersion` keeps stale `.rspack-cache` (no invalidation). No `lazyCompilation: {entries:false, imports:true}` for dev, so 4-entry `modern-search` compiles all chunks on cold start. `output.assetModuleFilename` and `uniqueName` diverge (`config.ts:81` vs `plugin/src/shared.ts:11`).
* CSS blocks duplicated 3 times (`config.ts:212` inline `cssUse`/`scssUse`, `rsbuild.ts:376` same, `helpers/css.ts:38` `rspfxCssInlineRule`). `POSTCSS_CONFIG_FILES` list at `config.ts:37` vs `rsbuild.ts:72` vs `helpers/css.ts:8` drift.
* Vite runs entries serially via `for(... withEnv(entry, ()=>vite.build))` at `vite.ts:461-467` and again at `:545-550` (O(n) mutating `process.env[VITE_ENV.entry]`), no `AsyncLocalStorage` isolation, no `optimizeDeps` cache, no parallel.

After: `packages/plugin/src/kernel.ts:1` (`createKernel`) owns `collectExternals` (`shared.ts:19`), `createRegenerator` (`manifests.ts:39`), `createReload` (`reload.ts:18`), `loadPreset` (`project.ts:784`), `resolveContributionLoaders` (`project.ts:813`), `writeStats` (`shared.ts:33`), plus CSS rule factory and cache version computation. Adapters become ~120 LOC config mappers.

No CI changes.

---

## 5.2 Breaking Changes

| Area | Before | After |
|---|---|---|
| **Kernel import path** | `import {createRspackConfig} from '@mbsks/rspfx-compiler-rspack'` at `plugin/src/rspack.ts:2` and ad-hoc `createManifestRegenerator` in each adapter | `import {createKernel} from './kernel.js'` as single entry. `createRspackConfig` stays but is internal to `compiler-rspack`; kernel re-exports typed wrapper. No public break for consumers—but `plugin/src/rspack.ts:143` signature changes internally. |
| **Cache directory/version** | `config.ts:309` `directory: path.join(projectRoot,'.rspack-cache')` with no `version` | `experiments.cache.version = hash8({framework, spfxVersion, build})` at `config.ts:304-313`. Busts on `framework`/`spfxVersion`/`build.sourcemap|minify` change. Existing `.rspack-cache` invalidated once on upgrade (one cold rebuild). Document in migration notes. |
| **LazyCompilation default** | none | `experiments.lazyCompilation={entries:false, imports:true}` when `mode==='development'` (`config.ts:314` and `rsbuild.ts` `modifyRspackConfig`). Does not affect production. |
| **Output filenames** | `config.ts:276` `filename:'[name].js'` but no `assetModuleFilename`; Rsbuild uses chunk `chunk.[name].js` but Vite uses `assets/[name][extname]` at `vite.ts:366` | Unified: `output.assetModuleFilename='assets/[hash][ext][query]'`, `output.uniqueName=computeUniqueName(entries)` (`config.ts:81`/`shared.ts:11`), `output.devtoolModuleFilenameTemplate='webpack:///../[resource-path]'` consistent. No `[contenthash]` yet (stability). |
| **Rsbuild TLS** | `rsbuild.ts:292` missing cert handling for `mode==='sharepoint'` | `rsbuild.ts:292` now calls `ensureCertificates(path.join(os.homedir(),'.rspfx/certs'), hostname)` (mirrors `vite.ts:292` and `serve.ts:142`). Behavior change only when `https && mode==='sharepoint'`—previously Vite/Rspack had TLS but Rsbuild did not (P0 bug). |
| **Define allowlist ordering** | `rsbuild.ts:450-485` allowlist loop **after** `new rspack.DefinePlugin(defineOptions)` at `:450` → no effect | Move allowlist **before** DefinePlugin (`rsbuild.ts:486` fix). No API break, but `DEBUG`/`NODE_ENV` definitions now actually propagate. |

**Before — Rsbuild define invisible:**
```ts
// packages/plugin/src/rsbuild.ts:450-498 (before)
config.plugins.push(new rspack.DefinePlugin(defineOptions), ...);
if(contribs.define){
  for(const [k,v] of Object.entries(contribs.define)){
    if(!allowed.has(k)) continue;
    defineOptions[k]=v; // ← too late, plugin already instantiated
  }
}
```

**After — allowlist before plugin:**
```ts
// packages/plugin/src/kernel.ts:1 + rsbuild.ts:351
const allowed = new Set(['DEBUG','DEPRECATED_UNIT_TEST','process.env.NODE_ENV']);
for(const [k,v] of Object.entries(contribs.define??{})){
  if(k.startsWith('RSPFX_')||!allowed.has(k)) continue;
  define[k]=v;
}
config.plugins.push(new rspack.DefinePlugin(define)); // ← after loop
```

**Before — rspack missing resolve:**
```ts
// packages/plugin/src/rspack.ts:130-176 (before)
const ctx = createCompileContext({projectRoot, config:opts, entries, externals:[...findSpDependencies], ...});
ctx.swcContributions=[contributions];
const full = await createRspackConfig(ctx) as Configuration;
// only forwards output/module/optimization/devtool/plugins — missing resolve + userModuleRules
options.output={...options.output, ...full.output};
options.module={...options.module, rules:[...(options.module?.rules??[]), ...(full.module?.rules??[])]};
```

**After — overlay via kernel:**
```ts
// packages/plugin/src/kernel.ts:1
export function createKernel(opts:KernelOpts){
  return {
    compileContext(production, serveMode){ return createCompileContext({projectRoot:opts.root, config:opts.config, entries:kernel.entries, externals:kernel.externals, localizedAliases, fastRefresh:opts.fastRefresh, production, serveMode, build:opts.config.build}) },
    rspackConfig(ctx, userModuleRules){ return createRspackConfig({...ctx, userModuleRules}) },
    resolveContribs: (c, url)=>resolveContributionLoaders(c, url)
  }
}
// rspack.ts:129 now forwards full.resolve.alias + full.resolve.extensions + userModuleRules
```

Cache bust is the only user-visible one-time cost.

---

## 5.3 File-by-File Breakdown (Absolute Paths + Line Numbers)

### New file

* **`/Volumes/New Volume/code/spfx/packages/plugin/src/kernel.ts:1`** — Single kernel, <200 LOC. Exports:

```ts
export interface KernelOpts {
  root:string; config:RspfxConfig; project:ReadProjectResult; fastRefresh:boolean; mode:'build'|'dev'; originRef?:{value:string}; logger?:Logger
}
export interface Kernel {
  readonly externals:string[]; // collectExternals(root, project.externals, localizedResources)
  createCompileContext(opts:{production:boolean; serveMode:boolean}):CompileContext
  createRegenerator(opts:{origin:()=>string, refreshRuntime?:RefreshRuntime}):ManifestRegenerator
  createReload():ReloadController
  loadPreset(): Promise<{preset:FrameworkPreset, moduleUrl:string}>
  resolveContribs(c:Record<string,unknown>, url:string):Record<string,unknown>
  cssRules(): {css:RuleSetRule, sass?:RuleSetRule}
  cacheVersion(): string // md5 8 hex
  writeStats(counts:Record<string,number>):void
  routes(regenerator:ManifestRegenerator, reload:ReloadController): Route[] // via dev-runtime/routes.ts
  startDevServer?(ctx:CompileContext, devOpts:DevServerOptions):Promise<StartDevServerResult> // re-export for rspack adapter
}
export function createKernel(opts:KernelOpts): Kernel
```

  Internals: at `:20` compute `externals = collectExternals(opts.root, opts.project.externals, opts.project.localizedResources)` (`shared.ts:19`); at `:30` `cacheVersion = createHash('md5').update(JSON.stringify({framework:opts.config.framework, spfxVersion:opts.config.version, build:opts.config.build})).digest('hex').slice(0,8)`; at `:45` `createCompileContext` calls `dev-runtime/project.ts:748`; at `:60` `cssRules` imports `rspfxCssInlineRule/rspfxSassRule` from `compiler-rspack/helpers/css.ts:1`; at `:75` `loadPreset` calls `dev-runtime/project.ts:784`.

### Modified files

* **`/Volumes/New Volume/code/spfx/packages/compiler-rspack/src/config.ts:1-317`**
  - `:1-4` add import `import {createHash} from 'node:crypto'` already at `:3`, keep `computeUniqueName` at `:81-90`.
  - `:18-30` keep `BUILD_TIME_ALIASES` at `:15-19` but export unchanged.
  - `:47-65` keep `tryResolve/hasPostcssConfigFile` but dedupe later via `helpers/css.ts`.
  - `:81-90` `computeUniqueName` keep; add `export function cacheVersionHash(framework, spfxVersion, build):string` helper for reuse in kernel.
  - `:92-145` `createRspackConfig(ctx, userModuleRules?)` keep signature but document `userModuleRules` from `plugin/src/rspack.ts:143` forwarded via `ctx.userModuleRules` at `:134`. Ensure `BUILD_TIME_ALIASES` injected at `:140` unconditionally.
  - `:212-249` CSS/SCSS inline blocks **DELETED** ( `:212-228` `cssUse`, `:234-248` `scssUse` ) and replaced with:

```ts
import { rspfxCssInlineRule, rspfxSassRule } from './helpers/css.js';
if(cssEnabled) rules.push(rspfxCssInlineRule(ctx.projectRoot));
if(scssEnabled) rules.push(rspfxSassRule(ctx.projectRoot));
```

  Keep `POSTCSS_CONFIG_FILES` dedup: `config.ts:37` list becomes import from `helpers/css.ts:8`.
  - `:259-283` keep `output` but add at `:275-283`:

```ts
output:{
  ...,
  assetModuleFilename:'assets/[hash][ext][query]',
  uniqueName: computeUniqueName(ctx),
  devtoolModuleFilenameTemplate:'webpack:///../[resource-path]'
}
```

  - `:302-313` `experiments` block at `:303-313` changed to versioned cache + lazyCompilation (see §5.5 types). From:

```ts
experiments: useCache ? { cache:{ type:'persistent', storage:{type:'filesystem', directory:'.rspack-cache'} } } : undefined
```

  To:

```ts
experiments: {
  cache: useCache ? { type:'persistent', version: cacheVersionHash(ctx.framework, ctx.build), buildDependencies:{config:[path.join(ctx.projectRoot,'rspack.config.ts'), path.join(ctx.projectRoot,'vite.config.ts'), path.join(ctx.projectRoot,'rsbuild.config.ts')]}, storage:{type:'filesystem', directory: path.join(ctx.projectRoot,'.rspack-cache')} } : undefined,
  lazyCompilation: ctx.serveMode ? { entries:false, imports:true } : undefined
}
```

* **`/Volumes/New Volume/code/spfx/packages/compiler-rspack/src/helpers/css.ts:1-103`**
  - `:38-68` `rspfxCssInlineRule` and `:70-103` `rspfxSassRule` become canonical. Keep `POSTCSS_CONFIG_FILES` at `:8-16` and `tryResolve` at `:18-27` as sole source. Export both. Add `export function shouldEmitCss(projectRoot):boolean` for `build.css!==false` gate. No behavior change, just dedupe target.
  - Delete duplicate logic from `config.ts:212` and `rsbuild.ts:376`.

* **`/Volumes/New Volume/code/spfx/packages/compiler-rspack/src/dev-server.ts:1-230`**
  - `:67-123` `createStaticMiddleware` keep double-decode loop at `:96-108`, `hasDotSegment` at `:63-65`, `contentTypeFor` at `:25-28`. Add `decodeIfEncoded` import from `@mbsks/rspfx-dev-runtime` for `%20` consistency (replace `safeDecodeURIComponent` ad-hoc).
  - `:143-230` `startDevServer` at `:143` add `experiments` passthrough verification: `compiler.options.experiments` already from `createRspackConfig` with `serveMode:true`.

* **`/Volumes/New Volume/code/spfx/packages/plugin/src/rspack.ts:1-193`**
  - `:1-24` imports: `import {createKernel} from './kernel.js'`; keep `createRspackConfig` import only for type re-export, remove direct `findSpDependencies`/`loadFrameworkPreset`/`resolveContributionLoaders` imports (kernel owns).
  - `:53-88` `class RspfxPlugin` keep `RSPFX_PLUGIN_MARKER` at `:60` but constructor stores `kernel?:Kernel`.
  - `:77-127` `apply` at `:77` now does:

```ts
const kernel = createKernel({root: this.projectRoot, config:this._options, project, fastRefresh:false, mode: compiler.options.mode==='production'?'build':'dev'});
this.kernel = kernel;
options.entry = Object.fromEntries(project.webParts.entries.map(e=>[e.name,{import:[e.import], library:{type:'amd', name:kernel.amdName(e)}}]));
options.externals = kernel.externals;
```

  Remove `collectExternals` private at `:184-192` (use kernel).
  - `:130-182` `configureCompiler` at `:130` **P0 FIX**: forward `userModuleRules` at `:134` via `(this._options as any).bundlerConfig?.module?.rules` (from `apps/cli/src/config.ts:86`) as second arg `createRspackConfig({...ctx, userModuleRules}, userModuleRules)` and forward `full.resolve` at `:165-167`:

```ts
const full = await kernel.rspackConfig(ctx, userModuleRules) as Configuration;
options.resolve = {...options.resolve, ...full.resolve, alias:{...options.resolve?.alias, ...full.resolve?.alias}};
```

  Previously `rspack.ts:143` missed both. Also keep `options.mode/output/module/optimization/devtool/plugins` overlay at `:162-176`.

* **`/Volumes/New Volume/code/spfx/packages/plugin/src/rsbuild.ts:1-505`**
  - `:1-38` imports: add `createKernel`, remove `collectExternals` direct, import `decodeIfEncoded`.
  - `:70-93` `hasPostcssConfig` **DELETED** (use `helpers/css.ts`); replace calls at `:378` with helper.
  - `:115-170` `rspfxRsbuild` closure: instantiate `kernel = createKernel({root, config:resolved, project:read()!, fastRefresh:..., mode:isDevServer?'dev':'build', originRef})`.
  - `:292` **`ensureCertificates` fix** (P0): inside `api.modifyRsbuildConfig` or `onBeforeStartDevServer`, add:

```ts
if(https && mode==='sharepoint'){
  const certs = await ensureCertificates(path.join(os.homedir(),'.rspfx/certs'), hostname); // mirrors vite.ts:292
  config.server = {...config.server, https:{key:certs.key, cert:certs.cert}};
}
```

  Previously missing entirely (Vite at `vite.ts:292` does, Rspack via `serve.ts:142` does).
  - `:320-371` `modifyRsbuildConfig` at `:320`: set `performance:{hints:'warning'}` and `source.alias` vs `resolve.alias` unify; set `tools.rspack` caching via `modifyRspackConfig`.
  - `:351-371` `modifyRspackConfig` at `:351` **P0 `platformOnlyExternal` fix**: add `import {isPlatformOnlyModule} from '@mbsks/rspfx-sharepoint-runtime/platform-modules'` and push `platformOnlyExternal` to `config.externals` when `local` preview or remove dead `localPreviewUnavailable` branch at `apps/cli/src/commands/dev.ts:27`. Keep `localizedResources` externals.
  - `:376-438` CSS blocks **DELETED** and replaced with `rspfxCssInlineRule/rspfxSassRule` imports.
  - `:445-500` `contribs.define` loop at `:486-498` moved **before** `new rspack.DefinePlugin(defineOptions)` at `:450`.
  - Keep `writeStatsJson` via `kernel.writeStats`.

* **`/Volumes/New Volume/code/spfx/packages/plugin/src/vite.ts:1-719`**
  - `:1-82` `%20` patch block **DELETED** (use `decodeIfEncoded` from dev-runtime at `path.ts:1`). Keep `VITE_ENV` at `:84-98`.
  - `:283-371` `createConfig` at `:283`: keep `define` allowlist at `:306-318`, but extract to kernel helper `allowedDefineKeys`.
  - `:459-467` **`Promise.all` parallel + AsyncLocalStorage fix** (P0 perf): replace serial `for(const [index, entry] of entries){ await withEnv(entry, ()=>vite.build(...))}` with:

```ts
import { AsyncLocalStorage } from 'node:async_hooks';
const als = new AsyncLocalStorage<{entry:BundleEntry}>();
await Promise.all(entries.map((entry, index)=> als.run({entry}, ()=> withEnvAsync(entry, async()=>{
  await (vite as ViteBuildApi).build({...await createConfig({minify:false,sourcemap:true, emptyOutDir:index===0})})
}))));
```

  Or pass `amdId` param directly (kernel option) to avoid global `process.env[VITE_ENV.entry]` mutation. Add `optimizeDeps: {cacheDir: path.join(root,'.vite'), include:['react','react-dom']}` cache.
  - `:618-677` `decodeIfEncoded`/`importViteFrom` keep but delegate decode to helper; remove triple-decode loops.

* **`/Volumes/New Volume/code/spfx/packages/plugin/src/shared.ts:1-48`**
  - Keep `amdName` at `:7-9`, `computeUniqueName` at `:11-17`, `collectExternals` at `:19-31`, `writeStatsJson` at `:33-48`. Kernel will re-export these; `shared.ts` stays for Rsbuild/Vite reuse but `rspack.ts` no longer duplicates.

* **`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/project.ts:748-800`**
  - `:748-777` `createCompileContext` keep; kernel will call it with `userModuleRules` passthrough.
  - Keep `loadFrameworkPreset`/`resolveContributionLoaders` but kernel wraps them.

* **`/Volumes/New Volume/code/spfx/packages/dev-runtime/src/routes.ts:1`** / `path.ts:1` reused from Phase 4 (shared route + static folder handling `dev-server.ts:67` + `serve.ts:262-267`).

---

## 5.4 Ordered Implementation Steps

1. **Create `kernel.ts`** (`packages/plugin/src/kernel.ts:1`): scaffold `KernelOpts/Kernel`, implement `collectExternals`, `cacheVersion`, `createCompileContext`, `cssRules`, `loadPreset`, `writeStats`. Test `kernel.test.ts` (no fs): `cacheVersion` stable for same inputs, changes on framework switch. ~1d.
2. **Dedup CSS** (`compiler-rspack/src/helpers/css.ts:38`, `config.ts:212`, `rsbuild.ts:376`): delete inline `cssUse/scssUse` at `config.ts:212-248` and `rsbuild.ts:376-438`, import `rspfxCssInlineRule/rspfxSassRule`. Unify `POSTCSS_CONFIG_FILES` at `helpers/css.ts:8`. Test `config.test.ts` snapshot rules unchanged. ~0.5d.
3. **Fix P0 `rspack.ts` resolve/userModuleRules** (`plugin/src/rspack.ts:143`): forward `full.resolve` and `userModuleRules` via kernel. Add parity fixture `modern-search` with `localizedAliases` asserting alias appears in `compiler.options.resolve.alias`. ~1d.
4. **Fix P0 Rsbuild DefinePlugin order** (`plugin/src/rsbuild.ts:486`): move allowlist loop before `new DefinePlugin`. Add `rsbuild.test.ts` spy that `define.DEBUG` appears in `DefinePlugin` definitions. ~0.5d.
5. **Fix P0 Rsbuild certs** (`plugin/src/rsbuild.ts:292`): wire `ensureCertificates` when `https && mode==='sharepoint'` (mirrors `vite.ts:292`, `serve.ts:142`). Test `rsbuild.test.ts` `https:true` path stubs `ensureCertificates`. ~0.5d.
6. **Fix P0 Rsbuild platformOnlyExternal** (`plugin/src/rsbuild.ts:351` vs `compiler-rspack/src/config.ts:25`, `dev-runtime/src/serve.ts:399`): add `platformOnlyExternal` external or remove `localPreviewUnavailable` at `apps/cli/src/commands/dev.ts:27`. Test `externals.test.ts` includes `@msinternal/*`. ~0.5d.
7. **Versioned cache + lazyCompilation** (`compiler-rspack/src/config.ts:303-314`): implement `version=hash8(...)`, `buildDependencies.config`, `lazyCompilation:{entries:false,imports:true}` dev-only, `assetModuleFilename`, `uniqueName`, `devtoolModuleFilenameTemplate`. Test `config.test.ts` stale-cache repro: switch `react→vue` changes `version`. ~1.5d.
8. **Rsbuild conventions** (`plugin/src/rsbuild.ts:320-371`): set `performance:{hints:'warning'}`, map `resolve.alias→source.alias`, `server.hmr`, `tools.rspack` unified via kernel. Add `parity.test.ts` asserting `dist/*.js` header `define('id_version'` identical across bundlers. ~1d.
9. **Vite parallel + AsyncLocalStorage** (`plugin/src/vite.ts:461`): parallel `Promise.all`, `AsyncLocalStorage` for `amdId`, `optimizeDeps.cacheDir`. Benchmark `modern-search` 4-entry build time. ~1.5d.
10. **Rsbuild parity + routes share** (`plugin/src/shared.ts`, `dev-runtime/src/routes.ts`): share `routes` + `staticFolders` via `routes.ts` helper; verify `serve.ts:246-267` and `vite.ts:493` and `rsbuild.ts:190` use same static folders. ~0.5d.
11. **Parity test hardening** (`packages/plugin/tests/parity.test.ts:1` manifests hash, `.sppkg` header, asset naming): run `pnpm build` on `examples/shadcn` with `rspack`, `vite`, `rsbuild`; assert `dist/*.js` starts with `define('` and `assets` naming. Cold start bench `-40%` with `lazyCompilation`. ~1d.

Total ~10d, parallelizable with Phase 6 Rust.

---

## 5.5 Types / Data Structures

```ts
// packages/plugin/src/kernel.ts:1
import type { RspfxConfig } from '@mbsks/rspfx-core';
import type { CompileContext, BundleEntry, LocalizedResource, DevServerOptions } from '@mbsks/rspfx-compiler-rspack';
import type { RspfxPluginOptions } from './types.js';

export interface KernelOpts {
  root: string;                 // projectRoot
  config: RspfxConfig;          // resolved via resolveConfig at rspack.ts:74 / rsbuild.ts:118 / vite.ts:276
  project: ReadProjectResult;   // from readProject at project.ts:387
  fastRefresh: boolean;         // config.dev.fastRefresh || RSPFX_FAST_REFRESH
  mode: 'build'|'dev';
  originRef?: { value:string }; // shared origin string (serve.ts:155 or vite.ts:430)
  logger?: Logger;              // injectable (diagnostics/logger.ts:29)
}

export interface Kernel {
  readonly externals: string[]; // findSpDependencies(root).keys + project.externals + localizedResource names
  amdName(entry:BundleEntry): string; // `${id}_${version}` at shared.ts:7
  uniqueName(): string;               // computeUniqueName at shared.ts:11 / config.ts:81
  createCompileContext(opts:{production:boolean; serveMode:boolean; userModuleRules?:unknown[]}): CompileContext;
  createManifestRegenerator(opts:{origin:()=>string; refreshRuntime?:RefreshRuntime}): ManifestRegenerator; // manifests.ts:39
  createReload(): ReloadController;   // reload.ts:18 push-based
  resolveContributionLoaders(c:Record<string,unknown>, url:string):Record<string,unknown>; // project.ts:813
  loadPreset(): Promise<{preset:FrameworkPreset; moduleUrl:string}>; // project.ts:784
  cacheVersion(): string;             // 8-hex md5 of {framework, spfxVersion, build.sourcemap|minify|splitChunks}
  lazyCompilation(): { entries:false; imports:true } | undefined; // dev only
  writeStats(counts:Record<string,number>): void; // shared.ts:33
  sharedRoutes(reg:ManifestRegenerator, reload:ReloadController): {routes:DevServerOptions['routes'], staticFolders:DevServerOptions['staticFolders']};
}

// packages/compiler-rspack/src/config.ts:92 (extended)
export async function createRspackConfig(ctx: CompileContext & { userModuleRules?: unknown[] }): Promise<unknown>;
// ctx.framework used for BUILD_TIME_ALIASES at config.ts:140 + SOLID_REFRESH_STUB at :141
// experiments at config.ts:302 now:
export interface RspackExperiments {
  cache?: { type:'persistent'; version:string; buildDependencies:{config:string[]}; storage:{type:'filesystem'; directory:string} };
  lazyCompilation?: { entries:boolean; imports:boolean };
}

// Unified output (config.ts:275)
export interface UnifiedOutput {
  filename:'[name].js';
  chunkFilename:'chunk.[name].js';
  assetModuleFilename:'assets/[hash][ext][query]';
  uniqueName:string; // computeUniqueName(ctx)
  devtoolModuleFilenameTemplate:'webpack:///../[resource-path]';
  chunkLoadingGlobal:`webpackJsonp_${string}`;
}

// Cache version input
export type CacheVersionInput = Pick<RspfxConfig,'framework'|'version'> & { build: Pick<BuildConfig,'sourcemap'|'minify'|'splitChunks'|'outDir'> };
export function cacheVersionHash(input:CacheVersionInput): string; // createHash('md5').update(JSON.stringify(input)).digest('hex').slice(0,8)
```

Vite isolation either via `AsyncLocalStorage<BundleEntry>` or kernel param `amdId` threading (prefer param to avoid `process.env` mutation at `vite.ts:599-616` `withEnv`).

---

## 5.6 Migration Notes

* One-time cache bust: first build after upgrade recompiles cold (`.rspack-cache` version change). No manual `rm -rf`. `RSPFX_CACHE=1` still opts-in for CI production cache.
* `rspack build`/`vite build`/`rsbuild build` now identical output: if you checked `dist/*.js` hashes in artifacts, update golden (`parity.test.ts` hashes).
* Custom `rspack.config.ts` `module.rules` (`bundlerConfig.module.rules` at `apps/cli/src/config.ts:86`) now forwarded—previously silently dropped on `rspack.ts:143` path, now applied. If you had duplicate rules, dedup.
* Rsbuild users adding `dev.tenantUrl` now get HTTPS certs (previously only Vite/Rspack). If you saw `ERR_SSL` in `rsbuild dev --mode sharepoint`, it now auto-provisions via `manifest-server` `ensureCertificates` at `rsbuild.ts:292`.
* `LOCAL_PREVIEW_UNAVAILABLE` dead branch at `apps/cli/src/commands/dev.ts:27` removed or externalized—no flag.
* No `pnpm build` change; still `tsc` to `dist/` ESM with `.js` imports (`tsconfig.build.json` `paths:{}` empty).

---

## 5.7 Exit Criteria (Functional)

* `packages/plugin/tests/parity.test.ts:1` passes: `dist/my-webpart.js` header `define('xxxxxxxx-xxxx-..._1.0.0'` plus `SPFX_PUBLIC_PATH_SENTINEL` sentinel replaced identically for `rspack` vs `rsbuild` vs `vite`; `assets/` naming `assets/[hash][ext]` not `[name].css` stray.
* `packages/compiler-rspack/src/config.test.ts` snapshot: `rspfxCssInlineRule(root)` imported once; no inline `cssUse` at `config.ts:212` remains.
* `packages/plugin/src/rspack.test.ts`: `userModuleRules` (`[{test:/\.foo$/}]` from `bundlerConfig.module.rules`) appears in `compiler.options.module.rules` after `configureCompiler`; `full.resolve.alias` (`localizedAliases` + `BUILD_TIME_ALIASES` at `config.ts:140`) appears in `compiler.options.resolve.alias`.
* `packages/plugin/src/rsbuild.test.ts`: `rspack.DefinePlugin` receives `DEBUG` after allowlist loop (spy on `DefinePlugin` ctor); `ensureCertificates` called when `https===true && mode==='sharepoint'`; `platformOnlyExternal` in `config.externals` for local preview.
* Caching: `modern-search` (4 entries) cold start with `experiments.lazyCompilation` is −40% vs baseline `bench/bench.mjs:59` (`cold 633ms` target `~380ms`), recompile still `~68ms`. Switching `rspfx.config.ts` `framework: 'react'→'vue'` busts `.rspack-cache` (version hash changes, next build misses cache then repopulates).
* `packages/plugin/src/vite.test.ts`: `Promise.all` entries built in parallel (assert durations overlap via fake timer), `AsyncLocalStorage` isolates `VITE_ENV.amdId` (concurrent `withEnv` no race).
* `pnpm build` + `pnpm test` (vitest) green with new `kernel.ts`.

---

## 5.8 Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **Kernel over-abstraction (3 adapters regress)** | High | Kernel is ~180 LOC facades, not classes. Each adapter keeps its own `modifyRsbuildConfig` / `config()` hook but delegates externals/rules/preset to kernel. Gate: `parity.test.ts` runs all 3 bundlers on `examples/shadcn`. |
| **Persistent cache poisoning (stale on upgrade)** | High | `version` includes `framework+spfxVersion+build` hash; `buildDependencies.config` lists `rspack.config.ts`/`vite.config.ts`/`rsbuild.config.ts`. Test: change `framework` and assert version changes. |
| **LazyCompilation breaks existing dev flow** | Med | `entries:false` preserves entry chunks (SPFx needs `[name].js` always); only `imports:true` lazy. Guard: `experiments.lazyCompilation` only when `serveMode===true`. |
| **CSS dedup breaks SCSS opt-in** | Med | `rspfxSassRule` still checks `tryResolve('sass')` at `helpers/css.ts:81`; returns rule pointing at `sass-loader` (compile error if missing) matching old behavior. Test both `css:true` and `scss:false`. |
| **Vite parallel race on `process.env`** | High | Use `AsyncLocalStorage` or thread `amdId` param directly into `createConfig({amdId})` instead of mutating `process.env[VITE_ENV.amdId]` at `vite.ts:601`. Keep `withEnv` shim for compat but mark deprecated. |
| **Asset filename migration breaks CDN** | Med | `assetModuleFilename='assets/[hash][ext][query]'` vs old implicit; keep `releaseDir` manifest `cdnBasePath` at `release.ts:47` stable. Only `dist/` internal naming changes. |
| **Fallback when `node_modules/@microsoft` missing** | Low | `collectExternals` at `shared.ts:19` still falls back to `reference/sp-component-ids.json` via `manifest-generator` `findSpDependencies`. Kernel does not hard-require `node_modules`. |

---

## 5.9 Effort Estimate

**10d ideal, ~12d with parity hardening.**

| Step | Days |
|---|---|
| kernel scaffolding + externals | 1 |
| CSS dedup + helpers | 0.5 |
| P0 rspack resolve/userModuleRules | 1 |
| P0 rsbuild define/cert/platformOnlyExternal | 1.5 |
| Cache version + buildDependencies | 1.5 |
| lazyCompilation + output filenames | 1 |
| Rsbuild conventions unify | 1 |
| Vite parallel + AsyncLocalStorage | 1.5 |
| Parity tests + bench | 1 |

Phase 4 and 5 together **20d** critical path; with 2 engineers TS kernel (Phase 5) can overlap Rust (Phase 6) per DAG, but Phase 5 must follow Phase 4 store landing.



---
