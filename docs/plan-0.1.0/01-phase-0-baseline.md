# Phase 0 — Baseline & Guardrails (no breaking changes)

> **Part of:** `docs/plan-0.1.0.md` → split by phase. Original combined header: `# Phase 0 — Baseline & Guardrails (no breaking changes) & Phase 1 — Foundation: Types, Registry, Errors (P0 breaking)`
> **No CI changes** — verification via `pnpm build` / `pnpm typecheck` / `pnpm test` only. See [`README.md`](./README.md).


### Goal & Rationale

**Goal:** Freeze `0.0.13` behavior as a reproducible, measured baseline so Phase 1–9 breaking changes can be verified byte-for-byte against known-good artifacts. Establish the invariant that `pnpm build && pnpm test && pnpm typecheck` passes on both `main` and the new `next` branch before any breaking diff lands.

**Rationale:**

* RSPFx has three bundler kernels (`/Volumes/New Volume/code/spfx/packages/plugin/src/rspack.ts:53`, `vite.ts:298`, `rsbuild.ts:185`), two packaging pipelines (`manifest-generator`, `sppkg-builder`), and six framework presets. Without a frozen baseline a later “fix” in `compiler-rspack/src/config.ts:212` (CSS dedup) or `plugin/src/rsbuild.ts:486` (DefinePlugin ordering) cannot be distinguished from a regression.
* `core` zero-deps invariant (`/Volumes/New Volume/code/spfx/ARCHITECTURE.md:102`, `docs/architecture.md:63`) is currently only documented. Phase 0 must capture an auditable snapshot so Phase 1’s new `core/src/newtypes.ts` and `webpart-base` split do not silently introduce deps.
* Metrics are currently anecdotal (`bench/bench.mjs:59` comments `633ms / 68ms / 315ms`). Capturing median over `BENCH_RUNS=3` on a pinned fixture (`examples/shadcn`, `examples/svelte`, `templates`) gives a contrarian signal when Phase 5 lazyCompilation or Phase 6 Rust changes claim wins.
* Branch discipline prevents scope creep: Angular is deferred (`ARCHITECTURE.md:7`), `docs/roadmap.md` M8/M9 frozen. Without a `next` branch every Phase 1 branded-type rename bleeds into `main` patch releases.

**Non-goal:** No API change, no file moves, no dependency version bumps. Phase 0 must be cherry-pickable back to `main` with zero consumer impact.

### Breaking Changes

**None.**

Explicitly verify:

| Surface | Assertion |
|---|---|
| `defineConfig` | `packages/core/src/config.ts:64` still ` (c: RspfxConfig) => RspfxConfig`, no `const` generic |
| `FrameworkPreset` | `packages/plugin-api/src/types.ts:29` still `F extends string` flat interface |
| `RspfxError.code` | `packages/diagnostics/src/error.ts:4` still `string` |
| `registerPlugin`/`getPlugins` | `packages/plugin-api/src/registry.ts:9,13` still global `Map` singleton |

Any diff touching `packages/core/src/index.ts:1` exports must be rejected in Phase 0 review.

### File-by-File Task Breakdown

