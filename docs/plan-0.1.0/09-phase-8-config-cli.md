# Phase 8 — Config Schema & CLI

> **Dependency:** Phase 1 (`Result<T,E>`, `RspfxErrorCode` branded, `tryResolveConfig` shim, `createRSPFX` builder). **No CI changes** — no `.github/workflows`, no `type-coverage`/`depcruise` CI gates. Verification is local `pnpm build && pnpm typecheck && pnpm test && node bench/bench.mjs`.

### Goal & Rationale

**Goal:** Replace the permissive `resolveConfig`/`loadConfig` dust-acceptance with a strict, `valibot`-validated, `Result`-typed config pipeline. Every keystroke in `rspack.config.ts` / `vite.config.ts` / `rsbuild.config.ts` validates locally with typed `Issue[]`, the CLI surfaces branded `RspfxErrorCode` with exhaustive `switch`, and `rspfx migrate --to 0.1` fixes consumers mechanically. `core` stays zero-deps — validation lives in `core` via `valibot` (single dep, allowed; Phase 1 `core` zero-deps exemption ends) or stays deps-free by moving schema to `plugin-api` — decision below.

**Rationale (5 lenses):**

* **TanStack (type-safe):** `packages/core/src/config.ts:103` `resolveConfig(config: RspfxConfig | (Partial<RspfxConfig> & Record<string,unknown>))` accepts dust (`sourcemap` top-level, `teams: {foo:1}` unknown shape) that busts Phase 5 cache keys. `defineConfig` at `:64` ` (c:RspfxConfig)=>RspfxConfig` widens `framework:'react'` to `string`. Svelte/runes `defineWebPart<TProps>` (Phase 2) needs literal preservation. `apps/cli/src/config.ts:88` `resolveConfig(plugin[RSPFX_PLUGIN_OPTIONS])` throws untyped, `config.ts:77` `rawDefault is function ? rawDefault({})` is `unknown` cast to `RspfxBundlerPluginLike`.
* **Rust (Result/ownership):** `apps/cli/src/config.ts:58` `throw new RspfxError('CONFIG_NOT_FOUND',...)` is stringly; `cli.ts:25` `switch(err.code)` non-exhaustive. `resolveConfig` at `core/config.ts:104` `throw new Error('"name" is required')` is not `RspfxError`. Need `Result<RspfxConfig,Issue[]>` + `RspfxErrorCode` exhaustive chain.
* **Solid (owner):** `apps/cli/src/config.ts:55` `loadConfig` is singleton per `process.cwd()` with `fsCachePath: path.join(process.cwd(),'node_modules/.cache/jiti')` at `:73` — cache poisons parallel tests. Should be `createRSPFX()`-owned instance (Phase 1 `RSpfxInstance`) threaded via `LoadedProject.rspfx`.
* **Svelte (compiler):** `jiti` at `apps/cli/src/config.ts:70` `createJiti(import.meta.url,{fsCache:true})` transpiles TS config files — no schema error positions. `valibot` parse errors must map to `Issue {path,message,code}` with file:line hint.
* **Rspack/Rsbuild (cache/lazy):** Loose `teams` boolean|object at `core/config.ts:108-113` and unvalidated `deploy` cause stale `experiments.cache.version` hash. Strict schema yields stable `{framework, spfxVersion, build}` for Phase 5 `cacheVersionHash`.

**Non-goal:** No new framework, no bundler kernel change (Phase 5), no `rspfx.config.ts` legacy (already removed `ARCHITECTURE.md:136` — `config flow: CLI prefers explicit bundler config ... rspfx.config.ts is removed`).

### Breaking Changes (before/after)

#### 1. `defineConfig` + `resolveConfig` — `packages/core/src/config.ts:4,64,103`

**Before:**
```ts
// packages/core/src/config.ts:4
export type FrameworkId = 'vanilla'|'react'|'solid'|'vue'|'preact'|'svelte' | (string & {});
// packages/core/src/config.ts:64
export function defineConfig(config: RspfxConfig): RspfxConfig { return config; }
// packages/core/src/config.ts:103
export function resolveConfig(config: RspfxConfig | (Partial<RspfxConfig> & Record<string,unknown>)): RspfxConfig {
  if(!config.name) throw new Error('"name" is required in the bundler config (rspack.config.ts)');
  // ... dust passthrough, teams boolean|object coerce at :108-113, Record<string,unknown> unknown keys ignored
  return { name: config.name, framework: config.framework ?? 'vanilla', ... };
}
```

