# Phase 9 — Polish & Release

> **Dependency:** Phases 0–8 complete (Phase 8 config schema lands before docs freeze). **No CI changes** — verification is `pnpm build && pnpm test && pnpm typecheck && node bench/bench.mjs` (local only) plus manual `CHANGELOG.md ## [0.1.0]` + `git tag v0.1.0` + `git push --follow-tags` per `CONTRIBUTING.md#publishing-and-tagging` and `scripts/publish.mjs:17`.

### Goal & Rationale

**Goal:** Freeze 0.1.0 as a shippable, documented, benchmarked, size-audited release. One `CHANGELOG.md ## [0.1.0] - YYYY-MM-DD` section (fact home per `docs/AGENTS.md:13`), synchronized git tag `v0.1.0` + npm dist-tag `latest`/`next`, `examples/*` + `templates` concise, and performance gates met (`cold start <2s`, `recompile <300ms`, `refresh <150ms` from `ARCHITECTURE.md:218`).

**Rationale:**

* RSPFx 0.0.13 → 0.1.0 is breaking (Phases 1–8). Without a single `CHANGELOG.md` history home + annotated tag linked to changelog section, consumers cannot `git diff v0.0.13..v0.1.0` or `npm view @mbsks/rspfx-core dist-tags`. `scripts/publish.mjs:17` `--tag` + `--dry-run` workflow must be exercised locally with `pnpm publish:dry`.
* Docs drift is the top support cost: `docs/AGENTS.md` tier taxonomy + fact homes + one-line-per-paragraph + slop checklist must be enforced now, or `docs/internal-api.md` re-narrates history (`previously...`) that belongs only in `CHANGELOG.md`.
* Performance numbers are currently anecdotal (`bench/bench.mjs:59` `633ms/68ms/315ms` comments). Phase 9 must capture median over `BENCH_RUNS=3` on pinned fixtures (`examples/shadcn`, `examples/svelte`, `templates`) into `reference/baseline-0.1.0.json` + `.rspfx/benchmarks.jsonl` and publish treemap (`solid ~15kB / react ~90kB` from `docs/performance.md`).
* `examples/*` + `apps/playground` must stay private (never published) — `AGENTS.md` publishing rule — but must be `pnpm build && pnpm test` green on Node 20+.

**Non-goal:** No new features beyond docs/examples/benchmarks; no CI workflow edits; no `type-coverage` CI gate (local `pnpm typecheck` only).

### Breaking Changes (before/after)

**None in code.** Phase 9 is polish + release mechanics. The only breaking surface is the version bump itself (consumers on `^0.0.13` get peer conflict). All code breaks landed Phases 1–8; Phase 9 only bumps `package.json` versions + publishes.

**Before → After version/tag:**
```json
// packages/*/package.json (before)
{ "name": "@mbsks/rspfx-core", "version": "0.0.13" }
// after — all packages + apps/cli share one version (AGENTS.md publishing rule)
{ "name": "@mbsks/rspfx-core", "version": "0.1.0" }
{ "name": "@mbsks/rspfx-plugin", "version": "0.1.0" }
{ "name": "@mbsks/rspfx-cli", "version": "0.1.0" }
```
Git + npm:
```bash
# before
CHANGELOG.md // no ## [0.1.0] section
git tag v0.0.13

# after — exactly one section, linked to tag + dist-tag
# CHANGELOG.md
## [0.1.0] - 2026-08-24
### Breaking Changes ... ### Migration ...

git tag -a v0.1.0 -m "0.1.0"  # annotated, linked to CHANGELOG.md ## [0.1.0]
npm publish --tag latest     # or --tag next for prerelease per scripts/publish.mjs:17
git push --follow-tags
```

**Docs before → after (slop removed per `docs/AGENTS.md`):**

