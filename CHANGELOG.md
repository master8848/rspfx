# Changelog

All notable changes to this project are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each version corresponds to an annotated git tag `vX.Y.Z` and an npm dist-tag (see [Publishing and tagging](#publishing-and-tagging) below). The single source of truth for history is this file — do not duplicate version history in `docs/` reference pages (see `docs/AGENTS.md`).

## [Unreleased]

### Added
- Per-version changelog rule and tag linkage (this file).

## [0.0.13] - 2026-08-23

- `fix(plugin/vite):` use `asIs` localsConvention to match rspack css modules
- `feat:` vite as default bundler, robust styling defaults (scss/modules/postcss tailwind)
- `docs:` RSPFX-only frameworks, PnPjs for lists, dual-toolchain interchange
- `feat(core,plugin-api,dev-runtime):` custom frameworks via plugin registry (see `.agents/notes/implemented/feature/`)
- `fix:` architecture splits and perf polish, test debt, fluent-adapter peer fixes

> Git tag: `v0.0.13` · npm dist-tag: `latest` · Packages: `packages/*` + `apps/cli` at `0.0.13` (single version, `scripts/publish.mjs`).

## [0.0.12] - 2026-08-23

- Initial publishable baseline for `0.0.12` (see `git log 4bd4ceb..5410ef7`).

> Git tag: `v0.0.12` · npm dist-tag: `latest`.

## Publishing and tagging

- **Git tag:** `vX.Y.Z` annotated tag created by `scripts/publish.mjs` on every successful publish. Message body references `CHANGELOG.md#X-Y-Z`. Push with `git push --follow-tags` or `git push origin vX.Y.Z`.
- **npm dist-tag:** published via `pnpm publish --tag <dist-tag>` (default `latest`; prereleases default to `next`; override with `node scripts/publish.mjs --tag <dist-tag>`). All 19 publishable packages share the same version and tag in one run.
- **CHANGELOG.md:** one `## [X.Y.Z] - YYYY-MM-DD` section per version. Link the tag in the section footer. `Unreleased` tracks work since the last tag.

[Unreleased]: https://github.com/master8848/rspfx/compare/v0.0.13...HEAD
[0.0.13]: https://github.com/master8848/rspfx/compare/v0.0.12...v0.0.13
[0.0.12]: https://github.com/master8848/rspfx/releases/tag/v0.0.12
