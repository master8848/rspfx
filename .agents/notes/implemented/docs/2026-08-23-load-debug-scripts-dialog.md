# Agent Note: Document Load debug scripts dialog session behavior

Status: implemented

## Context

SharePoint workbench showed Load debug scripts on every reload for some users while `packages/dev-runtime/src/reload.ts:57` uses `window.location.reload()` in the same tab and `packages/dev-runtime/src/serve.ts:121` builds a stable `debugManifestsFile=https://localhost:4321/temp/manifests.js` (no `?t=`), so the allowance in `sessionStorage` key `spfx-debug` should persist; re-prompts were caused by new tabs, untrusted cert at `~/.rspfx/certs`, or Chrome 142+ Local Network Access blocking `https://localhost:4321`.

## Decision

Add canonical reference at `docs/getting-started.md#load-debug-scripts-dialog` describing the `sessionStorage` `spfx-debug` per-session allowance, `window.location.reload()` same-tab persistence in `packages/dev-runtime/src/reload.ts:57`, `?reset=true` clearing, stable `debugManifestsFile` URL (`packages/dev-runtime/src/serve.ts:121`) with `?t=` only on bundle URLs (`packages/dev-runtime/src/serve.ts:197`, `packages/plugin/src/vite.ts:438`, `packages/plugin/src/rsbuild.ts:110`), cert trust in `~/.rspfx/certs` plus Chrome 142+ Local Network Access Allow, and `dev.openBrowser` (`packages/core/src/config.ts:12`) opening once via `packages/dev-runtime/src/browser.ts:3`; link from `docs/commands.md#rspfx-dev` without duplicating the fact (see `docs/AGENTS.md` one-home rule).

## Consequences

Users understand the dialog appears once per tab and survives rebuild reloads; they trust the cert, allow Local Network Access, keep the same tab, and use `?reset=true` to reset, while `rspfx dev --browser`/`dev.openBrowser` opens once and rebuilds stay in place, eliminating repeated prompts when the cert and LNA are allowed.

