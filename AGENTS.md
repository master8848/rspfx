# AGENTS.md

RSPFX: an SPFx-compatible build toolchain powered by Rspack (replaces Heft + webpack + gulp). pnpm monorepo, ESM only. See `README.md`, `ARCHITECTURE.md`, and `docs/` (esp. `docs/internal-api.md`, `docs/commands.md`).

## Commands

- `pnpm build` — builds **only `packages/*`** (each runs `tsc -p tsconfig.build.json`). Does NOT build `apps/*` or `examples/*`.
- `pnpm typecheck` — `tsc --noEmit` across `packages/*` only.
- `pnpm test` / `pnpm test:watch` — vitest from repo root (always run tests from repo root; run `pnpm test` so cross-package aliases/stubs resolve).
- CLI must be built separately before anything that invokes `rspfx` (bench, examples, playground): `pnpm --filter @mbsks/rspfx-cli build` → `apps/cli/dist/cli.js`.
- Bench: `node bench/bench.mjs [project-dir]` (default `examples/shadcn`). Requires built CLI; knobs `BENCH_RUNS`, `BENCH_KEEP_OUTPUT`. Leaves `dist/`/`release/` behind.
- **Broken root scripts — do not use:** `pnpm bench` (points at missing `benchmarks/run.mjs`; use `node bench/bench.mjs`), `pnpm e2e`, `pnpm gen-examples`, `pnpm clean` — all reference files that don't exist. `scripts/gen-skeleton.mjs` exists but is stale/destructive; never run it.
- No lint, no CI, no git hooks. `pnpm test` is the only gate.

## Build / TS conventions

- Every workspace package is plain `tsc` to ESM `dist/` (NodeNext). No bundling of workspace packages; Rspack only compiles end-user projects via the CLI.
- `tsconfig.base.json` maps all `@mbsks/rspfx-*` → `packages/*/src/index.ts` for typechecking. Each package's `tsconfig.build.json` **must keep `paths: {}`** — builds resolve cross-package imports via node_modules workspace symlinks, so a dependency's `dist/` must exist first. Root `pnpm build` handles dependency order via pnpm.
- ESM + `moduleResolution: NodeNext` → relative imports must use explicit `.js` extensions (`import { X } from './errors.js'`), including imports from `src/` abutting `dist/`.
- `@mbsks/rspfx-core` is zero-dependency (no framework, no bundler, no Node APIs) — keep it that way.

## Tests

- Tests are colocated: `packages/*/tests/**/*.test.ts` and `apps/*/tests/**/*.test.ts` (root vitest include). `examples/` and `apps/playground` are never covered.
- Default env is `node`; DOM tests opt in per-file with `// @vitest-environment happy-dom` (all framework `adapter.test.ts`, `webpart.test.ts`, `fluent-adapter`, `sharepoint-runtime`, `manifests-js.test.ts`).
- Root vitest aliases stub real `@microsoft/sp-webpart-base` / `@microsoft/sp-core-library` to `tests/stubs/`. Tests never import real `@microsoft/sp-*` implementations.
- Shared root `tests/fixtures/` is empty — golden fixtures live per-package (e.g. `packages/sppkg-builder/tests/fixtures/proj/`).
- Golden-style checks are assertion-based, not snapshots: AMD bundle header prefix `define('<id>_1.0.0', ["@microsoft/sp-core-library"],` preceded by the currentScript capture line (`(function(){window["__rspfx_script_url_<name>"]=` — see `compiler-rspack/src/public-path.ts` and `compiler-rspack/tests/build.test.ts`), byte-equal zip entries and exact `.sppkg` entry lists (`sppkg-builder/tests/sppkg-builder.test.ts`).
- `packages/dev-runtime/tests/dev-runtime.test.ts` writes its fixture at runtime into cwd `tests/fixtures/proj` — run it from the package dir.
- No captured binary `.sppkg` artifacts exist. Ground truth is `reference/FORMATS.md` + `reference/sp-component-ids.json`, enforced via string assertions; `packages/manifest-generator/src/data/component-ids.ts` holds a compiled copy of the ID table — keep it in sync with `reference/`.

## Structure gotchas

- `examples/*` are git-tracked source (only their build outputs are gitignored) and are CLI-driven smoke apps with `@microsoft/sp-*` @ 1.22, while package dev/peer deps are @ 1.23.2 — version drift is intentional.
- `apps/cli` is the composition root (commander; commands in `apps/cli/src/commands/`); `packages/templates` scaffolds projects via inline string builders in `src/index.ts` (not template files on disk).
- Framework packages: per docs/roadmap.md the adapter APIs aren't final until M5 — don't treat them as stable.
- Env vars: `RSPFX_LOG_LEVEL`, `SPFX_SERVE_TENANT_DOMAIN` (dev serve); deploy reads `RSPFX_ACCESS_TOKEN` + `RSPFX_APP_CATALOG_URL` (implemented) — the `RSPFX_TENANT`/`RSPFX_USERNAME`/`RSPFX_PASSWORD` vars from the original design are **not implemented** (docs don't reference them).
- Core constraint: webpack / Heft / gulp strings must never appear in runtime, build output, or generated `node_modules` — only `@microsoft/sp-*` runtime deps are allowed in generated projects.