**After:**
```ts
// packages/core/src/config.ts:4 — aligns with Phase 1 FrameworkIdCore + branded custom
export type FrameworkIdCore = 'vanilla'|'react'|'solid'|'preact'|'vue'|'svelte';
export type FrameworkId = FrameworkIdCore | (string & { __custom?: never });
// Phase 8 adds schema + const generic
import * as v from 'valibot';
import { ok, err, type Result } from '@mbsks/rspfx-diagnostics/result.js'; // or ./result.js if core owns Result

export const RspfxConfigSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  version: v.optional(v.pipe(v.string(), v.regex(/^\d+\.\d+\.\d+/))),
  framework: v.custom<FrameworkId>((x)=> typeof x==='string' && x.length>0, 'FrameworkId required'),
  spfxVersion: v.picklist(['1.20.0','1.21.1','1.22.0','1.23.0'] as const), // from versions.ts SPFX_TARGETS
  dev: DevConfigSchema,   // port 1024-65535, hostname, https boolean, etc.
  build: BuildConfigSchema, // sourcemap/minify/splitChunks deprecated but still validated as boolean
  paths: v.optional(PathsConfigSchema),
  deploy: v.optional(DeployConfigSchema),
  teams: v.optional(v.union([v.boolean(), v.object({enabled: v.optional(v.boolean())})])),
});
export type RspfxConfig = v.InferOutput<typeof RspfxConfigSchema>;

export function defineConfig<const T extends RspfxConfig>(config: T): T { return config; }
export function parseRSPFXConfig(raw: unknown): Result<RspfxConfig, Issue[]> {
  const r = v.safeParse(RspfxConfigSchema, raw);
  return r.success ? ok(r.output) : err(r.issues.map(toIssue));
}
export function tryResolveConfig(raw: unknown): Result<RspfxConfig, Issue[]> {
  // merges configDefaults (core/config.ts:68) before validation
  return parseRSPFXConfig(merged);
}
/** @deprecated use tryResolveConfig — throws on Err for compat */
export function resolveConfig(config: Partial<RspfxConfig>): RspfxConfig {
  const res = tryResolveConfig(config);
  if(!res.ok) throw new RspfxError(RspfxErrorCode.CONFIG_VALIDATION_FAILED, formatIssues(res.error));
  return res.value;
}
export interface Issue { path: (string|number)[]; message: string; code: RspfxErrorCode; }
```

**Break:** `resolveConfig` no longer accepts `& Record<string,unknown>` — unknown keys `strictObject` error (`Issue {path:['unknownKey'], code:CONFIG_VALIDATION_FAILED}`). Throw changes from bare `Error` to `RspfxError` branded. `defineConfig` preserves literal via `const T` — `typeof cfg.framework` now `'react'` not `string`; passing widened `string` variable infers `string` and fails `FrameworkRegistry` discriminant without `as const`.

#### 2. `apps/cli/src/config.ts:55` `loadConfig` — Result + instance

**Before:**
```ts
// apps/cli/src/config.ts:10
export interface LoadedProject { config: RspfxConfig; bundler: BundlerId; configFile: string; userModuleRules?: unknown[]; }
// apps/cli/src/config.ts:55
export async function loadConfig(projectRoot:string): Promise<LoadedProject> {
  const found = findConfigFile(projectRoot); // scans rspack/vite/rsbuild at :17-24
  if(!found) throw new RspfxError('CONFIG_NOT_FOUND', `No rspack.config.ts ... in ${projectRoot}`);
  const jiti = createJiti(import.meta.url,{interopDefault:true, fsCache:true, fsCachePath: path.join(process.cwd(),'node_modules/.cache/jiti')});
  const mod = await jiti.import(path.resolve(projectRoot, found.file));
  const rawDefault = (mod as {default?:unknown}).default ?? mod;
  const bundlerConfig = typeof rawDefault==='function' ? rawDefault({}) : rawDefault;
  const plugin = findRspfxPlugin(bundlerConfig); // scans RSPFX_PLUGIN_MARKER at :35-53
  if(!plugin) throw new RspfxError('PLUGIN_NOT_FOUND', `No rspfx plugin found in ${found.file}...`);
  return { config: resolveConfig(plugin[RSPFX_PLUGIN_OPTIONS]), bundler: found.bundler, configFile: found.file, userModuleRules: ... };
}
```

**After:**
```ts
// apps/cli/src/config.ts:10
export interface LoadedProject {
  readonly config: RspfxConfig;
  readonly bundler: BundlerId;
  readonly configFile: string;
  readonly userModuleRules?: readonly unknown[];
  readonly plugin: RspfxBundlerPluginLike;
  readonly bundlerConfig: unknown; // raw for migrate codemod
  readonly rspfx: RspfxInstance;   // Phase 1 instance, owns plugins
}
export async function loadConfig(projectRoot:string, opts?:{ jitiCache?: boolean }): Promise<LoadedProject> {
  const found = findConfigFile(projectRoot);
  if(!found) throw new RspfxError(RspfxErrorCode.CONFIG_NOT_FOUND, `No rspack.config.ts / vite.config.ts / rsbuild.config.ts found in ${projectRoot}. Run "rspfx new" to scaffold.`);
  const jiti = createJiti(import.meta.url,{interopDefault:true, fsCache: opts?.jitiCache ?? true, fsCachePath: path.join(projectRoot,'node_modules/.cache/jiti')}); // fix: projectRoot not process.cwd()
  const mod = await jiti.import(path.resolve(projectRoot, found.file));
  const rawDefault = (mod as {default?:unknown}).default ?? mod;
  const bundlerConfig = typeof rawDefault==='function' ? await rawDefault({}) : rawDefault; // await if async factory
  const plugin = findRspfxPlugin(bundlerConfig);
  if(!plugin) throw new RspfxError(RspfxErrorCode.PLUGIN_NOT_FOUND, `No rspfx plugin found in ${found.file}...`);
  const parsed = tryResolveConfig(plugin[RSPFX_PLUGIN_OPTIONS]); // from @mbsks/rspfx-core
  if(!parsed.ok) throw new RspfxError(RspfxErrorCode.CONFIG_VALIDATION_FAILED, formatIssues(parsed.error), parsed.error as unknown as Error);
  const rspfx = createRSPFX({ plugins: discoverPlugins(projectRoot, bundlerConfig) }); // Phase 1 builder
  return { config: parsed.value, bundler: found.bundler, configFile: found.file, plugin, bundlerConfig, userModuleRules: extractRules(bundlerConfig), rspfx };
}
export function formatIssues(issues: Issue[]): string { return issues.map(i=> `${i.path.join('.')}: ${i.message} (${i.code})`).join('\n'); }
```

