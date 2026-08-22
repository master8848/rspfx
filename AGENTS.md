See `README.md`, `ARCHITECTURE.md`, and `docs/` for more.

## Commands
- `bun build` — builds `packages/*` only.
- `bun test` — run tests from repo root.
- `bun --filter @mbsks/rspfx-cli build` — builds the CLI. Do this before using `rspfx`.
- `node bench/bench.mjs` — runs benchmark. Needs built CLI.

## Publishing

- Run `bun run publish` (not `bun publish`).
- It checks git is clean, builds, tests, bumps version, publishes, and commits.
- All `packages/*` + `apps/cli` share one version.
- `examples/*` and `apps/playground` must stay private.

## Build

- Each package builds with `tsc` to `dist/` as ESM.
- Keep `paths: {}` empty in `tsconfig.build.json`.
- Add `.js` to all local imports (e.g. `from './errors.js'`).
- `rspfx-core` must have no dependencies.
