# Contributing to RSPFX

This guide covers local development, the per-version changelog rule, and the tagging and publishing workflow. For documentation standards see `docs/AGENTS.md`; for project layout see `docs/architecture.md#package-map` and `docs/project-structure.md`.

## Getting started

```sh
pnpm install
pnpm build        # builds packages/* only (see AGENTS.md)
pnpm --filter @mbsks/rspfx-cli build  # before using rspfx
pnpm test         # vitest at repo root
```

Requirements: Node `>=20` (`package.json:9`), pnpm `10.33.0` (`package.json:8`). Use `pnpm publish` / `node scripts/publish.mjs` for releases — not `bun publish` (see `AGENTS.md#publishing`).

## Development workflow

- Branch from `main`, keep `git status` clean — `scripts/publish.mjs:227` aborts on a dirty tree.
- Run `pnpm build` and `pnpm test` before pushing; CI gates on both plus `pnpm typecheck`.
- One fact, one home — see `docs/AGENTS.md#fact-homes`. Reference pages (`docs/`) describe current state only; history lives in `CHANGELOG.md`.
- Non-trivial changes ship with an Agent Note at `.agents/notes/implemented/{class}/YYYY-MM-DD-slug.md` (see `.agents/notes/README.md` and `docs/AGENTS.md#non-trivial-changes-carry-an-agent-note`).

## Changelog rule

Single home for history: `CHANGELOG.md` at the repo root.

- Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) + [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
- One `## [X.Y.Z] - YYYY-MM-DD` section per version, newest at top. Use `### Added` / `### Changed` / `### Fixed` subsections.
- Each section footer links to its git tag `vX.Y.Z` and npm dist-tag (see `CHANGELOG.md#publishing-and-tagging`).
- `## [Unreleased]` tracks work since the last tag. On publish, promote its entries into the new `## [X.Y.Z]` section.
- Never duplicate version history in `docs/` reference pages — see `docs/AGENTS.md#writing-rules` and the slop checklist (`docs/AGENTS.md#slop-checklist`).

Example:

```md
## [Unreleased]
### Added
- Fast refresh for Vue via vite plugin

## [0.0.14] - 2026-08-24
### Fixed
- `rspfxVite` CSS-modules localsConvention

> Git tag: v0.0.14 · npm dist-tag: latest
```

## Publishing and tagging

All 19 publishable packages (`packages/*` + `apps/cli`, all `@mbsks/rspfx-*`) share one version bumped together via `scripts/publish.mjs:17`. `examples/*` and `apps/playground` are `private:true` and never published (see `scripts/publish.mjs:66`).

### npm dist-tag and git tag

- **npm dist-tag:** `latest` for stable releases, `next` for prereleases (versions containing `-`, e.g. `0.1.0-beta.1`). Override with `--tag <dist-tag>`:
  ```sh
  node scripts/publish.mjs --tag next      # or beta, canary, etc.
  pnpm publish -- --tag next
  ```
  `scripts/publish.mjs:188` computes the tag and passes `--tag <tag>` to `pnpm publish` (`scripts/publish.mjs:272`).

- **Git tag:** annotated tag `vX.Y.Z` created after the bump commit (`scripts/publish.mjs:327`). Message body references `CHANGELOG.md ## [X.Y.Z]` and the npm tag. Push with:
  ```sh
  git push --follow-tags
  # or
  git push origin v0.0.14
  ```
  The publish script skips tag creation if `vX.Y.Z` already exists (resume path).

- **Linkage:** each `CHANGELOG.md` section links to its tag. Tags are the changelog's anchors — `git log v0.0.13..v0.0.14` should match the `## [0.0.14]` entries.

### Publish workflow

1. Update `CHANGELOG.md`: add or promote `## [X.Y.Z] - YYYY-MM-DD`.
2. Dry run (verifies tag and changelog, no side effects):
   ```sh
   pnpm publish:dry
   # or
   node scripts/publish.mjs --dry-run
   node scripts/publish.mjs --dry-run --tag next --version 0.1.0-beta.1
   ```
   Dry runs print an AI-agent reminder to add the changelog entry (see below) and an advisory `✓/⚠` for `CHANGELOG.md`.
3. Live run (requires clean tree, builds, tests):
   ```sh
   pnpm publish                 # patch bump, tag latest
   pnpm publish -- --minor      # or --major, --version 1.0.0, --tag next
   node scripts/publish.mjs --skip-checks  # only outside CI
   ```
   Live run also warns if `CHANGELOG.md` lacks `## [X.Y.Z]` (`scripts/publish.mjs:240`) but continues.
4. Push:
   ```sh
   git push --follow-tags
   ```

Flags: `--dry-run`, `--version X.Y.Z`, `--patch|--minor|--major` (default `patch`), `--tag <dist-tag>`, `--skip-checks` (blocked when `CI` is set), `--otp <code>` (prefer `RSPFX_NPM_OTP` env), `--no-commit`.

## AI agent guidance

AI agents work primarily in this repo. The dry-run reminder is actionable:

- On `node scripts/publish.mjs --dry-run` the script prints:
  ```
  ┌─ AI AGENT REMINDER ──────────────────────────────────────────────
  │ Before the next real publish, AI agents (and humans) must:
  │   1. Add/update CHANGELOG.md ## [X.Y.Z] - YYYY-MM-DD
  ...
  │ See CONTRIBUTING.md#publishing-and-tagging and CHANGELOG.md.
  └────────────────────────────────────────────────────────────────
  ```
  plus a `✓ CHANGELOG.md already contains ## [X.Y.Z]` or `⚠` warning.

- **Do not** publish without a `## [X.Y.Z]` entry. Promote `## [Unreleased]` or create the section, commit it, then run the live publish. The changelog is per-version — never append to an old version's section.

- Link `docs/` changes back to the changelog only via `CHANGELOG.md`, not by narrating history in reference pages.

## Questions

Open an issue or see `README.md#documentation` for the doc index. For release history, see `CHANGELOG.md` (and `git tag --list` / `npm dist-tag ls @mbsks/rspfx-core`).
