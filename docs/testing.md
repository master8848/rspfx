# Testing

Reference for test conventions, Vitest config, and shared utilities. Fact home for `vitest.shared.ts:1`, `tests/test-utils/fs.ts:1`, `vitest.config.ts:1`, and package `vitest.config.ts` overrides.

## Running

Run `bun run test` from repo root (`vitest run` via `vitest.config.ts:17`). Use `bun run test -- <path>` to filter, e.g. `bun run test -- packages/core/tests/config.test.ts`.

Run watch mode with `bun run test:watch` (`vitest`).

Run heavy example builds with `bun run test:examples` (`RSPFX_TEST_EXAMPLES=1 vitest run tests/examples-build.test.ts:21`). Example tests set per-test `timeout: 180000`; global `testTimeout` stays `60000`.

Per-package run: `bun run --filter @mbsks/rspfx-plugin vitest run` or `vitest run --config packages/core/vitest.config.ts`.

## Configuration

Root config is `vitest.config.ts:1` with `resolve.alias` for `@microsoft/sp-webpart-base` (`tests/stubs/sp-webpart-base.ts:1`) and `@microsoft/sp-core-library` (`tests/stubs/sp-core-library.ts:1`), `include` covering `packages/*/tests/**/*.test.ts`, `apps/*/tests/**/*.test.ts`, `tests/**/*.test.ts`, `environment: 'node'`, `testTimeout: 60000`, `hookTimeout: 60000`, `pool.forks.singleFork: true`.

Shared defaults are `vitest.shared.ts:1` (`sharedAlias`, `sharedTestDefaults` with `include: ['tests/**/*.test.ts']`, `environment: 'node'`, `testTimeout: 60000`, `hookTimeout: 60000`). Packages import via `from '../../vitest.shared.js'` and spread `...sharedTestDefaults`, overriding only what differs.

Per-package overrides: `packages/compiler-rspack/vitest.config.ts:1` sets `testTimeout: 120000`, `hookTimeout: 120000`, `fileParallelism: false` (Rspack builds heavy, disable file parallelism). `packages/webpart-base/vitest.config.ts:1` sets `environment: 'happy-dom'` and `setupFiles: ['tests/setup.ts']`. `packages/core/vitest.config.ts:1` sets `setupFiles: ['tests/setup.ts']`. `packages/sppkg-builder/vitest.config.ts:1` appends alias for `@mbsks/rspfx-diagnostics` (`packages/diagnostics/src/index.ts:1`) to `sharedAlias`. All other packages (`build-core`, `diagnostics`, `manifest-generator`, `manifest-server`, `plugin-api`, `plugin-dev`) use `sharedAlias` + `sharedTestDefaults` unchanged.

Do not add `singleFork` to package configs; root `pool.forks.singleFork` already serializes when running from root. Packages keep parallelism disabled only where required (`compiler-rspack`).

## Conventions

No snapshots: use byte equality (`Buffer.equals`, `expect(buf).toEqual(expected)`, `expect(zip.get(name)).toEqual(content)`) as in `packages/sppkg-builder/tests/sppkg-builder.test.ts:146`.

Use `tmpdir` over shared `dist`: create isolated temp dirs via `tests/test-utils/fs.ts:5` `makeTmp(prefix)` (`mkdtemp(path.join(tmpdir(), prefix))`) and clean with `rmRf(target)` (`rm(target, { recursive: true, force: true })`), not `dist/` or `release/` in repo or fixture. See `packages/sppkg-builder/tests/sppkg-builder.test.ts:21` `makeProject` and `apps/cli/tests/helpers.ts:17` `makeTmpDir`.

Use `port: 0` for servers: `listen(0)` then read `address().port`; no fixed port, no `4321` in tests.

No `.only`, `.skip`, `.todo` in committed tests: CI runs `vitest run` with `exclude: []` and will fail on focused tests.

Environment: `node` by default; `happy-dom` only for `packages/webpart-base`.

No shared mutable state between tests; each test creates its own `makeTmp` directory and `rmRf` in `finally`.

Use `tests/test-utils/fs.ts:26` `waitFor(predicate, timeoutMs, message)` or `waitFor(predicate, { timeoutMs, intervalMs, message })` (default `intervalMs: 100`, polls via `setInterval`) for async rebuild polling, extracted from `packages/compiler-rspack/tests/watch.test.ts:36`. Prefer this over manual `setTimeout` loops or `await new Promise(r => setTimeout(r, ...))`.

## Coverage

Coverage uses `coverage.provider: 'v8'` in `vitest.config.ts:1` with `include: ['packages/*/src/**/*.ts']`, `exclude: ['**/fixtures/**','**/dist/**']`. No thresholds yet. Run `vitest run --coverage` to produce v8 report. Requires `@vitest/coverage-v8` (`^2.1.0`) installed; if missing, `vitest run --coverage` errors but normal `bun run test` is unaffected.

## Utilities

`tests/test-utils/fs.ts:1` exports `makeTmp(prefix)`, `makeTmpSync(prefix)`, `rmRf(target)`, `rmRfSync(target)`, `waitFor(predicate, timeoutOrOptions, message)`. Import via `from '../../tests/test-utils/fs.js'` (repo root) or `from '../../../tests/test-utils/fs.js'` (from `packages/*/tests`) or relative to caller.

Example:

```ts
import { makeTmp, rmRf, waitFor } from '../../../tests/test-utils/fs.js';
const dir = await makeTmp('rspfx-mytest-');
try {
  // ...
  await waitFor(() => doneCount >= 1, 60000, 'initial build did not finish');
} finally {
  await rmRf(dir);
}
```

## Related

Test stubs are `tests/stubs/sp-webpart-base.ts:1` and `tests/stubs/sp-core-library.ts:1` aliased via `vitest.shared.ts:3`. Examples build test is `tests/examples-build.test.ts:1` (gated by `RSPFX_TEST_EXAMPLES`). Docs-web check is `tests/docs-web-pm.test.ts:1`.