| # | Absolute Path | Lines | Action | Detail |
|---|---|---|---|---|
| 0.1 | `/Volumes/New Volume/code/spfx/docs/plan-0.1.0.md` | `31-49` | **Document** | Replace CI-focused tasks with local guardrail tasks below. Keep dependency DAG diagram. |
| 0.2 | `/Volumes/New Volume/code/spfx/docs/roadmap.md` | whole | **Freeze** | Add header `> Frozen for 0.1.0 — no new framework (Angular deferred ARCHITECTURE.md:7). Changes require maintainer approval.` |
| 0.3 | `/Volumes/New Volume/code/spfx/package.json` | `3` | **Record** | Note `0.0.13` as baseline; do not bump. Verify `pnpm` version pinned `10.33.0` line 8. |
| 0.4 | `/Volumes/New Volume/code/spfx/bench/bench.mjs` | `59-119,221-277` | **Measure** | Run `node bench/bench.mjs` three times on `examples/shadcn`; capture `BENCH_RESULT` line `331: cold_start_ms`, `recompile_median_ms`, `full_build_ms`. Commit median to `reference/baseline-0.0.13.json` (new) and `.rspfx/benchmarks.jsonl` (append). Expected from plan comments: `cold 633ms / recompile 68ms / build 315ms` — verify on current machine and record actual. |
| 0.5 | `/Volumes/New Volume/code/spfx/packages/plugin/tests/parity.test.ts` | `1-282` | **Snapshot** | Run `pnpm test -- parity`; capture `release/manifests` hashes for `ENTRY_IDS` `13-18`. Write `reference/parity-0.0.13.hashes.json` = `{ alpha: sha256, beta: …, manifestCount:5 }`. The test already asserts `dist/*.js` header `(function(){window["__rspfx_script_url_` `110` and `define("id_1.0.0"` `111` — record which assertion would fail if wrapper breaks (R1 in ARCHITECTURE.md:144). |
| 0.6 | `/Volumes/New Volume/code/spfx/packages/sppkg-builder/src/zip.ts` | `22` | **Fixture** | Build `examples/shadcn` via `pnpm --filter @mbsks/rspfx-cli build && rspfx package`; unzip `sharepoint/solution/*.sppkg` and record CRC32 per entry + ZIP64 flag. Compare to `reference/FORMATS.md` contract. Commit `reference/sppkg-0.0.13.crc.json`. |
| 0.7 | `/Volumes/New Volume/code/spfx/examples/shadcn/dist` , `examples/svelte/dist`, `templates/dist` | n/a | **Size baseline** | After `rspfx build`, run `du -sb` + `formatBytes` from `packages/diagnostics/src/format.ts:1` for each framework example. Record in `reference/sizes-0.0.13.json` e.g. `solid ~15kB / react ~90kB` (mirrors Phase 9 treemap target). |
| 0.8 | `/Volumes/New Volume/code/spfx/packages/core/src/index.ts` | `1-21` | **Zero-deps audit** | Manual audit: `core` must have no `dependencies` or `peerDependencies` in its `package.json`. Run `grep -r "from '@" packages/core/src --include="*.ts"` — must only hit `@microsoft/sp-webpart-base` via `base-web-part.ts:1` (which is the file Phase 2 will move). Document exemption in `docs/architecture.md:41` notes. |
| 0.9 | `/Volumes/New Volume/code/spfx/tsconfig.base.json` | `22-42` | **Paths invariant** | Verify `paths` contains only `@mbsks/*` aliases `23-40` and that each `packages/*/tsconfig.build.json` has `paths:{}` empty (per AGENTS.md build rule). Record in `notes/baseline-checklist.md` (ephemeral, delete before tag). |
| 0.10 | `/Volumes/New Volume/code/spfx/packages/plugin-api/src/types.ts` | `29,58,78` | **Any-baseline** | Run local triage: `grep -n "unknown\[\]" packages/plugin-api/src/types.ts` must flag line `4: rules?: unknown[]` etc but distinguish *public API*` unknown[]` (forbidden after Phase 1) vs internal. Record current count `5` occurrences (`rules`, `plugins`, `beforeCompile unknown`, `beforeGenerate unknown`, `manifests unknown[]`) as baseline; Phase 1 must reduce to `0` in public `FrameworkPreset` + `RspfxExtension` hooks. |
| 0.11 | `/Volumes/New Volume/code/spfx/vitest.config.ts` | `22-25` | **Isolation baseline** | Document current `singleFork: true` workaround `24`. Phase 1 exit is to delete it after per-test `createRSPFX()` isolation. Record that `pnpm test` currently requires singleFork because global `registry` leaks across forks. |
| 0.12 | `/Volumes/New Volume/code/spfx/scripts/check-ts-only.mjs` | `12` | **Stub prep** | Ensure script allows `crates/**/*.rs` (future) without failing on Phase 0 repo which has no `crates/`. Add comment `# Phase 6 placeholder` only. Do not implement Rust. |
| 0.13 | `/Volumes/New Volume/code/spfx/.gitignore` + `package.json` scripts | n/a | **Local artifact hygiene** | Add `.rspfx/benchmarks.jsonl` to `.gitignore` if not already; keep committed `reference/baseline-*.json` outside ignored dir. |