**Break:** `loadConfig` now throws `RspfxErrorCode.CONFIG_VALIDATION_FAILED` with `Issue[]` cause on dust (`unknownKey`) — previously silently ignored. `fsCachePath` moves from `process.cwd()` to `projectRoot` (affects monorepo `pnpm -r` where cwd != projectRoot). Return type gains `plugin`/`bundlerConfig`/`rspfx` — downstream `apps/cli/src/commands/build.ts:104`, `dev.ts:27`, `package.ts`, `doctor.ts`, `analyze.ts` and `packages/plugin/src/rspack.ts:77` must consume `LoadedProject.rspfx` not global `getPlugins()`.

#### 3. CLI error exhaustiveness — `apps/cli/src/cli.ts:21-41`, `apps/cli/src/commands/*.ts`

**Before:**
```ts
// apps/cli/src/cli.ts:21
try { await cmd.run() } catch(e){ if(e instanceof RspfxError){ switch(e.code){ case 'CONFIG_NOT_FOUND': ... default: logger.error(e.message) } } }
```

**After:**
```ts
import { RspfxError, RspfxErrorCode } from '@mbsks/rspfx-diagnostics';
import { formatIssues } from './config.js';
try { await cmd.run() } catch(e){
  if(e instanceof RspfxError){
    switch(e.code){
      case RspfxErrorCode.CONFIG_NOT_FOUND: logger.error(`Config missing: ${e.message}`); process.exitCode=1; break;
      case RspfxErrorCode.PLUGIN_NOT_FOUND: logger.error(`Plugin missing: ${e.message}`); break;
      case RspfxErrorCode.CONFIG_VALIDATION_FAILED: logger.error(formatIssues((e.cause as Issue[]) ?? [])); break;
      case RspfxErrorCode.BUILD_FAILED: /* ... */ break;
      default: const _exhaustive: never = e.code; logger.error(e.message);
    }
  }
}
```

**Break:** String literal `'CONFIG_NOT_FOUND'` comparison still works at runtime (branded `string & {__brand}`) but typechecks now require `RspfxErrorCode.CONFIG_NOT_FOUND`; missing new code `CONFIG_VALIDATION_FAILED` without `switch` update is a type error (`never` assignment).

#### 4. `rspfx migrate --to 0.1` + `doctor --fix` — `apps/cli/src/commands/migrate.ts:1`, `doctor.ts:1`

**Before:** `migrate.ts` synthesized bundler config from `config/config.json` + `config/package-solution.json` + `package.json` and wrote backup `.rspfx/migrate-backup.json`; no codemod for `contributions→rspack`, `unknown[]`/`defineConfig` widening fixes at `packages/plugin-api` Phase 1.

**After:** `migrate.ts` gains `--to 0.1` (default) + `--dry-run` + `--revert`. Steps: 1) `loadConfig` with lenient parse, 2) jiti-load file text, 3) apply TS codemods via `ts-morph` or regex: rename `contributions`→`rspack`, add `satisfies FrameworkPreset<'id'>`, add `as const` on `framework`, remove `& Record<string,unknown>`, fix `fsCachePath`, inject `rspfx` instance threading helper. Writes backup once (`existsSync` guard). `doctor.ts` gains `--fix` that runs `ensureProjectConfigs` (made pure in Phase 4) + `valibot` validate + cert fix.

**Break:** `migrate --revert` restores from `.rspfx/migrate-backup.json` only if backup exists; running migrate twice without revert now errors (`RspfxErrorCode.MIGRATE_BACKUP_EXISTS`) instead of overwriting — safer but breaks scripts that ran `rspfx migrate` idempotently.

#### 5. `core` zero-deps relaxation

**Before:** `ARCHITECTURE.md:102` `core has zero dependencies` (enforced at `packages/core/package.json` `dependencies: {}`).

**After:** Option A (recommended): `core` gains single runtime dep `valibot@~1.0` (tiny, zero transitive deps, tree-shakable) — documented exception in `ARCHITECTURE.md:102` `core has zero dependencies except valibot for config schema` plus note in `docs/architecture.md:63`. Option B: keep `core` zero-deps and move `RspfxConfigSchema` to `@mbsks/rspfx-plugin-api` or `@mbsks/rspfx-diagnostics` which already may depend on `valibot`; `core` re-exports type only (`import type {RspfxConfig} from '@mbsks/rspfx-plugin-api'`). Pick A for locality — `defineConfig` lives in `core`.

**Break:** `pnpm build` graph now has `core -> valibot`; `core` no longer zero-deps audited at Phase 9; consumers who vendored `core` assuming zero deps must allow one.

### File-by-File Task Breakdown

