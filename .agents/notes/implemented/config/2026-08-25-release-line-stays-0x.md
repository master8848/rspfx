# Agent Note: Release line stays 0.x — 0.1.0 work ships as 0.0.14

Status: implemented

## Context

The post-`v0.0.13` code state (Phases 1–9: `contributions`→`rspack`, branded `RspfxErrorCode`, `defineConfig<const T>`, strict `resolveConfig`, `createRSPFX` instance, pure `readProject`, versioned kernel cache) was staged in all `packages/*/package.json` + `apps/cli/package.json` + root `package.json` as `0.1.0` with a matching `CHANGELOG.md ## [0.1.0] - 2026-08-24` section, but was never published — npm `dist-tags.latest` remained `0.0.13` and no `v0.1.0` git tag existed. The maintainer decided the project never ships a `1.x` and prefers the `0.0.x` line indefinitely.

## Decision

Publish the identical code state as `0.0.14`: all publishable package versions set to `0.0.14`, `CHANGELOG.md` section renamed to `## [0.0.14] - 2026-08-25` with an opt-in upgrade note (`^0.0.13` resolves only `>=0.0.13 <0.0.14`, so nothing auto-updates into the breaking changes), benchmark artifacts renamed via `git mv` to `reference/baseline-0.0.14.json` and `reference/sizes-0.0.14.json` with embedded `"version"` fields updated, and current-version facts synced in `docs/internal-api.md` and `docs/performance.md`. Historical plan documents under `docs/plan-0.1.0/` keep their original `0.1.0` wording as frozen plans.

## Consequences

`scripts/publish.mjs --version 0.0.14 --tag latest` publishes 20 packages at `0.0.14` and creates annotated tag `v0.0.14`; future releases continue patch-bumping inside `0.0.x` (`bumpVersion` default `patch`), so `--minor`/`--major` must not be used. Breaking changes ride `0.0.x` patches by policy; consumers must pin exact versions or opt in deliberately.
