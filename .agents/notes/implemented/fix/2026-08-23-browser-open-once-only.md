# Agent Note: Browser open once-only on dev start

Status: implemented

## Context

`rspfx dev --browser` and `dev.openBrowser: true` in `packages/core/src/config.ts:12` opened the workbench via `packages/dev-runtime/src/browser.ts:3` but the Vite and Rsbuild paths in `packages/plugin/src/vite.ts:501` and `packages/plugin/src/rsbuild.ts:172` only checked `resolved.dev.openBrowser` and ignored the CLI flag `apps/cli/src/cli.ts:91`, while repeated openings on hot reload would create a new tab per rebuild and reset the `sessionStorage` `spfx-debug` allowance that SharePoint uses for Load debug scripts.

## Decision

Add once-only guarantee in `packages/dev-runtime/src/serve.ts:291` with a `browserOpened` guard and explicit no-reopen on `drainRestarts`, use `httpServer.once('listening')` with a `browserOpened` guard in `packages/plugin/src/vite.ts:498`, use `api.onAfterStartDevServer` only with a `browserOpened` guard in `packages/plugin/src/rsbuild.ts:163`, and propagate `rspfx dev --browser` via `RSPFX_OPEN_BROWSER=1|0` env from `apps/cli/src/bundler-bin.ts:63` through `apps/cli/src/commands/dev.ts:77` and `apps/cli/src/vite.ts:10`/`apps/cli/src/rsbuild.ts:10` to the plugins which respect the env before falling back to `config.dev.openBrowser`.

## Consequences

`rspfx dev --browser` works consistently across Rspack, Vite, and Rsbuild; the browser opens once on initial start and rebuilds reload the same tab via `packages/dev-runtime/src/reload.ts:57`, so `sessionStorage` `spfx-debug` persists and the Load debug scripts dialog does not reappear for that reason.