| # | Absolute Path | Lines | Action | Detail |
|---|---|---|---|---|
| 8.1 | `/Volumes/New Volume/code/spfx/packages/core/src/config.ts` | `1-141` | **Rewrite** | Add `valibot` imports at `1-3`; replace `FrameworkId` at `4` with `FrameworkIdCore` + branded custom; add schemas `FrameworkIdSchema`, `DevConfigSchema` (`port: v.pipe(v.number(), v.minValue(1024), v.maxValue(65535))`, `https: v.boolean()`, etc.), `BuildConfigSchema` (`sourcemap/minify/splitChunks: v.optional(v.boolean())` deprecated JSDoc retained), `PathsConfigSchema` (`srcDir` etc `v.optional(v.string())`), `DeployConfigSchema`, `TeamsConfigSchema`; define `RspfxConfigSchema = v.strictObject({...})` or `v.object` + `v.strictObject` wrapper to reject unknown keys; export `type RspfxConfig = v.InferOutput<...>` (replaces manual interface at `50-62`); keep `configDefaults` at `68-91` but derive `Required` via schema defaults; change `defineConfig` at `64` to `defineConfig<const T extends RspfxConfig>(c:T):T`; add `Issue` type + `toIssue` mapper + `parseRSPFXConfig`/`tryResolveConfig`/`resolveConfig` shim at `103-141`; remove `& Record<string,unknown>` widening. Lines `93-101` `resolvePathDefaults` stays but validates via `v.parse(PathsConfigSchema, paths)`. |
| 8.2 | `/Volumes/New Volume/code/spfx/packages/core/src/versions.ts` | `1-30` | **Reference** | Export `SPFX_TARGETS = ['1.20.0','1.21.1','1.22.0','1.23.0'] as const` for `v.picklist` in config schema; no logic change. Ensure `SPFX_DEFAULT_TARGET` at `core/config.ts:1` still imported. |
| 8.3 | `/Volumes/New Volume/code/spfx/packages/core/src/index.ts` | `1-21` | **Export** | Re-export `RspfxConfigSchema`, `parseRSPFXConfig`, `tryResolveConfig`, `Issue`, `FrameworkIdCore`; keep `defineConfig` generic. Add `export type {Issue}`. |
| 8.4 | `/Volumes/New Volume/code/spfx/packages/core/package.json` | `12-18` | **Dep** | Add `dependencies: { "valibot": "^1.0.0" }` if Option A; or keep zero-deps and add `peerDependencies` note. Update `package.json` `sideEffects: false`. Document exemption in `docs/architecture.md:63` comment. |
| 8.5 | `/Volumes/New Volume/code/spfx/apps/cli/src/config.ts` | `1-93` | **Refactor** | At `1-6` imports: add `tryResolveConfig, type Issue` from `@mbsks/rspfx-core`, `RspfxErrorCode` from `@mbsks/rspfx-diagnostics`, `createRSPFX` from `@mbsks/rspfx-plugin-api` (Phase 1 instance). At `10-15` extend `LoadedProject` to include `plugin`, `bundlerConfig`, `rspfx: RspfxInstance`. At `26-33` `findConfigFile` keep candidates `17-24` but add `rspack.config.mjs`/`vite.config.mjs` probe (future-proof). At `35-53` `findRspfxPlugin` keep `RSPFX_PLUGIN_MARKER` scan but add recursive scan for `plugins` that are functions returning plugins (Rsbuild `plugins: [rspfxRsbuild()]` factory case). At `55-93` `loadConfig`: change `fsCachePath` at `73` from `process.cwd()` to `projectRoot`; make `rawDefault` factory `await`-aware; call `tryResolveConfig` instead of `resolveConfig` at `88`; on `!parsed.ok` throw `RspfxErrorCode.CONFIG_VALIDATION_FAILED` with `formatIssues`; instantiate `rspfx = createRSPFX({plugins: discoverPlugins(bundlerConfig)})` and return extended `LoadedProject`. Extract helpers `formatIssues(issues:Issue[]):string` and `discoverPlugins(bundlerConfig):RspfxExtension[]` (scan for marker). At `86` `userModuleRules` extraction keep `bundlerConfig.module?.rules` but type `readonly unknown[]`. |
| 8.6 | `/Volumes/New Volume/code/spfx/apps/cli/src/cli.ts` | `1-50` | **Exhaustive** | Import `RspfxErrorCode` at `6`; change `clipanion` or `citty` error handler at `21-41` to exhaustive `switch(err.code)` with `default: const _exhaustive: never = err.code`; add `CONFIG_VALIDATION_FAILED` branch that calls `formatIssues` from `./config.js`; ensure `process.exitCode` set. Add `logger` inject. |
| 8.7 | `/Volumes/New Volume/code/spfx/apps/cli/src/commands/build.ts` | `104` | **Thread** | Change `const {config} = await loadConfig(projectRoot)` to `const {config, rspfx, bundler} = await loadConfig(projectRoot)`; pass `rspfx` into `new RspfxPlugin({..., rspfx})` at `rspack`/`vite`/`rsbuild` paths; remove `getPlugins()` fallback. |
| 8.8 | `/Volumes/New Volume/code/spfx/apps/cli/src/commands/dev.ts` | `27` | Same | Thread `rspfx`; ensure `ensureProjectConfigs` explicit call (Phase 4 purity) before `readProject`; use `loaded.rspfx` for `startServe({rspfx})`. |
| 8.9 | `/Volumes/New Volume/code/spfx/apps/cli/src/commands/package.ts` | `1-60` | Same | Thread `rspfx`; `buildPackage` hooks use `rspfx.hooks.beforePackage` not global. |
| 8.10 | `/Volumes/New Volume/code/spfx/apps/cli/src/commands/doctor.ts` | `1-80` | **Enhance** | Add `--fix` flag; when `tryResolveConfig` fails, print `Issue.path` + `message`; with `--fix` run `ensureProjectConfigs` + `validateConfigs` + cert fix via `ensureCertificates` from `manifest-server`. |
| 8.11 | `/Volumes/New Volume/code/spfx/apps/cli/src/commands/migrate.ts` | `1-120` | **Codemod** | Add `--to 0.1` (default), `--dry-run`, `--revert`. Implement `runMigrate(projectRoot, opts)` that: loads file text via `fs.readFileSync(found.file)`, applies codemods (regex or `ts-morph`): `contributions\s*\(\)`→`rspack()`, add `satisfies FrameworkPreset<'x'>` where `FrameworkPreset` imported, add `as const` after `framework:'react'`, replace `Record<string,unknown>` dust, fix `fsCachePath`. Write backup `.rspfx/migrate-backup.json` only if not exists; `--dry-run` prints diff not writes; `--revert` restores backup. Throw `RspfxErrorCode.MIGRATE_BACKUP_EXISTS` if backup exists without `--revert`. |
| 8.12 | `/Volumes/New Volume/code/spfx/apps/cli/src/commands/new.ts` | `1-90` | **Scaffold** | Update scaffolds (`templates/*`) to emit `defineConfig({name, framework:'react' as const, ...} as const)` literal-preserving form; ensure `rspack.config.ts` template imports `defineConfig` from `@mbsks/rspfx-core` not local; set `dev.port` default `4321` via `configDefaults`. |
| 8.13 | `/Volumes/New Volume/code/spfx/apps/cli/src/commands/analyze.ts` | `1-70` | **Reuse** | Use `tryResolveConfig` for `analyze` path; surface `Issue[]` when `config.json` malformed. |
| 8.14 | `/Volumes/New Volume/code/spfx/packages/plugin/src/rspack.ts` | `53-193` | **Consume** | Constructor already accepts `rspfx?:RSpfxInstance` (Phase 1 1.22); now require `rspfx` from `LoadedProject` and remove deprecated `getPlugins()` fallback path at `~71`. Use `tryResolveConfig` for internal `resolveConfig` calls. |
| 8.15 | `/Volumes/New Volume/code/spfx/packages/plugin/src/vite.ts` | `298` | Same | Thread `rspfx`. |
| 8.16 | `/Volumes/New Volume/code/spfx/packages/plugin/src/rsbuild.ts` | `185` | Same | Thread `rspfx`. |
| 8.17 | `/Volumes/New Volume/code/spfx/packages/diagnostics/src/codes.ts` | `1-32` | **Extend** | Add `CONFIG_VALIDATION_FAILED: 'CONFIG_VALIDATION_FAILED'`, `MIGRATE_BACKUP_EXISTS: 'MIGRATE_BACKUP_EXISTS'` to `RspfxErrorCode` const object; branded type already from Phase 1. |
| 8.18 | `/Volumes/New Volume/code/spfx/packages/diagnostics/src/result.ts` | `1-40` | **Reuse** | No change; `Result<T,E>` helpers `ok/err` already from Phase 1; `Issue[]` is `E`. |
| 8.19 | `/Volumes/New Volume/code/spfx/docs/internal-api.md` | `1-...` | **Doc** | Add `RspfxConfigSchema` + `tryResolveConfig` + `defineConfig<const T>` signatures under `core`; document `LoadedProject.rspfx`. Reference not tutorial (per `docs/AGENTS.md:7`). One line per paragraph. Link to `CHANGELOG.md ## [0.1.0]` not history in doc. |
| 8.20 | `/Volumes/New Volume/code/spfx/docs/commands.md` | `1-...` | **Doc** | Add `rspfx migrate [--to 0.1] [--dry-run] [--revert]` flags; `rspfx doctor [--fix]` flag; env vars `RSPFX_LOG_LEVEL` etc stay at `docs/commands.md#environment-variables` (fact home per `docs/AGENTS.md:13`). No CI env changes. |
| 8.21 | `/Volumes/New Volume/code/spfx/docs/architecture.md` | `63,97` | **Doc** | Update `core zero-deps` note to `core has zero deps except valibot` if Option A; update config flow `File save → validate RspfxConfig → kernel cache version → rebuild` paragraph — one line per paragraph. |
| 8.22 | `/Volumes/New Volume/code/spfx/templates/*` | n/a | **Scaffold** | Regenerate `rspack.config.ts`, `vite.config.ts`, `rsbuild.config.ts` templates per framework to use `defineConfig<typeof schema>` literal form; verify `pnpm build` still emits ESM `.js` imports per `AGENTS.md` build rule `paths:{}` empty + `.js` imports. |
| 8.23 | `/Volumes/New Volume/code/spfx/bench/bench.mjs` | `59-119` | **No change** | Used for verification only; `BENCH_RUNS=3` median still captured to `reference/baseline-0.1.0.json` delta vs Phase 0. |

