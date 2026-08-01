# RSPFX Performance

Measured speed of the RSPFX toolchain (Rspack-based, replacing the classic gulp/webpack/heft SPFx stack) on real example projects, against the classic toolchain's reported baselines.

## Hardware

| | |
| ------- | --- |
| Machine | Apple MacBook Pro (M1 Pro) |
| CPU | Apple M1 Pro |
| RAM | 32 GB |
| OS | macOS 26.5.2 |
| Node | v24.13.0 |

## Methodology

Full methodology in [`bench/README.md`](../bench/README.md). Summary:

- **Cold start** = spawn `node apps/cli/dist/cli.js dev --no-browser` → time until the `Manifest server running` line appears (initial compile done). No prior dev server on the port; `node_modules` already installed and OS file caches warm.
- **Recompile** = append a timestamp comment to a source file in `src/webparts/*/` while the server runs → time until the compiled bundle's SHA-256 changes on disk. 3 runs per project; file bytes restored after every run.
- **Full build** = `dist/` and `release/` removed, then `node apps/cli/dist/cli.js build` wall time.
- Harness: `bench/bench.mjs` (node-only, no deps).

## Results (measured 2026-08-01)

| Project | Cold start (ms) | Recompile ×3 (ms) | Recompile min / median (ms) | Full build (ms) |
| ------- | --------------- | ----------------- | --------------------------- | --------------- |
| `examples/vanilla` | 380 | 42, 43, 43 | 42 / 43 | 189 |
| `examples/shadcn` (React + shadcn/ui + Tailwind v4) | 633 | 69, 68, 68 | 68 / 68 | 315 |

## Comparison vs classic SPFx (gulp serve / fast-spfx)

| Metric | Classic SPFx (fast-spfx, user-reported) | RSPFX (`examples/shadcn`) | Speed-up |
| ------ | --------------------------------------- | ------------------------- | -------- |
| Dev server start (cold) | ~120 s | 0.63 s | **~190×** |
| Incremental recompile | ~40 s | 68 ms (median) | **~590×** |
| Production build | (not benchmarked) | 315 ms | — |

Baseline figures are user-reported for `fast-spfx`/`gulp serve` on similar hardware and are cited as an approximation; the classic stack's actual numbers depend on machine, plugin load and `node_modules` state. On this machine the margin is so large that the exact baseline barely matters — the classic toolchain is measured in seconds, RSPFX in milliseconds.

## Why it's fast

- **Rspack is a native (Rust) bundler** — the compile, transform, and code-generation hot paths run in Rust instead of JavaScript, which is where most of the classic stack's time goes.
- **No gulp pipeline.** Classic SPFx runs the task graph (`clean → configure-sp-build-utilities → … → serve`) with heavy per-task JS orchestration; RSPFX is a single CLI command that starts one dev server.
- **No heft pre-processing.** No `tsc`-based transpile pass, no separate copy/manifest stages before the bundle — TS/JSX/TSX is transformed inline by SWC (Rust) builtin loaders during the bundle step, and manifests are generated from in-memory compile results.
- **Fewer plugins, no webpack-era plugin tax** — the classic build loads many SPFx build-system plugins (including webpack v4-era shims); RSPFX config wires only what a web part actually needs.
- **Dev server writes to disk and signals readiness** after the first compile — no long dependency graph, license checks, or npm-driven stages between start and "ready".

## What to expect on CI / corporate machines

- Numbers above are for a local Apple Silicon machine with warm caches. On Linux CI runners, cold Docker images, or slower disks, expect higher absolute numbers — but the **ratio** versus the classic stack holds because both stacks suffer the same environmental overhead.
- **`node_modules` state dominates cold starts.** The measured "cold start" assumes dependencies are already installed. A fresh `pnpm install` (classic: `npm install` with package.json shrinkwraps, often 1–3+ min) adds on top for both stacks; RSPFX's own serve path adds only a few hundred ms once install is done.
- **Warm-cache note**: the first `rspfx dev` after a fresh clone pays install + a one-time `~/.rspfx/certs` generation (~1–2 s); subsequent starts skip both. Keep `node_modules` intact across sessions to stay in the measured regime — every npm reinstall resets the cache the toolchain depends on.
- **Disk speed matters**: the dev server writes bundles to disk (`writeToDisk`), so recompile latency includes disk write time; on network-backed or heavily loaded corporate storage add a small constant, not a multiplier.
- Reproducing: run `node bench/bench.mjs examples/shadcn` (see [`bench/README.md`](../bench/README.md)). `rspfx doctor`/`rspfx analyze` are not part of the benchmark.