| File | Before | After |
|---|---|---|
| `docs/internal-api.md` | May narrate `previously unknown[] now RspackContribs` | Current-state only: `FrameworkPreset<T extends FrameworkId> { rspack(opts)=>RspackContribs }` (no `previously`). History only in `CHANGELOG.md`. One line per paragraph. |
| `docs/commands.md` | Flags scattered, env vars duplicated | Flags concrete: `--dry-run`, `--tenant`, `--refresh`, `--fix`, `--to 0.1`, `--revert`; env vars only at `#environment-variables` (`RSPFX_LOG_LEVEL`, `SPFX_SERVE_TENANT_DOMAIN`, `RSPFX_ACCESS_TOKEN`, `RSPFX_APP_CATALOG_URL`) — fact home per `docs/AGENTS.md:13`. |
| `docs/architecture.md` | Pipeline prose with `implemented`/`WIP` status annotations | Reference only: pipeline `src/ → compiler-rspack → dist/ → manifest-generator → sppkg-builder → solution.sppkg`; no status annotations (slop checklist). Links resolve: `docs/architecture.md#pipeline` → heading slug exactly. |
| `CHANGELOG.md` | Missing `## [0.1.0]` | One section `## [0.1.0] - YYYY-MM-DD` with subheads `### Breaking Changes`, `### Features`, `### Fixes`, linked to `v0.1.0` annotated tag. |
| `.agents/notes/README.md` | Budget `500` words | Stays within `docs/AGENTS.md` word budget `1,000` for this file, `500` for notes README. |
| `.agents/notes/implemented/<class>/YYYY-MM-DD-slug.md` | — | New Agent Notes for non-trivial doc/behavior changes (Phase 8 + 9) with uniform header (`# Agent Note: <title>` line 1, blank line 2, `Status: implemented` line 3) per `docs/AGENTS.md` verification. Then delete worklogs. |

### File-by-File Task Breakdown