No file move in Phase 0. Branch `next` is created via `git checkout -b next main` and pushed with `git push -u origin next`.

### Implementation Steps (ordered)

1. **Create `next` branch & freeze** — `git checkout -b next main`; edit `docs/roadmap.md` freeze banner; commit `chore: freeze roadmap for 0.1.0 baseline`.
2. **Build & test baseline** — `pnpm build` (packages), `pnpm typecheck` (all), `pnpm test` singleFork. Record exit codes. Any failure blocks Phase 1.
3. **Benchmark capture** — Ensure `apps/cli/dist/cli.js` exists (`pnpm --filter @mbsks/rspfx-cli build`). Run `BENCH_RUNS=3 node bench/bench.mjs examples/shadcn` and `examples/svelte` and `templates` skeleton via `bench/skeletons/shared`. Collect three `BENCH_RESULT` lines each, compute median per metric (`medianSorted` in `bench.mjs:211`). Write `reference/baseline-0.0.13.json`:
   ```json
   { "version":"0.0.13", "date":"2026-08-24", "host":"darwin arm64 node 20.x",
     "shadcn": {"cold_start_ms": 633, "recompile_median_ms": 68, "full_build_ms": 315},
     "svelte": {"cold_start_ms": 590, "recompile_median_ms": 55, "full_build_ms": 280}
   }
   ```
4. **Parity hash capture** — Run `pnpm test packages/plugin/tests/parity.test.ts` with `DEBUG=*` off; after each of three isolations capture `captureResult()` hashes (`parity.test.ts:124`). Write `reference/parity-0.0.13.hashes.json`.
5. **SPPKG CRC capture** — `rspfx package` on `examples/shadcn`; run `node -e "import('node:fs').then(...crc32)"` over `sharepoint/solution/*.sppkg` entries; compare to `reference/FORMATS.md` ZIP layout spec; write `reference/sppkg-0.0.13.crc.json`.
6. **Size capture** — `ls -la` + `stat` on each `dist/*.js` and `release/manifests/*.json`; use `formatBytes` to normalize; write `reference/sizes-0.0.13.json`.
7. **Zero-deps & paths audit** — Run manual checks #0.8, #0.9; record findings in local `notes/baseline-checklist.md` (not committed long-term) — e.g. `core deps: 0, paths empty: ok, unknown[] count: 5`.
8. **Verification gate** — On clean checkout of `next`, re-run steps 2–7 on second machine or second Node version (20 vs 22) to ensure fixture portability; any drift >10% in bench medians is documented as host variance, not failure.

### Data Structures / Types to Introduce

**Phase 0 introduces no production types.** It introduces *fixture schemas* (commit as `reference/*.json` with JSON Schema comment):

```ts
// reference/baseline-0.0.13.json — not a package export, but document its shape
interface BaselineSnapshot {
  version: "0.0.13";
  date: string; // YYYY-MM-DD
  host: string; // `${process.platform} ${process.arch} node ${process.version}`
  projects: Record<string, {
    cold_start_ms: number; // bench.mjs:331
    recompile_ms: number[]; // length BENCH_RUNS
    recompile_median_ms: number;
    full_build_ms: number;
  }>;
}

// reference/parity-0.0.13.hashes.json
interface ParityHashes {
  version: "0.0.13";
  bundlers: ("rspack"|"vite"|"rsbuild")[];
  manifests: Record<string, string>; // filename -> sha256 of content
  assets: string[]; // sorted dist file list
}

// reference/sppkg-0.0.13.crc.json
interface SppkgCrc {
  version: "0.0.13";
  entries: Array<{ path: string; crc32: string; compressedSize: number; uncompressedSize: number }>;
  isZip64: boolean;
}
```