### Implementation Steps (ordered)

1. **Land `core` schema (no CLI yet)** — Edit `packages/core/src/config.ts:1-141` to add `valibot` schemas, `FrameworkIdCore`, `defineConfig<const T>`, `parseRSPFXConfig`/`tryResolveConfig`/`Issue` + shim `resolveConfig`. Keep `configDefaults` at `68-91` but derive from schema defaults. Run `pnpm typecheck` — expect `packages/core/tests/config.test.ts` (new) to fail until helper `toIssue` added; keep old `resolveConfig` throwing branch for compat. Verify `pnpm --filter @mbsks/rspfx-core build` emits `dist/config.js` with `.js` imports and `paths:{}` empty in `tsconfig.build.json` per `AGENTS.md` build rule. ~1.5d.

2. **Extend diagnostics codes** — Add `CONFIG_VALIDATION_FAILED`, `MIGRATE_BACKUP_EXISTS` to `packages/diagnostics/src/codes.ts:1-32` const object; branded type auto-updates; run `pnpm typecheck` — `apps/cli/src/cli.ts:25` exhaustive switch will error until new case added. ~0.25d.

3. **Refactor `apps/cli/src/config.ts:55`** — Implement extended `LoadedProject`, `formatIssues`, `discoverPlugins`, `fsCachePath: projectRoot` fix at `73`, `await rawDefault({})` at `77`, `tryResolveConfig` at `88`, `createRSPFX` at return. Keep `findConfigFile` candidates `17-24` but add `mjs` probe. Run `pnpm test` — `loadConfig` tests that mocked `jiti` must now assert `Issue[]` on dust; update fixtures with unknown key. ~1d.