| # | Absolute Path | Lines | Action | Detail |
|---|---|---|---|---|
| 9.1 | `/Volumes/New Volume/code/spfx/CHANGELOG.md` | whole | **Write** | Add exactly one section `## [0.1.0] - YYYY-MM-DD` (use real date, e.g. `2026-08-24` matching bench date). Include breaking changes: `FrameworkPreset` `contributions→rspack`, `RspfxErrorCode` branded, `defineConfig<const T>` literal, `resolveConfig` `Record<string,unknown>` dust rejected, `createRSPFX` instance replaces `registerPlugin`/`getPlugins`, `readProject` purity (Phase 4), kernel cache versioning (Phase 5), config schema `strictObject` (Phase 8), `rspfx migrate --to 0.1` codemod. Link section to `v0.1.0` tag (`[0.1.0]: https://github.com/.../compare/v0.0.13...v0.1.0` or similar). No duplicate history elsewhere — `docs/` must not repeat. Validate via `scripts/publish.mjs --dry-run` checks git clean + `## [X.Y.Z]` present. |
| 9.2 | `/Volumes/New Volume/code/spfx/package.json` | `3-8` | **Bump** | Set `"version": "0.1.0"` at `3`; verify `"packageManager": "pnpm@10.33.0"` at `8` pinned. All `packages/*/package.json` + `apps/cli/package.json` bumped identically (one version policy `AGENTS.md` publishing rule). |
| 9.3 | `/Volumes/New Volume/code/spfx/packages/*/package.json` | version | **Bump** | All packages (`core`, `diagnostics`, `plugin-api`, `compiler-rspack`, `manifest-generator`, `sppkg-builder`, `dev-runtime`, `framework-*`, `plugin`, `sharepoint-runtime`, `fluent-adapter`) bump to `0.1.0`. Verify `examples/*` and `apps/playground` stay private (`"private": true` — must not publish). |
| 9.4 | `/Volumes/New Volume/code/spfx/apps/cli/package.json` | version | **Bump** | `@mbsks/rspfx-cli` version `0.1.0`; `bin: rspfx` unchanged. Run `pnpm --filter @mbsks/rspfx-cli build` before `node bench/bench.mjs` (bench needs built CLI per `AGENTS.md` commands). |
| 9.5 | `/Volumes/New Volume/code/spfx/docs/internal-api.md` | whole | **Polish** | Classify as `reference` (per `docs/AGENTS.md:7` tier taxonomy). Concrete prose: name exact packages (`@mbsks/rspfx-core`, `@mbsks/rspfx-plugin`, `@mbsks/rspfx-plugin-api`, `@mbsks/rspfx-diagnostics`), files (`packages/core/src/config.ts`, `packages/core/src/versions.ts`, `apps/cli/src/config.ts`, `packages/diagnostics/src/codes.ts`), env vars, flags. One physical line per paragraph (blank line between). Remove hand-restated source paragraphs that rephrase code block below (slop checklist `hand-restated source`), remove emphasis inflation (`**important**`/`very`). Table of package surfaces with columns `Package | Exports | Notes`. No `implemented`/`done`/`WIP` status annotations in reference body (slop checklist). Exempt from word budget due to API contract size but stay concise; `docs/internal-api.md` exempt per `docs/AGENTS.md` word budgets table. |
| 9.6 | `/Volumes/New Volume/code/spfx/docs/commands.md` | whole | **Polish** | Reference; one line per paragraph; table of commands `new │ dev │ dev --refresh │ build │ package │ deploy │ doctor │ analyze │ clean` + flags `--dry-run`, `--tenant`, `--refresh`, `--fix`, `--to`, `--revert` with exact files (`apps/cli/src/commands/build.ts`, `doctor.ts`, `migrate.ts`). Environment variables table only at `#environment-variables` (`RSPFX_LOG_LEVEL`, `SPFX_SERVE_TENANT_DOMAIN`, `RSPFX_APP_CATALOG_URL`, `RSPFX_ACCESS_TOKEN`) — fact home per `docs/AGENTS.md:13`; elsewhere link there (`see docs/commands.md#environment-variables`). No changelog narration. |
| 9.7 | `/Volumes/New Volume/code/spfx/docs/architecture.md` | whole | **Polish** | Reference; pipeline diagram `File save → Rspack incremental rebuild → HMR/refresh event (ws) → browser update` and `src/ → compiler-rspack → dist/ → manifest-generator → sppkg-builder → solution.sppkg → SharePoint app catalog` — current behavior only. Fact home for pipeline; `docs/AGENTS.md` notes `docs/architecture.md` is pipeline home. One line per paragraph. |
| 9.8 | `/Volumes/New Volume/code/spfx/docs/compatibility.md` | whole | **Verify** | Reference; SPFx matrix `1.20–1.23` with manifest schema fields `preconfiguredEntries`, `properties`, `safeWithCustomScriptDisabled`, `componentType`, `manifestVersion:2`, `loaderConfig.scriptResources` `component`/`path`/`localizedPath`. Link to `reference/sp-component-ids.json`. |
| 9.9 | `/Volumes/New Volume/code/spfx/docs/supporting-a-new-spfx-version.md` | whole | **Verify** | Reference/tutorial hybrid — mark as reference or tutorial before edit per `docs/AGENTS.md`. Steps: `packages/core/src/versions.ts` add target + `reference/sp-component-ids.json` harvest + version matrix tests. Link not duplicate. |
| 9.10 | `/Volumes/New Volume/code/spfx/README.md` | whole | **Polish** | One line per paragraph; concrete prose; links to `docs/commands.md`, `docs/internal-api.md`, `docs/architecture.md`, `CHANGELOG.md`. No history narration. Word budget none but concise. |
| 9.11 | `/Volumes/New Volume/code/spfx/examples/shadcn/**` | n/a | **Size audit** | `pnpm --filter @mbsks/rspfx-cli build && rspfx build` on example; `du -sb dist/*.js` + `formatBytes` (`packages/diagnostics/src/format.ts:1`); record treemap `solid ~15kB / react ~90kB` target in `docs/performance.md` or `reference/sizes-0.1.0.json`. Must stay private. |
| 9.12 | `/Volumes/New Volume/code/spfx/examples/svelte/**` , `templates/**` | n/a | Same | Coverage for `svelte`, `vanilla` minimal bundles. |
| 9.13 | `/Volumes/New Volume/code/spfx/bench/bench.mjs` | `59-119,211,221-277,331` | **Capture** | Run `BENCH_RUNS=3 node bench/bench.mjs` on `examples/shadcn`, `examples/svelte`, `templates` via `bench/skeletons/shared`; `medianSorted` at `:211`; capture `BENCH_RESULT` at `:331` `cold_start_ms`, `recompile_median_ms`, `full_build_ms`; append to `.rspfx/benchmarks.jsonl` (gitignored per Phase 0) and commit median to `reference/baseline-0.1.0.json` + `docs/performance.md` table. Assert `ARCHITECTURE.md:218` gates: `cold start <2s`, `rebuild <300ms`, `refresh <150ms`, small build `<4s`, large `<15s`. |
| 9.14 | `/Volumes/New Volume/code/spfx/reference/*.json` | `baseline-0.0.13.json` etc | **Snapshot** | From Phase 0: `reference/parity-0.0.13.hashes.json` (`parity.test.ts:124` hashes), `reference/sppkg-0.0.13.crc.json` (`sppkg-builder/src/zip.ts:22` CRC), `reference/sizes-0.0.13.json` — diff against `0.1.0` parity after Phase 5 kernel; any delta must be intentional cache version bust. New `reference/baseline-0.1.0.json` shape `{version:"0.1.0", date:"2026-08-24", host:"darwin arm64 node 20.x", projects:{shadcn:{cold_start_ms:...,recompile_median_ms:...,full_build_ms:...}}}`. |
| 9.15 | `/Volumes/New Volume/code/spfx/packages/plugin/tests/parity.test.ts` | `104,110-111,240-247` | **Verify** | Byte-identical across `rspack`/`vite`/`rsbuild` adapters via `assertParityOutput` at `:104` and wrapper header `window["__rspfx_script_url_` at `:110` + `define("id_1.0.0"` at `:111`; hash manifests normalized sorted keys at `:240-247`. Must stay green after kernel/purity changes. |
| 9.16 | `/Volumes/New Volume/code/spfx/.agents/notes/README.md` | whole | **Budget** | Verify `wc -w .agents/notes/README.md` ≤500 per `docs/AGENTS.md` word budgets table. |
| 9.17 | `/Volumes/New Volume/code/spfx/.agents/notes/implemented/**` | new | **Notes** | For each non-trivial doc/behavior change, create `.agents/notes/implemented/{class}/YYYY-MM-DD-slug.md` with uniform header `# Agent Note: <title>` line 1, blank line 2, `Status: implemented` line 3 per `docs/AGENTS.md` verification. Example `2026-08-24-release-0.1.0.md`. Then delete worklogs. One home per fact — rationale → Agent Note, not `docs/`. |
| 9.18 | `/Volumes/New Volume/code/spfx/tsconfig.base.json` | `22-42` | **Invariants** | Verify `paths` contains only `@mbsks/*` aliases `23-40` and each `packages/*/tsconfig.build.json` has `paths:{}` empty (AGENTS.md build rule); `pnpm typecheck` still strict. |
| 9.19 | `/Volumes/New Volume/code/spfx/scripts/publish.mjs` | `17` | **Dry-run** | Run `node scripts/publish.mjs --dry-run` or `pnpm publish:dry` — verifies tag + `CHANGELOG.md` `## [X.Y.Z]` per `AGENTS.md` publishing rule; prints AI-agent reminder to update `CHANGELOG.md` `## [X.Y.Z]` before real publish. No live publish without `git` clean. |
| 9.20 | `/Volumes/New Volume/code/spfx/CONTRIBUTING.md` | `publishing-and-tagging` | **Verify** | Ensure tagging workflow matches: `--tag <dist-tag>` (`latest` default, `next` for prereleases), annotated tag `vX.Y.Z` linked to changelog, `git push --follow-tags`. |
| 9.21 | `/Volumes/New Volume/code/spfx/docs/AGENTS.md` | `1,000` | **Budget** | Verify `wc -w docs/AGENTS.md` ≤1000 per word budgets. No change needed unless over budget — then relocate to fact home. |

