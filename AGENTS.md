See `README.md`, `ARCHITECTURE.md`, and `docs/` for more.

## Commands
- `pnpm build` — builds `packages/*` only.
- `pnpm test` — run tests from repo root.
- `pnpm --filter @mbsks/rspfx-cli build` — builds the CLI. Do this before using `rspfx`.
- `node bench/bench.mjs` — runs benchmark. Needs built CLI.

## Publishing

- Run `pnpm publish` / `node scripts/publish.mjs [--tag <dist-tag>]` (not `bun publish`).
- Dry run: `pnpm publish:dry` / `node scripts/publish.mjs --dry-run` — verifies tag + `CHANGELOG.md`, then prints an AI-agent reminder to update `CHANGELOG.md` `## [X.Y.Z]` before the real publish (AI agents work primarily in this repo).
- Live run checks git is clean, verifies `CHANGELOG.md` has `## [X.Y.Z]`, builds, tests, bumps version, publishes with npm dist-tag (`latest` default, `next` for prereleases, override `--tag`), commits bump and creates annotated git tag `vX.Y.Z` linked to the changelog section. Push with `git push --follow-tags`.
- Changelog rule: one `## [X.Y.Z] - YYYY-MM-DD` section per version in `CHANGELOG.md` — the single home for history (see `docs/AGENTS.md#fact-homes` and `CONTRIBUTING.md#changelog-rule`).
- All `packages/*` + `apps/cli` share one version.
- `examples/*` and `apps/playground` must stay private.

## Build

- Each package builds with `tsc` to `dist/` as ESM.
- Keep `paths: {}` empty in `tsconfig.build.json`.
- Add `.js` to all local imports (e.g. `from './errors.js'`).
- `rspfx-core` must have no dependencies.
