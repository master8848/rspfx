See `README.md`, `ARCHITECTURE.md`, and `docs/` for more.

## Commands
- `pnpm build` — builds `packages/*` only.
- `pnpm test` — run tests from repo root.
- `pnpm --filter @mbsks/rspfx-cli build` — builds the CLI. Do this before using `rspfx`.
- `node bench/bench.mjs` — runs benchmark. Needs built CLI.

## Publishing

- Run `pnpm publish` / `node scripts/publish.mjs` (not `bun publish`).
- It checks git is clean, builds, tests, bumps version, publishes, and commits.
- All `packages/*` + `apps/cli` share one version.
- `examples/*` and `apps/playground` must stay private.

## Build

- Each package builds with `tsc` to `dist/` as ESM.
- Keep `paths: {}` empty in `tsconfig.build.json`.
- Add `.js` to all local imports (e.g. `from './errors.js'`).
- `rspfx-core` must have no dependencies.