### Implementation Steps (ordered)

1. **Bump versions & private guard** — Edit `package.json:3` + all `packages/*/package.json` + `apps/cli/package.json` to `0.1.0`. Verify `examples/*`/`apps/playground` have `"private": true` (re-checked, not changed). No `pnpm publish` yet. ~0.5d.

2. **Capture parity + sppkg + sizes** — Re-run Phase 0 fixtures on `next` branch at `0.1.0`: `pnpm test packages/plugin/tests/parity.test.ts` capture `reference/parity-0.1.0.hashes.json` diff vs `parity-0.0.13.hashes.json`; `rspfx package` on `examples/shadcn` unzip CRC → `reference/sppkg-0.1.0.crc.json`; `du -sb` treemap → `reference/sizes-0.1.0.json` (`solid ~15kB / react ~90kB` assertion). Any byte drift must be explained (cache version bust is expected). ~1d.

3. **Benchmark capture** — Ensure `pnpm --filter @mbsks/rspfx-cli build` built. Run `BENCH_RUNS=3 node bench/bench.mjs examples/shadcn` + `examples/svelte` + `templates` skeleton via `bench/skeletons/shared`; `medianSorted` at `bench.mjs:211`; write `reference/baseline-0.1.0.json` and append to `.rspfx/benchmarks.jsonl` (gitignored). Assert gates `cold start <2000ms`, `recompile <300ms`, `refresh <150ms` (`ARCHITECTURE.md:218`) — if `modern-search` 4-entry `-40%` claim from Phase 5, verify vs `0.0.13` median on same host (relative, not absolute). Commit `reference/baseline-0.1.0.json` + `docs/performance.md` table `cold 633ms / recompile 68ms / build 315ms → 0.1.0 medians`. ~1d.

