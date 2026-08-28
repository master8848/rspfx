# RSPFx 0.1.0 — Breaking Improvements Plan (Expanded, No CI Changes)

> Split from [`docs/plan-0.1.0.md`](../plan-0.1.0.md) by phase. Each file is a standalone phase document; the original file remains as the single-file source.

## Overview

See [`00-overview.md`](./00-overview.md) for baseline, constraints, principles, and dependency DAG.

## Phases

| # | File | Phase | Scope |
|---|---|---|---|
| 0 | [`01-phase-0-baseline.md`](./01-phase-0-baseline.md) | Phase 0 — Baseline & Guardrails | Frozen 0.0.13 baseline, local guardrails, no breaks |
| 1 | [`02-phase-1-foundation.md`](./02-phase-1-foundation.md) | Phase 1 — Foundation: Types, Registry, Errors | Branded types, `createRSPFX` instance, `RspfxErrorCode`, `Result` |
| 2 | [`03-phase-2-headless-adapter.md`](./03-phase-2-headless-adapter.md) | Phase 2 — Headless Adapter | `HeadlessAdapter`, `webpart-base`, framework `headless` splits |
| 3 | [`04-phase-3-hooks-diagnostics.md`](./04-phase-3-hooks-diagnostics.md) | Phase 3 — Hooks & Diagnostics | Typed `HookBus`, structured logger, diagnostics |
| 4 | [`05-phase-4-dev-runtime-store.md`](./05-phase-4-dev-runtime-store.md) | Phase 4 — Dev Runtime Store & State Machine | Dev store, state machine, local preview |
| 5 | [`06-phase-5-bundler-kernel-caching.md`](./06-phase-5-bundler-kernel-caching.md) | Phase 5 — Bundler Kernel & Caching | Kernel extraction, caching, lazyCompilation |
| 6 | [`07-phase-6-rust-expansion.md`](./07-phase-6-rust-expansion.md) | Phase 6 — Rust Expansion | `crates/*` `zip`/`manifest`/`rspack-plugin` with JS fallback |
| 7 | [`08-phase-7-framework-modernization.md`](./08-phase-7-framework-modernization.md) | Phase 7 — Framework Modernization | Svelte 5 runes, Solid SWC, framework parity |
| 8 | [`09-phase-8-config-cli.md`](./09-phase-8-config-cli.md) | Phase 8 — Config Schema & CLI | `valibot` schema, `tryResolveConfig`, `migrate`/`doctor` |
| 9 | [`10-phase-9-polish-release.md`](./10-phase-9-polish-release.md) | Phase 9 — Polish & Release | Changelog, tag, publish, docs audits, benchmarks |

## Dependency DAG

```
Phase 0 Baseline (no breaks)
   ↓
Phase 1 Types/Registry/Errors (P0 breaking) ─┐
   ↓                                         ├─→ Phase 7 Framework Modernization
Phase 2 Headless Adapter (P0 breaking) ──────┘         ↑
   ↓                                         Phase 8 Config/CLI (needs Phase 1)
Phase 3 Hooks/Diagnostics (P0 breaking)
   ↓
Phase 4 Dev Store/State Machine
   ↓
Phase 5 Bundler Kernel/Caching (P0 correctness) ─→ Phase 6 Rust (can overlap 5)
   ↓                                                  ↓
              Phase 9 Polish & Release 0.1.0
```

Source: [`docs/plan-0.1.0.md`](../plan-0.1.0.md) `## Dependency DAG`.
