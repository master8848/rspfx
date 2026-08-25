# AGENTS.md — Documentation Standards

Reference for documentation tier taxonomy, writing rules, budgets, and verification. Standing rules live here; current behavior lives in `docs/` reference pages; rationale lives in `.agents/notes/implemented/`.

## Tier taxonomy

Reference documents are lookup scope, current behavior, exact signatures. Tutorial documents are guided sequences with expected output. This repository's `docs/` are references: `docs/internal-api.md` (package surfaces), `docs/commands.md` (CLI), `docs/architecture.md` (pipeline), `docs/compatibility.md` (SPFx matrix), `docs/supporting-a-new-spfx-version.md` (version procedure).

## Fact homes

One home per fact; elsewhere link there. Rationale and design decisions → `.agents/notes/implemented/{class}/YYYY-MM-DD-slug.md`. Current behavior, flags, file paths, env vars → the owning `docs/` reference page (`docs/commands.md` for CLI flags, `docs/internal-api.md` for package APIs, `docs/architecture.md` for pipeline). Operator env vars (`RSPFX_LOG_LEVEL`, `SPFX_SERVE_TENANT_DOMAIN`, `RSPFX_ACCESS_TOKEN`, `RSPFX_APP_CATALOG_URL`) → `docs/commands.md#environment-variables`. Version history (per-version changelog, one `## [X.Y.Z] - YYYY-MM-DD` section per version) → `CHANGELOG.md` (each section linked to git tag `vX.Y.Z` and npm dist-tag `latest`/`next`). Publish and tagging workflow (`--tag`, `vX.Y.Z`) → `CONTRIBUTING.md#publishing-and-tagging` and `scripts/publish.mjs:17`. Standing rules and writing constraints → this file.

## Writing rules

Reference pages describe current state, not history. Version history lives only in `CHANGELOG.md` (one section per version, tagged `vX.Y.Z`) — do not duplicate changelog narration ("previously", "now", "changed from") inside reference pages.

One physical line per paragraph in source (blank line between paragraphs). No soft-wrapped paragraph walls.

Concrete prose: name exact packages (`@mbsks/rspfx-core`, `@mbsks/rspfx-plugin`), files (`packages/core/src/versions.ts`, `apps/cli/src/commands/build.ts`), env vars (`RSPFX_LOG_LEVEL`), flags (`--dry-run`, `--tenant`, `--refresh`). No metaphors or abstract placeholders.

No reasoning transcripts or worklog narration in docs. Worklogs convert into Agent Notes or are deleted.

Classify each document as reference or tutorial before editing; these docs are references.

## Word budgets

Enforced at the file level. Over budget: relocate content to its fact home, then condense, then raise with justification.

| File | Limit |
|---|---|
| `docs/AGENTS.md` (this file) | 1,000 |
| `.agents/notes/README.md` | 500 |

Repository reference pages have no hard budget but stay concise; `docs/internal-api.md` is exempt due to API contract size.

## Slop checklist

Audit every doc change against: duplicated facts (exists in two homes), narrated history (version history outside `CHANGELOG.md`), status annotations (`implemented`, `done`, `WIP` in reference body), hand-restated source (paragraph that rephrases a code block below it), emphasis inflation (bold/italics/adverbs for importance rather than precision), paragraph walls (multi-line block that should be a list or table).

## Non-trivial changes carry an Agent Note

A non-trivial doc or behavior change ships with an Agent Note in the same commit at `.agents/notes/implemented/{class}/YYYY-MM-DD-slug.md` with uniform header, then delete the worklog. See `.agents/notes/README.md` for format, classification, and lifecycle.

## Verification

Every relative link must resolve: target file exists and `#fragment` matches a heading slug. Word budgets must hold (`wc -w`). Note header must be exactly `# Agent Note: <title>` on line 1, blank line on line 2, `Status: implemented` on line 3. `bun run test` is the only gate; `bun run build` and `bun run typecheck` cover package surfaces.