4. **Docs polish pass (reference tier)** — Classify each `docs/*.md` as `reference` (per `docs/AGENTS.md:7`) before edit. Fix fact homes (one home per fact, elsewhere link): `docs/commands.md#environment-variables` is env vars home; `CHANGELOG.md` is history home — remove `previously`/`now`/`changed from` narration from `internal-api.md`/`architecture.md`/`compatibility.md`. One physical line per paragraph (blank line between) — split paragraph walls into lists/tables. Concrete prose: name exact packages/files/env vars/flags. Audit slop checklist per file: duplicated facts, narrated history, status annotations (`implemented`/`done`/`WIP` in reference body), hand-restated source, emphasis inflation, paragraph walls. Fix relative links — every `[text](docs/...#fragment)` target file exists and `#fragment` matches heading slug exactly (verify with `grep -n "^## "` headings). ~2d.

5. **Write `CHANGELOG.md ## [0.1.0]`** — Exactly one section `## [0.1.0] - YYYY-MM-DD` (rule `AGENTS.md:13` + `CONTRIBUTING.md#changelog-rule`: one section per version). Internally structure `### Breaking Changes` (list Phases 1,4,5,8 breaks with before/after one-liners + `rspfx migrate --to 0.1` pointer), `### Features` (kernel caching, lazyCompilation, dev store/machine, config schema), `### Fixes` (P0 `rspack.ts:143` resolve, `rsbuild.ts:292` certs, `rsbuild.ts:486` DefinePlugin order, `platformOnlyExternal`). Link to tag compare URL. Do not duplicate in `docs/`. ~0.5d.

6. **Add Agent Notes** — For non-trivial changes, write `.agents/notes/implemented/<class>/2026-08-24-release-0.1.0.md` etc with uniform header (`# Agent Note: Release 0.1.0` line1, blank line2, `Status: implemented` line3) per `docs/AGENTS.md` verification; rationale lives there, not in `docs/`. Delete worklogs. Verify `wc -w docs/AGENTS.md` ≤1000 (this file) and `wc -w .agents/notes/README.md` ≤500 per budgets table. ~0.5d.

7. **Build + test + typecheck gate (local, no CI)** — Run `pnpm build` (all `packages/*` ESM `dist/` with `.js` imports, `paths:{}` empty per AGENTS.md build rule), `pnpm typecheck` (no `TS` errors, `strict:true`), `pnpm test` (parity + config schema + migrate dry-run + doctor --fix). No `type-coverage`/`depcruise` CI gates — local only. Verify `core` still only `valibot` dep (if Option A) via `grep dependencies packages/core/package.json`. ~1d.

8. **Dry-run publish** — Run `pnpm publish:dry` or `node scripts/publish.mjs --dry-run` (per `AGENTS.md` publishing rule). It verifies git clean (no dirty `reference/*.json` drift), `CHANGELOG.md` has `## [0.1.0]`, then prints AI-agent reminder to update `CHANGELOG.md` `## [X.Y.Z]` before real publish — this is the reminder consumed by dry run. Fix any `ERROR: missing CHANGELOG` or `tag mismatch`. No live run yet. ~0.5d.