4. **Thread `RSpfxInstance` through commands** — Edit `apps/cli/src/commands/build.ts:104`, `dev.ts:27`, `package.ts`, `doctor.ts`, `analyze.ts` to destructure `rspfx` from `loadConfig` and pass to `RspfxPlugin`/`rspfxVite`/`rspfxRsbuild`/`startServe`. Remove `getPlugins()` imports. Verify `pnpm build` + `pnpm test` parity `packages/plugin/tests/parity.test.ts:104` still byte-identical (no kernel change). ~1d.

5. **Exhaustive CLI handler** — Edit `apps/cli/src/cli.ts:21-41` to import `RspfxErrorCode`, add `CONFIG_VALIDATION_FAILED` branch using `formatIssues`, add `default: never` exhaustiveness. Test `cli.test.ts` that new code throws type error if `RspfxErrorCode` missing case. ~0.5d.

6. **Implement `rspfx migrate --to 0.1 --dry-run --revert`** — Create codemods in `apps/cli/src/commands/migrate.ts:1-120`: regex `/(contributions)\s*\(/g` → `rspack(`, inject `satisfies FrameworkPreset<'${framework}'>` after preset literal, inject `as const` on framework string, delete `& Record<string,unknown>`. Backup guard at `.rspfx/migrate-backup.json` via `fs.existsSync`. Test `migrate.test.ts` fixture: before file with `contributions` + `FrameworkPreset` untyped + `unknown[]` becomes after with `rspack` + `satisfies` + `as const` on dry-run. ~2d.

7. **Enhance `doctor --fix` + `new` scaffolds** — Add `--fix` at `apps/cli/src/commands/doctor.ts:1` that calls `ensureProjectConfigs` (Phase 4 pure) and re-validates via `tryResolveConfig`; update `apps/cli/src/commands/new.ts` templates to emit `defineConfig` literal form. Test `doctor.test.ts` `--fix` creates missing `config/serve.json` then validates. ~0.75d.

8. **Docs (reference only)** — Update `docs/internal-api.md` (package surfaces), `docs/commands.md` (flags + env vars fact home), `docs/architecture.md:63` (core deps note) per `docs/AGENTS.md` fact homes + one-line-per-paragraph + no history narration (`CHANGELOG.md` is history home). Add Agent Note `.agents/notes/implemented/config/2026-08-24-config-schema-cli.md` with header `# Agent Note: Config Schema & CLI` per `docs/AGENTS.md` verification rules (header line 1, blank line 2, `Status: implemented` line 3). Run `wc -w docs/AGENTS.md` budgets not enforced but link check: every `docs/commands.md#environment-variables` fragment must resolve. ~0.5d.

9. **Local verification gate** — Run `pnpm build` (all `packages/*/dist` ESM), `pnpm typecheck` (strict `noExplicitAny`), `pnpm test` (parallel forks — Phase 1 `singleFork:false` proof), `node bench/bench.mjs` on `examples/shadcn`/`examples/svelte` — median `recompile_median_ms` stable vs Phase 0 `reference/baseline-0.0.13.json`; capture `reference/baseline-0.1.0.json` delta. Run `rspfx migrate --dry-run` on fixture, `rspfx doctor --fix`, `rspfx build` with invalid `teams: {foo:1}` assert `CONFIG_VALIDATION_FAILED` Issue path. No CI.

### Data Structures / Types to Introduce

```ts
// packages/core/src/config.ts
import * as v from 'valibot';
import type { SpfxTarget } from './versions.js';
import { RspfxErrorCode } from '@mbsks/rspfx-diagnostics/codes.js'; // or branded string

export type FrameworkIdCore = 'vanilla'|'react'|'solid'|'preact'|'vue'|'svelte';
export type FrameworkId = FrameworkIdCore | (string & { __custom?: never });

export const DevConfigSchema = v.object({
  port: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1024), v.maxValue(65535))),
  https: v.optional(v.boolean()),
  hostname: v.optional(v.string()),
  workbench: v.optional(v.boolean()),
  fastRefresh: v.optional(v.boolean()),
  openBrowser: v.optional(v.boolean()),
  tenantUrl: v.optional(v.string()),
  initialPage: v.optional(v.string()),
});
export const BuildConfigSchema = v.object({
  sourcemap: v.optional(v.boolean()), // @deprecated
  minify: v.optional(v.boolean()),    // @deprecated
  splitChunks: v.optional(v.boolean()), // @deprecated must false
  outDir: v.optional(v.string()),
  releaseDir: v.optional(v.string()),
});
export const PathsConfigSchema = v.object({
  srcDir: v.optional(v.string()),
  webpartsDir: v.optional(v.string()),
  extensionsDir: v.optional(v.string()),
  librariesDir: v.optional(v.string()),
  configDir: v.optional(v.string()),
});
export const TeamsConfigSchema = v.union([v.boolean(), v.object({ enabled: v.optional(v.boolean()) })]);

export const RspfxConfigSchema = v.strictObject({ // rejects unknown keys — critical for cache stability
  name: v.pipe(v.string(), v.minLength(1)),
  version: v.optional(v.pipe(v.string(), v.regex(/^\d+\.\d+\.\d+/))),
  framework: v.custom<FrameworkId>((x)=> typeof x==='string' && (x as string).length>0, 'FrameworkId required'),
  spfxVersion: v.picklist(['1.20.0','1.21.1','1.22.0','1.23.0'] as const),
  dev: DevConfigSchema,
  build: BuildConfigSchema,
  paths: v.optional(PathsConfigSchema),
  deploy: v.optional(v.object({ tenantUrl: v.optional(v.string()), username: v.optional(v.string()), password: v.optional(v.string()), appCatalogSiteUrl: v.optional(v.string()) })),
  teams: v.optional(TeamsConfigSchema),
});
export type RspfxConfig = v.InferOutput<typeof RspfxConfigSchema>;

export interface Issue { path: (string|number)[]; message: string; code: typeof RspfxErrorCode.CONFIG_VALIDATION_FAILED; }
export function parseRSPFXConfig(raw: unknown): Result<RspfxConfig, Issue[]>;
export function tryResolveConfig(raw: unknown): Result<RspfxConfig, Issue[]>;
export function defineConfig<const T extends RspfxConfig>(config: T): T;

// apps/cli/src/config.ts
import type { RspfxInstance } from '@mbsks/rspfx-plugin-api';
export interface LoadedProject {
  readonly config: RspfxConfig;
  readonly bundler: BundlerId;
  readonly configFile: string;
  readonly plugin: RspfxBundlerPluginLike;
  readonly bundlerConfig: unknown;
  readonly userModuleRules?: readonly unknown[];
  readonly rspfx: RspfxInstance;
}
export function formatIssues(issues: Issue[]): string;
export function discoverPlugins(bundlerConfig: unknown): RspfxExtension[];
```

