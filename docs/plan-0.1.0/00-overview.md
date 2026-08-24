# RSPFX 0.1.0 — Breaking Improvements Plan (Expanded, No CI Changes)

> **Baseline:** `v0.0.13` → **Target:** `0.1.0` (breaking). Breaking API allowed to make base better.
> **Constraint:** **NO CI CHANGES** — no `.github/workflows`, no CI jobs. Verification is local `pnpm build` + `pnpm test` + `pnpm typecheck` + `node bench/bench.mjs`.
> **Principles:** `core` zero-deps (`ARCHITECTURE.md:102`), `paths:{}` empty, `.js` imports, `CHANGELOG.md ## [0.1.0]` + `git tag v0.1.0` + `git push --follow-tags`.
> **Inputs:** 5 maintainer lenses — TanStack (type-safe headless), Solid (signals/owner), Svelte (compiler/runes), Rust (Result/ownership), Rspack/Rsbuild (cache/lazyCompilation).

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

**Estimates:** 85d single-thread, ~45d with 2 engineers (TS kernel + Rust/framework parallel). All verification local. Expanded via 5 parallel subagents.
