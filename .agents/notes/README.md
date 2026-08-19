# Agent Notes

This directory tracks rationale for non-trivial changes. Current behavior lives in `docs/`; rationale lives here. One note per change, co-committed with the change.

## Classification

Classify each note by the change class (directory under `implemented/`): `feature`, `fix`, `optimization`, `docs`, `refactor`. Use the class that matches the primary effect. If two apply, pick the user-visible one.

## Format

Each note is `.agents/notes/implemented/{class}/YYYY-MM-DD-slug.md` with uniform header. Line 1 must be `# Agent Note: <title>`. Line 2 must be blank. Line 3 must be `Status: implemented`. No other status values are used; lifecycle is file presence. Body sections are `## Context`, `## Decision`, `## Consequences`, each one paragraph per block (one physical line per paragraph), concrete prose with exact files, packages, and flags.

Example path: `.agents/notes/implemented/feature/2026-08-19-add-template-scanner.md`. Keep titles short, slugged with hyphens, dated to the commit.

## Lifecycle

Create the note in the same commit as the change. A worklog (`worklog.md` or scratch notes) converts into exactly one note, then the worklog is deleted. Do not leave both. Notes are never edited after merge except to fix broken links; rationale is immutable. Deletion means the decision was reverted via a new note.

## Verification

Every relative link in the note must resolve and every `#fragment` must match a heading slug in the target. Budgets: this file ≤500 words; each note ≤400 words. Header format is mechanically checked (`head -3`). Cross-link the fact home in `docs/` and link back to the note from the docs only when rationale is needed.

## Precedent

Existing notes under `.agents/notes/implemented/` define the uniform format. Match their headings, ordering, and tone before creating a new note.