9. **Tag + publish (live)** — Ensure `git` clean, `pnpm build && pnpm test` green. Run `node scripts/publish.mjs --tag latest` (default `latest`, `next` for prereleases per `scripts/publish.mjs:17`) — it bumps `CHANGELOG.md`, commits `chore: bump v0.1.0`, creates annotated `git tag v0.1.0` linked to changelog section. Then `git push --follow-tags` and `pnpm publish` via `scripts/publish.mjs` (not `bun publish`). Verify `npm view @mbsks/rspfx-core dist-tags` shows `latest: 0.1.0` and `git tag --list | grep v0.1.0`. Document push in PR. ~0.5d. (Steps 8-9 can be dry-run only if maintainer prefers manual push; exit criteria counts dry-run green as gate.)

10. **Second-checkout verification** — On clean checkout, re-run steps 7-8 + `node bench/bench.mjs` median within ±15% host variance; re-generate `reference/*.json` byte-identical when re-generated (hash manifests JSON normalized sorted keys). Document variance host field (`darwin arm64 node 20.x`). ~0.5d.

### Data Structures / Types to Introduce

Phase 9 introduces **no production types** — only fixture schemas + changelog/tag types. For completeness:

```ts
// reference/baseline-0.1.0.json — shape (not exported)
interface BaselineSnapshot {
  version: "0.1.0";
  date: string; // YYYY-MM-DD e.g. 2026-08-24
  host: string; // `${process.platform} ${process.arch} node ${process.version}`
  projects: Record<string, { cold_start_ms:number; recompile_ms:number[]; recompile_median_ms:number; full_build_ms:number }>;
}

// scripts/publish.mjs:17 — publish opts (already exists)
interface PublishOpts { tag: 'latest'|'next'|string; dryRun: boolean; }

// Agent Note header — enforced by docs/AGENTS.md verification
// .agents/notes/implemented/<class>/YYYY-MM-DD-slug.md line 1 must be:
// # Agent Note: <title>
// blank line 2
// Status: implemented
```

No new `packages/*` exports; `docs/AGENTS.md` verification instead checks `pnpm test` gate + link resolution + word budgets + note header exact match.

### Migration Notes for Consumers

**For `0.0.13` → `0.1.0` upgrade:**

```bash
# 1. Read history (single home)
cat CHANGELOG.md # ## [0.1.0] - 2026-08-24 Breaking Changes + migration

# 2. Codemod (non-destructive preview)
pnpm add -D @mbsks/rspfx-cli@0.1.0 @mbsks/rspfx-core@0.1.0
npx rspfx migrate --to 0.1 --dry-run   # diff: contributions→rspack, as const, satisfies FrameworkPreset<'id'>, fsCachePath
npx rspfx migrate --to 0.1            # writes + backup .rspfx/migrate-backup.json (once)
# revert if needed
npx rspfx migrate --revert

# 3. Validate
npx rspfx doctor         # prints Issue.path if strictObject dust found
npx rspfx doctor --fix   # recreates missing config/serve.json etc via ensureProjectConfigs
npx rspfx build          # expects typed FrameworkId literal
```

**If you pinned `^0.0.13`:** `npm install` will not auto-upgrade major `0.1.0` (breaking). Update `package.json` to `^0.1.0` and run `pnpm install`.

**If you vendored `docs/plan-0.1.0.md` notes:** fact homes moved — env vars `RSPFX_LOG_LEVEL` etc now only at `docs/commands.md#environment-variables`; history only at `CHANGELOG.md ## [0.1.0]`; pipeline only at `docs/architecture.md`. Update internal wiki links.

**If you imported `core/plugins` internals:** `defineConfig` now `const T` generic — add `as const` on `framework` literal or `satisfies FrameworkPreset<'react'>` via `plugin-api`. `resolveConfig` dust now throws `CONFIG_VALIDATION_FAILED` — replace `as any` casts with `tryResolveConfig` handling.

