# RSPFX Benchmarks

A dependency-free Node harness that measures the RSPFX toolchain on a real example project.

## Run

```sh
node bench/bench.mjs                  # default: examples/shadcn
node bench/bench.mjs examples/vanilla # or any project dir
```

Requires a built CLI (`apps/cli/dist/cli.js` — build with `pnpm --filter @mbsks/rspfx-cli build` if missing).

Env knobs:

| Var                | Default | Meaning                                        |
| ------------------ | ------- | ---------------------------------------------- |
| `BENCH_RUNS`       | `3`     | number of recompile iterations                 |
| `BENCH_KEEP_OUTPUT`| unset   | set to `1` to skip removing `dist/` + `release/` before the full build |

Each run prints a table plus a machine-readable `BENCH_RESULT ...` line.

## What it measures

| Metric | Definition |
| ------ | ---------- |
| **Cold start** | Spawn `node apps/cli/dist/cli.js dev --port <random>`, measure ms from process spawn until stdout contains `Manifest server running` (logged by `packages/dev-runtime/src/serve.ts:303` after the initial compile finishes). No prior dev server is running — but Node is already warm in the OS page cache and `node_modules` is already installed (see methodology notes below). |
| **Recompile** | With the dev server still running: append a timestamp comment to the first source file in `src/webparts/*/`, measure ms from the append (fs write) until the SHA-256 of the compiled bundle (`dist/<webpart>.js`, written to disk by the dev server, `writeToDisk: true`) changes. Repeated `BENCH_RUNS` times; the source file's original bytes are restored after every run. |
| **Full build** | Remove `dist/` and `release/`, then spawn `node apps/cli/dist/cli.js build` and measure total wall time until exit. |

### Methodology notes

- **Cold start definition**: cold = no server previously running on the port. The machine's file caches are warm and `node_modules` is pre-installed; this reflects the day-to-day "start coding" case, not a fresh clone. A truly cold npm-cache CI build adds install time on top (see `docs/performance.md`).
- **Recompile signal**: dev-mode bundles are not byte-deterministic across rebuilds, so the harness never compares against an "original" hash — it settles (hash stable for 300 ms), snapshots the hash, touches the file, and waits for the hash to change. Poll interval is 20 ms, so measurement resolution is ±20 ms.
- **Browser**: the dev server is spawned without `--browser` (browser opening is opt-in since `apps/cli/src/cli.ts`). No browser is opened during benchmarks.
- **Log level**: `RSPFX_LOG_LEVEL=info` is set explicitly for deterministic output. There is no quiet mode that would still emit the readiness marker.
- **TLS certs**: the dev server ensures certs in `~/.rspfx/certs` on first run. They pre-exist on the machine used for the numbers below; a machine without them pays a one-time ~1–2 s penalty on the first cold start.
- **File restore**: the harness captures the touched file's bytes before the run and writes them back after each recompile, then verifies byte-for-byte equality and fails if the check fails (examples are tracked by git — the harness still restores to avoid dirty working tree).
- **Output dirs**: the dev server and build write `dist/` (and the build `release/`) in the project. The harness leaves them in place; remove with `rspfx clean` in the project.
- **Timeouts**: cold start 180 s, recompile 60 s, build 600 s (generous; never hit on this machine).

## Hardware

| | |
| ------- | --- |
| Machine | Apple MacBook Pro (M1 Pro) |
| CPU | Apple M1 Pro |
| RAM | 32 GB (`sysctl -n hw.memsize` = 34359738368) |
| OS | macOS 26.5.2 |
| Node | v24.13.0 (`darwin arm64`) |

## Results (measured 2026-08-01)

| Project | Cold start | Recompile ×3 | Recompile min / median | Full build (clean) |
| ------- | ---------- | ------------ | ---------------------- | ------------------ |
| `examples/vanilla` | 380 ms | 42, 43, 43 ms | 42 / 43 ms | 189 ms |
| `examples/shadcn`  | 633 ms | 69, 68, 68 ms | 68 / 68 ms | 315 ms |

Interpretation and comparison against the classic gulp-based SPFx toolchain (fast-spfx baseline: ~120 s server start, ~40 s incremental recompile) live in [`docs/performance.md`](../docs/performance.md).

## Raw runs

```text
BENCH_RESULT project=vanilla cold_start_ms=380 recompile_ms=[42,43,43] recompile_min_ms=42 recompile_median_ms=43 full_build_ms=189
BENCH_RESULT project=shadcn cold_start_ms=633 recompile_ms=[69,68,68] recompile_min_ms=68 recompile_median_ms=68 full_build_ms=315
```