These are *not* exported from any package; they live in `reference/` for human diff and for Phase 5/9 parity assertions (`parity.test.ts:240-247` will later compare against them).

### Migration Notes for Consumers

**None.** Phase 0 is invisible to consumers of `@mbsks/rspfx-core`, `@mbsks/rspfx-plugin-api`, `@mbsks/rspfx-plugin`, etc. If you `npm install @mbsks/rspfx-core@0.0.13` today, Phase 0 changes nothing.

Contributor note: after `next` is cut, open PRs against `main` that target 0.0.x patches must be cherry-picked to `next` manually; do not merge `main` into `next` without a baseline re-capture.

### Exit Criteria (functional, not CI)

- [ ] `git branch --contains HEAD` shows `main` and `next` share `0.0.13` tag `v0.0.13` (`CHANGELOG.md ## [0.0.13]` present).
- [ ] `pnpm build` succeeds on both branches (all `packages/*/dist` + `apps/cli/dist` emitted as ESM, `.js` imports preserved).
- [ ] `pnpm typecheck` succeeds (no `TS` errors).
- [ ] `pnpm test` passes with current `vitest.config.ts:22 singleFork:true` (parity test `assertParityOutput` `parity.test.ts:104` green on all three bundlers).
- [ ] `reference/baseline-0.0.13.json`, `reference/parity-0.0.13.hashes.json`, `reference/sppkg-0.0.13.crc.json`, `reference/sizes-0.0.13.json` committed on `next` and byte-identical when re-generated on a second checkout.
- [ ] Manual audit notes show `core` zero deps, `paths:{}` empty, `unknown[]` count recorded `5`.
- [ ] `bench/bench.mjs` re-run shows `recompile_median_ms` stable within ±15% of captured median; document host variance.
- [ ] No file in `packages/core/src` imports `framework-*` or `compiler-rspack` (DAG rule `ARCHITECTURE.md:107` holds).

### Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Bench variance masks regression** — M1 Mac vs Linux CI median differs 30% | Medium | Capture `host` field; normalize to *relative* improvement (`-40%` claim in Phase 5 is relative to same host, not absolute `68ms`). Require 3 runs median, not single. |
| **Parity hash flakiness** — `vite` vs `rspack` header differs by newline | High | Assert both substrings (`startsWith` window var `parity.test.ts:110` and `define` id `111`) separately; hash manifests as JSON normalized (`JSON.parse` + `JSON.stringify` sorted keys) before hashing. |
| **SPPKG CRC platform newline** — Windows CRLF breaks CRC | Medium | Generate fixture on `darwin` baseline; later Phase 5/6 must normalize `xml.ts:48` line endings to `\n` before CRC; document in `reference/FORMATS.md`. |
| **Zero-deps audit misses transitive dep** — `core` pulls `@microsoft/sp-webpart-base` as `devDependency` but types leak | High | Phase 2 move fixes this; Phase 0 only records that `base-web-part.ts:1` is the sole offender and is explicitly exempt until Phase 2 `@mbsks/rspfx-webpart-base` extraction. |
| **Branch drift** — `next` diverges before Phase 1 lands | Low | Enforce `next` is PR-only; require baseline re-capture if `main` gets a patch after cut. |

### Effort Estimate

**5 days** single engineer (no parallelization needed):

* Day 1: Branch + freeze + build/typecheck triage (`0.5d`), bench harness verification (`0.5d`).
* Day 2: Three benchmark captures + median calc (`1d`).
* Day 3: Parity + SPPKG + size fixtures (`1d`).
* Day 4: Zero-deps/paths/`unknown[]` audits + notes + docs (`1d`).
* Day 5: Second-checkout verification + review (`1d`).

Parallelization not beneficial; Phase 0 is sequential measurement.