`Issue` maps `valibot` `ValiError.issues` (`path: [{key}], message`) to branded `RspfxErrorCode.CONFIG_VALIDATION_FAILED`. `Result` from `packages/diagnostics/src/result.ts:1` (`{ok:true,value}|{ok:false,error}`) already Phase 1.

Existing `configDefaults: Required<Pick<RspfxConfig,'dev'|'build'>> & {paths: Required<PathsConfig>}` at `core/config.ts:68` stays but derived via `v.fallback`/`v.parse` defaults to stay DRY.

### Migration Notes for Consumers

**If you used `defineConfig`/`resolveConfig`:**
```ts
// before — widens, accepts dust
import { defineConfig, resolveConfig } from '@mbsks/rspfx-core';
export default defineConfig({ name:'my-app', framework:'react', spfxVersion:'1.23', dev:{}, build:{} });
const cfg = resolveConfig({ name:'my-app', framework:'react', spfxVersion:'1.23', dev:{}, build:{}, unknownKey:123 } as any);

// after — literal preserved, strict
import { defineConfig, tryResolveConfig } from '@mbsks/rspfx-core';
export default defineConfig({ name:'my-app', framework:'react' as const, spfxVersion:'1.23', dev:{}, build:{} } as const);
// typeof cfg.framework -> 'react' (literal)
// unknownKey now errors:
const res = tryResolveConfig(raw); // raw has unknownKey -> {ok:false, error:[{path:['unknownKey'], message:'Unknown key', code:'CONFIG_VALIDATION_FAILED'}]}
if(!res.ok) throw new RspfxError(RspfxErrorCode.CONFIG_VALIDATION_FAILED, formatIssues(res.error));
```

Run `rspfx migrate --to 0.1 --dry-run` to preview, then without `--dry-run` to apply `as const` + `strictObject` fixes. `--revert` restores backup at `.rspfx/migrate-backup.json`.

**If you called `loadConfig` in custom tooling:**
```ts
// before
const {config, bundler} = await loadConfig(process.cwd());
// after — handle Result branch via exception + use rspfx instance
const {config, bundler, rspfx, plugin} = await loadConfig(projectRoot);
new RspfxPlugin({ name: config.name, framework: config.framework, rspfx });
```

**If you caught config errors:**
```ts
// before
try{ const {config}=await loadConfig(cwd) } catch(e){ if((e as any).code==='CONFIG_NOT_FOUND') ...}
// after exhaustive
import { RspfxError, RspfxErrorCode } from '@mbsks/rspfx-diagnostics';
try{ ... } catch(e){
  if(e instanceof RspfxError){
    switch(e.code){
      case RspfxErrorCode.CONFIG_NOT_FOUND: ...
      case RspfxErrorCode.PLUGIN_NOT_FOUND: ...
      case RspfxErrorCode.CONFIG_VALIDATION_FAILED: console.error((e.cause as Issue[]).map(i=> i.path.join('.')+': '+i.message).join('\n')); break;
      default: const _exhaust: never = e.code;
    }
  }
}
```

**If you relied on `process.cwd()` fsCache:** move invocation to `projectRoot` — `jiti` `fsCachePath` now `path.join(projectRoot,'node_modules/.cache/jiti')` (was `process.cwd()` at `apps/cli/src/config.ts:73`) — monorepo `pnpm -r` now isolated per project.

### Exit Criteria (functional, not CI)

