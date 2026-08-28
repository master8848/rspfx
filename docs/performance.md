# Performance

Measured speed of the RSPFX toolchain (Rspack-based) on real examples. Full methodology in [`bench/README.md`](../bench/README.md).

## Hardware

| | |
|---|---|
| Machine | Apple MacBook Pro (M1 Pro) |
| CPU | Apple M1 Pro, 32 GB |
| OS | macOS 26.5.2 |
| Node | v24.13.0 |

## Methodology

| Metric | Definition |
|---|---|
| Cold start | `node apps/cli/dist/cli.js dev` → `Manifest server running` (deps installed, no prior server) |
| Recompile | Append comment to `src/webparts/*/` → SHA-256 of bundle changes (3 runs) |
| Full build | Remove `dist/`+`release/` → `node apps/cli/dist/cli.js build` wall time |

Harness: `bench/bench.mjs` (node-only). Browsers never opened in benchmark.

## Results

Results 2026-08-24 (`reference/baseline-0.0.14.json`, `BENCH_RUNS=3` median):

| Project | Cold start | Recompile (×3) | Median | Full build |
|---|---|---|---|---|
| `examples/vanilla` | 392 ms | 44, 42, 43 ms | 43 ms | 195 ms |
| `examples/svelte` | 410 ms | 45, 46, 44 ms | 45 ms | 210 ms |
| `examples/shadcn` (React + shadcn/ui + Tailwind v4) | 645 ms | 70, 68, 69 ms | 69 ms | 322 ms |

Gates: `cold <2000 ms`, `recompile <300 ms`, `build <4000 ms` — all pass.

## Comparison vs classic SPFx

| Metric | Classic (gulp `fast-spfx`, user-reported) | RSPFX (`shadcn`) | Factor |
|---|---|---|---|
| Dev start (cold) | ~120 s | 0.63 s | ~190× |
| Recompile | ~40 s | 68 ms | ~590× |

Classic numbers are user-reported approximations; margin is orders of magnitude so exact baseline does not affect the conclusion.

> Tip: compare on your hardware with `BENCH_RUNS=3 node bench/bench.mjs examples/shadcn` and `BENCH_RUNS=3 node bench/compare-official.mjs`. Classic toolchain is seconds, RSPFX is milliseconds — ratio holds across machines.

## Why it's fast

| Factor | Detail |
|---|---|
| Rust bundler | Rspack hot paths run in Rust, not JS |
| No gulp graph | Single CLI, no `clean → configure → serve` task orchestration |
| No Heft pre-pass | TS/JSX via SWC inline, no separate `tsc` step |
| Fewer plugins | Only what a web part needs, no webpack-v4 shims |

## On CI / slower hardware

Absolute numbers rise on Linux CI / Docker / slow disks, but ratio vs classic holds — both suffer same overhead. `node_modules` state dominates cold start. First run after clone pays install + cert generation (~1–2 s); subsequent starts skip both. Dev server writes to disk, so recompile includes disk time — add constant, not multiplier. Repro: `node bench/bench.mjs examples/shadcn`; `rspfx doctor`/`analyze` not benchmarked.
