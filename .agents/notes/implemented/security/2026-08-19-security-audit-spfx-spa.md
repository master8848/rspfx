# Agent Note: Security and doc-practice audit for SPFx SPA

Status: implemented

## Context

Three parallel audits (runtime, supply-chain, docs) ran on `HEAD` + `git diff HEAD` covering `packages/dev-runtime/src/serve.ts:134,253`, `packages/compiler-rspack/src/dev-server.ts:46,78`, `packages/manifest-server/src/index.ts:8,121`, `packages/sharepoint-runtime/src/local-bootstrap.ts:78`, `packages/templates/src/index.ts:609,638,692`, `apps/cli/src/commands/deploy.ts:16,53`, `scripts/publish.mjs:186`, `docs/getting-started.md:137`, and `docs/architecture.md:3` plus 15 other files.

## Decision

Flag for follow-up without blocking release: Critical — 825-day self-signed cert cached in `~/.rspfx/certs` and trusted via `sudo security add-trusted-cert -d -r trustRoot` (`packages/manifest-server/src/index.ts:104`, `packages/dev-runtime/src/serve.ts:134`) with SAN including `--hostname` arbitrary value. High — `packages/templates/src/index.ts:638` `event.domElement.innerHTML = \`${event.fieldValue}\`` and `:692` `innerHTML` with `this.properties.description` (stored XSS via property pane), `packages/dev-runtime/src/mock-api.ts:176` `Access-Control-Allow-Origin: *` on `/_api` with `X-HTTP-Method` override `:247` without `X-RequestDigest` check, `packages/compiler-rspack/src/dev-server.ts:46` CORS fallback to `*` when no `Origin`, `packages/sharepoint-runtime/src/local-bootstrap.ts:78` `MSINTERNAL_PROXY` stubs `@msinternal/safe-html`. Medium — `packages/dev-runtime/src/mock-api.ts:119` `local/data.json` unschematized seed, `packages/sppkg-builder/src/sppkg-builder.ts:516` `toZipPath` missing `../` sanitize, `jiti` arbitrary code execution in `apps/cli/src/config.ts:62`, `--skip-checks` bypass in `scripts/publish.mjs:186`. Docs High — `docs/architecture.md:3`, `docs/building-packages.md:92`, `docs/compatibility.md:5`, `docs/roadmap.md:3` broken `../../` links, `docs/getting-started.md:137` cert instructions without dev-only warning. Docs Medium — duplicated env vars in 7 files, version matrix literals in 5 files, architecture triple, narrated history.

## Consequences

Fixed in `a93d79e`: `../../` → `../` (4 files), cert warning with removal steps and `SharePoint mode only` scope (`docs/getting-started.md:129`). Remaining flags require code changes: escape `fieldValue`/`description` before `innerHTML` or switch to `textContent`, restrict mock `/_api` CORS to `localhost` + require `X-RequestDigest`, validate `hostname` SAN allowlist, harden `toZipPath` with `path.relative` check, require `--skip-checks` deny in CI. Doc follow-ups: dedupe env vars to `docs/commands.md:53,150` + `AGENTS.md:47`, version literals to `docs/compatibility.md:32` + `packages/core/src/versions.ts:44`, keep pipeline only in `docs/architecture.md:40`. No hardcoded `RSPFX_ACCESS_TOKEN` or real tenant secrets found; `contoso.sharepoint.com` placeholders are safe.
