# Agent Note: Dedup docs and add roadblocks and real-tenant gating docs

Status: implemented

## Context

Doc audit flagged duplicated env vars in 7 files, version literals `1.20|1.21|1.22|1.23` in 5 files, architecture triple `README.md:64` vs `docs/architecture.md:40` vs `ARCHITECTURE.md:110`, narrated history (`internal-api.md:383`, `migration-case-study.md:44`), paragraph walls (`internal-api.md:429`, `building-packages.md:3`), emphasis inflation, and missing roadblock/real-tenant gateway. Community takeover assessment required explicit blockers.

## Decision

Move env vars to home `docs/commands.md:53,150` + `AGENTS.md:47` and replace copies in `docs/building-packages.md:14,159,185`, `docs/getting-started.md:102,125,175`, `docs/internal-api.md:403,653`, `docs/roadmap.md:29` with `see docs/commands.md#rspfx-deploy`. Move SPFx matrix to `docs/compatibility.md:32` + `packages/core/src/versions.ts:13` and replace literals in `docs/commands.md:24`, `README.md:61`, `docs/why-not-to-migrate.md:26` etc. Keep package map only in `docs/architecture.md:40`, make `README.md:64` a 3-line pointer. Convert walls to single-line list/table per `docs/AGENTS.md:15` and strip `✅ **Done**` bold. Create `docs/roadblocks.md:1` (914/1000 words) with tables for `Real-tenant gate`, `Security hardening remaining`, `Compatibility and bundler limits`, `Migration and support gaps`, `When to adopt vs wait` linking to `apps/cli/src/commands/deploy.ts:16`, `packages/templates/src/index.ts:638`, `benchmarks`. Create `docs/real-tenant-validation.md:1` (723/1000) tutorial `rspfx new` → `package` → `/_api` → workbench with `RSPFX_ACCESS_TOKEN` 120s timeout and `SPFX_SERVE_TENANT_DOMAIN=` test note. Add cross-links in `docs/compatibility.md:48`, `docs/getting-started.md:100`, `docs/roadmap.md:1`.

## Consequences

One home per fact per `docs/AGENTS.md:11`; `docs/roadmap.md:21` no longer duplicated. `docs/roadblocks.md:1` and `docs/real-tenant-validation.md:1` provide explicit blockers and `bench/bench.mjs`/`compare-official.mjs` steps, with `BENCH_RUNS=3` and `reference/FORMATS.md:1` provenance. Budgets hold (914,723,431,270). Links verified (`#spfx-version-matrix`, `#rspfx-deploy`, `../ARCHITECTURE.md`, `../reference/FORMATS.md`).