- [ ] `pnpm typecheck` passes `strict:true` + `noExplicitAny`; `grep -rn "Record<string,unknown>" packages/core/src/config.ts` → 0 (except shim deprecated overload); `defineConfig` generic `const T` preserves literal (`expect-type` `typeof cfg.framework` is `'react'`).
- [ ] `v.strictObject` rejects unknown keys: `tryResolveConfig({name:'a', framework:'react', spfxVersion:'1.23', dev:{}, build:{}, unknownKey:1})` → `{ok:false, error: [{path:['unknownKey']}]}`; `CONFIG_VALIDATION_FAILED` thrown via `resolveConfig` shim.
- [ ] `apps/cli/src/config.ts:73` `fsCachePath` uses `projectRoot` not `process.cwd()` — `grep -n "fsCachePath" apps/cli/src/config.ts` shows `projectRoot`.
- [ ] `loadConfig` returns `LoadedProject.rspfx: RspfxInstance` and `plugin`/`bundlerConfig`; `apps/cli/src/commands/build.ts:104`, `dev.ts:27`, `package.ts`, `doctor.ts` consume `rspfx` not `getPlugins()` — `grep -rn "getPlugins\|registerPlugin" apps/cli` → 0 (except deprecated shim comment).
- [ ] `apps/cli/src/cli.ts:25` exhaustive `switch(err.code)` with `default: never` compiles; adding `RspfxErrorCode.MIGRATE_BACKUP_EXISTS` without switch update is type error.
- [ ] `rspfx migrate --dry-run` prints diff for `contributions→rspack`, `as const`, `satisfies FrameworkPreset<'id'>`, `fsCachePath`; `rspfx migrate` writes `.rspfx/migrate-backup.json` once; second run without `--revert` errors `MIGRATE_BACKUP_EXISTS`; `--revert` restores.
- [ ] `rspfx doctor` (no flag) validates via `tryResolveConfig` and prints `Issue.path`; `rspfx doctor --fix` calls `ensureProjectConfigs` (Phase 4 pure) then re-validates and exits 0 when fixed.
- [ ] `pnpm build` emits ESM `dist/*.js` with `.js` imports; `packages/core/dist/config.js` no ` Record<string,unknown>` dust; `core` `valibot` dep tree-shakable (`pnpm --filter @mbsks/rspfx-core build` bundle < 15kB gz overhead).
- [ ] `pnpm test` passes parallel forks (Phase 1 proof) — `vitest.config.ts:24` `singleFork:false` no longer required; at least one file uses per-test `createRSPFX()` isolation.
- [ ] `pnpm build && node bench/bench.mjs` median `recompile_median_ms` within ±15% of Phase 0 `reference/baseline-0.0.13.json` (no kernel perf regression); `reference/baseline-0.1.0.json` committed delta documented.
- [ ] Docs: `docs/internal-api.md` lists `RspfxConfigSchema`/`tryResolveConfig`/`Issue`/`defineConfig<const T>` signatures; `docs/commands.md` lists `migrate --to/--dry-run/--revert` + `doctor --fix` + env vars at `#environment-variables` (fact home); `docs/architecture.md:63` notes `core` valibot exception — all with one-line-per-paragraph, `wc -w` budgets hold, relative links resolve, no history narration (history only in `CHANGELOG.md`).

### Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **`valibot` breaks `core` zero-deps promise** — `ARCHITECTURE.md:102` consumers audit `core` deps | High | Keep dep to single `valibot` (no transitive deps, ~12kB) and document exemption in `ARCHITECTURE.md:102` + `docs/architecture.md:63`; offer Option B (schema in `plugin-api`) as fallback — decide before PR. Add `pnpm --filter @mbsks/rspfx-core build` size check in PR description (local, not CI). |
| **`v.strictObject` rejects legitimate custom `teams`/`deploy` extensions** | High | Keep `strictObject` only on top-level `RspfxConfig`; `deploy`/`teams` schemas use `v.object` with `v.optional` but still reject unknown nested keys — provide `v.looseObject` for user-extensible `deploy` if needed and document `// @ts-expect-error` escape hatch. `tryResolveConfig` error message points to `Issue.path`. |
| **`fsCachePath` move invalidates existing cache** | Medium | One cold rebuild per project on upgrade (delete `node_modules/.cache/jiti` at `process.cwd()` stale). Document in `CHANGELOG.md ## [0.1.0]` migration note. `jiti` `fsCache:true` still uses content hash, so stale entries pruned. |
| **`rspfx migrate` codemod over-rewrites** — `contributions` inside comments/strings rewritten | Medium | Regex limited to `/(?<![A-Za-z0-9_])contributions\s*\(/` plus `ts-morph` AST when available; `--dry-run` default for first release; `--revert` backup guard; test fixture with `// contributions` comment asserts not rewritten. |
| **`await rawDefault({})` breaks sync config factories** | Low | `await` transparent for sync return; `typeof rawDefault==='function'` branch handles both `export default {...}` and `export default () => ({...})` at `config.ts:77`. Keep `Promise.resolve` fallback. |
| **Exhaustive `switch` churn** — every new `RspfxErrorCode` breaks CLI build | Medium | Desired — exhaustiveness is the point. Add `@ts-expect-error` comment on `default: never` branch to surface missing case at typecheck, not runtime. |

### Effort Estimate

**8 days single engineer; ~5 days with two (core vs CLI parallel):**

* Day 1: `core` schema + `defineConfig<const T>` + `Issue` + `parseRSPFXConfig` (1.5d).
* Day 2: `diagnostics` `CONFIG_VALIDATION_FAILED` + `Result` wiring + `core/package.json` valibot dep (0.5d) + `apps/cli/src/config.ts:55` refactor `fsCachePath`+`tryResolveConfig`+`createRSPFX` (1d).
* Day 3: Thread `rspfx` through `build.ts/dev.ts/package.ts/doctor.ts/analyze.ts` + `plugin/src/*` consumes instance (1d).
* Day 4: `rspfx migrate --to 0.1 --dry-run --revert` codemods + backup guard (1.5d).
* Day 5: `doctor --fix` + `new` scaffolds + exhaustive `cli.ts:25` switch (1d).
* Day 6: Docs (`internal-api.md`, `commands.md`, `architecture.md`) + Agent Note `.agents/notes/implemented/config/2026-08-24-config-schema-cli.md` per `docs/AGENTS.md` header rules (0.5d) + `pnpm build/test/bench` gate re-run (0.5d).
* Day 7-8: Review + fixture pass (invalid `teams` Issue path, `unknownKey` reject, `revert` cycle).

With two engineers: E1 core+diagnostics (2d) || E2 CLI config+threading (2d), then pair on migrate+doctor+docs (1d).

---