### Exit Criteria (functional, not CI)

- [ ] `CHANGELOG.md` has exactly one `## [0.1.0] - YYYY-MM-DD` section (fact home) — `grep -c "^## \[0\.1\.0\]" CHANGELOG.md` = 1; section links to `git tag v0.1.0` annotated tag; no other file narrates `previously/now/changed from` (slop audit pass).
- [ ] `pnpm publish:dry` / `node scripts/publish.mjs --dry-run` succeeds — verifies git clean, `## [0.1.0]` present, prints AI-agent reminder per `AGENTS.md` publishing rule; `pnpm publish` would succeed (not run in PR if maintainer wants manual).
- [ ] `git tag v0.1.0` annotated (`git tag -n | grep 0.1.0` shows message) and `git push --follow-tags` pushed (or ready to push) — `npm view @mbsks/rspfx-core dist-tags` shows `latest: 0.1.0` after live run (or `next` if pre).
- [ ] All `packages/*/package.json` + `apps/cli/package.json` version `0.1.0` identical; `examples/*` and `apps/playground` remain `"private": true` — `grep -r '"private": true' examples/*/package.json` passes; `pnpm publish` would not publish examples.
- [ ] `pnpm build` emits all `packages/*/dist` + `apps/cli/dist` as ESM with `.js` local imports; `tsconfig.build.json` `paths:{}` empty (AGENTS.md build rule) — `grep -n "paths" packages/*/tsconfig.build.json` shows `{}`.
- [ ] `pnpm typecheck` passes `strict:true`; `pnpm test` passes (parity `parity.test.ts:104` green on all three bundlers, `migrate --dry-run`, `doctor --fix`); parallel forks work (Phase 1 proof).
- [ ] `node bench/bench.mjs` on `examples/shadcn`/`examples/svelte`/`templates` yields `reference/baseline-0.1.0.json` with `cold_start_ms <2000`, `recompile_median_ms <300`, `full_build_ms <4000` (small) per `ARCHITECTURE.md:218`; median delta vs `baseline-0.0.13.json` relative not absolute, within ±15% host variance documented.
- [ ] `reference/parity-0.1.0.hashes.json`, `reference/sppkg-0.1.0.crc.json`, `reference/sizes-0.1.0.json` committed and byte-identical on second checkout (hash manifests sorted keys, ZIP CRC normalized `\n` line endings per `reference/FORMATS.md`).
- [ ] Docs pass verification: every relative link resolves (`target exists && #fragment matches heading slug`), `wc -w docs/AGENTS.md` ≤1000, `wc -w .agents/notes/README.md` ≤500, every `docs/*.md` classified as `reference` before edit, one line per paragraph, concrete prose naming exact packages/files/env vars/flags, slop checklist clean (no duplicated facts, no narrated history, no status annotations, no hand-restated source, no emphasis inflation, no paragraph walls).
- [ ] Agent Notes for non-trivial doc/behavior changes exist at `.agents/notes/implemented/<class>/YYYY-MM-DD-slug.md` with header `# Agent Note: <title>` line1, blank line2, `Status: implemented` line3; worklogs deleted; `pnpm test` is only gate (verified via `docs/AGENTS.md` verification rule).
- [ ] `core` still `valibot` only dep (if Option A) — `cat packages/core/package.json | grep -A2 dependencies` shows only `valibot`; `docs/architecture.md:63` documents exception; `ARCHITECTURE.md:102` updated.
- [ ] `templates/*` scaffolds emit `defineConfig` literal-preserving form and build via `rspfx build` on Node 20+ (`pnpm --filter @mbsks/rspfx-cli build` + `rspfx build` on fresh `rspfx new` template).

### Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **`CHANGELOG.md` section missing or duplicated** — `scripts/publish.mjs --dry-run` fails and blocks tag | High | Run `pnpm publish:dry` before real push (local gate). Enforce exactly one `## [0.1.0]` via `grep -c` in PR checklist; `CONTRIBUTING.md#publishing-and-tagging` states live run checks `CHANGELOG.md` has `## [X.Y.Z]` before bump. |
| **Git tag `v0.1.0` not annotated or not pushed with `--follow-tags`** | High | Use `git tag -a v0.1.0 -m "0.1.0"` (annotated) and `git push --follow-tags` per `AGENTS.md` publishing rule; `scripts/publish.mjs` does both atomically — prefer it over manual `git tag`. Verify `git tag -n`. |
| **Docs link breakage** — relative link `#environment-variables` fragment mismatch | High | Every doc change runs manual link check (or `grep -n "^## "` headings vs `](` links). `docs/AGENTS.md` verification states every relative link must resolve with fragment matching heading slug. CI not available — run `node scripts/check-links.mjs` locally if script exists, else manual. |
| **Bench variance masks regression** — `darwin arm64` vs `linux x64` median differs 30% | Medium | Capture `host` field in `reference/baseline-0.1.0.json`; require `BENCH_RUNS=3` median, not single; assert relative improvement `-40%` on same host, not absolute `68ms`. Document ±15% variance allowed. |
| **Examples bundle size bloat** — `react ~90kB` treemap exceeded by new `valibot` if bundled in prod | Medium | `valibot` is `core` dev/build schema only, not bundled into `dist/*.js` web part — tree-shaken. Verify via `rspfx build` + `du -sb` on `examples/shadcn/dist/*.js` vs `reference/sizes-0.0.13.json`; if bloat >10% investigate `core` externalization. |
| **Word budget overrun** — `docs/AGENTS.md` 1,000 or `.agents/notes/README.md` 500 exceeded after notes | Medium | Enforced at file level (`wc -w`). Over budget: relocate content to fact home, then condense, then raise with justification per `docs/AGENTS.md` word budgets table. `docs/internal-api.md` exempt but stay concise. |
| **Publish dist-tag confusion** — `--tag next` vs `latest` | Low | `scripts/publish.mjs:17` default `latest`, `next` for prereleases; override `--tag` per `AGENTS.md` publishing rule. PR description states intended dist-tag; `npm view` verify after push. |
| **Private `examples/*` accidentally published** | Low | Verify `"private": true` in `examples/*/package.json` and `apps/playground/package.json` before `pnpm publish`; `AGENTS.md` publishing rule states they must stay private. Add pre-publish `grep -l '"private": true' examples/*/package.json` gate (local, not CI). |
| **`pnpm build` ESM `.js` import drift** — missing `.js` suffix breaks `dist/` | Medium | Keep `AGENTS.md` build rule: keep `paths:{}` empty in `tsconfig.build.json`, add `.js` to all local imports (`from './errors.js'`). Verify `grep -r "from '\./.*[^.js]'` packages/*/src` finds none before tag. |

### Effort Estimate

**6 days single engineer; ~4 days with two (docs vs bench/release parallel):**

* Day 1: Versions bump + private guard + parity/sppkg/sizes capture `reference/*` drift diff (1d).
* Day 2: Benchmark `BENCH_RUNS=3` medians `examples/shadcn`/`svelte`/`templates` → `reference/baseline-0.1.0.json` + `docs/performance.md` treemap (1d).
* Day 3: Docs polish `internal-api.md`/`commands.md`/`architecture.md`/`compatibility.md`/`README.md` — one-line-per-paragraph + slop + fact homes + link check (1.5d).
* Day 4: `CHANGELOG.md ## [0.1.0]` + Agent Notes `.agents/notes/implemented/...` + budgets `wc -w` + header verification (1d).
* Day 5: `pnpm build`/`typecheck`/`test` gate + `pnpm --filter @mbsks/rspfx-cli build` + `node bench/bench.mjs` re-run + second-checkout verification (0.75d).
* Day 6: `pnpm publish:dry` (`scripts/publish.mjs --dry-run`) + live tag `v0.1.0` + `git push --follow-tags` + `npm dist-tags` verification + review (0.75d).

With two engineers: E1 docs+changelog+notes (2d) || E2 bench+parity+sizes+build gate (2d), then pair on publish dry-run + tag (0.5d) + review (0.5d).

No CI changes in either phase — verification is `pnpm build && pnpm test && pnpm typecheck && node bench/bench.mjs` plus `pnpm publish:dry` and manual link/budget checks, all run locally on the feature branch before `git push --follow-tags`.
