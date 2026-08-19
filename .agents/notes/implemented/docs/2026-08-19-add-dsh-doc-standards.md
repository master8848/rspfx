# Agent Note: Add DSH documentation standards

Status: implemented

## Context

The repository had `AGENTS.md` for build and toolchain rules but lacked a documentation tier taxonomy, writing rules, word budgets, and a durable rationale log. The DSH harness documents code changes over time via `docs/AGENTS.md` and `.agents/notes/`; this project had neither `docs/AGENTS.md` nor `.agents/notes/README.md` (both missing on disk) and no `AGENT.md` entry point.

## Decision

Add `docs/AGENTS.md` (431 words) defining tier taxonomy (reference vs tutorial), fact homes (rationale → `.agents/notes/implemented/`, current behavior → `docs/` reference pages, env vars → `docs/commands.md` and `AGENTS.md:47`, standing rules → `docs/AGENTS.md`), writing rules (current state, one physical line per paragraph, concrete packages/files/env vars/flags), word budgets (`docs/AGENTS.md` ≤1,000, `docs/wasm.md` ≤1,800, `docs/optimization-notes.md` ≤2,000, `.agents/notes/README.md` ≤500), slop checklist, and verification. Add `.agents/notes/README.md` (271 words) defining classification (`feature`/`fix`/`optimization`/`docs`/`refactor`), uniform note format (`# Agent Note: <title>` / blank / `Status: implemented` plus `## Context`/`## Decision`/`## Consequences`), lifecycle (co-commit, worklog converts then deleted), and verification. Add `AGENT.md` as a pointer to `AGENTS.md`, `docs/AGENTS.md`, and `.agents/notes/README.md`. Create `.agents/notes/implemented/{feature,fix,docs}/` with `.gitkeep`.

## Consequences

Documentation now has one home per fact with links instead of duplication. Non-trivial changes ship with a uniform Agent Note at `.agents/notes/implemented/{class}/YYYY-MM-DD-slug.md`. Word budgets and link/fragment verification are mechanically checkable (`wc -w`, `head -3`, relative link resolution). Existing docs are unaffected; `docs/AGENTS.md` links resolve to `docs/internal-api.md`, `docs/commands.md`, `docs/architecture.md`, and `AGENTS.md:47`.
