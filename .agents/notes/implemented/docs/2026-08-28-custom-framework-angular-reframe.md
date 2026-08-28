# Agent Note: Reframe Angular as custom FrameworkPreset example

Status: implemented

## Context

Docs framed Angular as a hard blocker (`ARCHITECTURE.md:7`, `docs/roadmap.md:17`, `docs/why-not-to-migrate.md:16`, `docs/roadblocks.md:36`, `docs/migration-from-spfx.md:102`, `docs/migrating-from-gulp-heft.md:11`) while the extensibility contract already existed in `docs/custom-framework.md` via `FrameworkPreset` (`packages/plugin-api/src/types.ts:29`) + `BaseWebPart` (`packages/core/src/base-web-part.ts:10`) registered with `definePlugin`/`registerPlugin` (`packages/plugin-api/src/registry.ts:5`); the request was to generalize Angular to any custom framework and to make the one-file preset flow feel easy.

## Decision

Update `README.md:103` supported-targets table to `Any custom framework (Angular, Lit, etc.)` with `one-file FrameworkPreset + registerPlugin` (`packages/plugin-api/src/registry.ts:5`) and rewrite `README.md:108`/`113` tip to describe built-ins plus one-file `FrameworkPreset` registration; change `ARCHITECTURE.md:7` and `ARCHITECTURE.md:193` M6 to `Custom framework extensibility | Done` linking `docs/custom-framework.md`; change `docs/roadmap.md:17` M6 to `Done — any framework via FrameworkPreset + BaseWebPart` with `definePlugin`/`registerPlugin`; reframe `docs/why-not-to-migrate.md:16`/`51`/`66` from `Angular web parts | ❌` to `Custom framework without a preset (e.g. Angular bare) | ⚠️ Bring a FrameworkPreset`; update `docs/migration-from-spfx.md:5`/`102` and `docs/migrating-from-gulp-heft.md:5`/`11` to `custom frameworks need a FrameworkPreset`; change `docs/roadblocks.md:36`/`65` to low-severity `FrameworkPreset` guidance; expand `docs/why-rspfx.md:54` framework table with `Any other (Angular, Lit, etc.)` row and one-file contract paragraph; adjust `skills/rspfx/SKILL.md:12`/`30`/`34` and `apps/cli/README.md:39` to list `via FrameworkPreset` instead of `Angular deferred`.

## Consequences

Angular remains the canonical example but no longer reads as blocked: built-ins are vanilla/React/Solid/Preact/Vue/Svelte (`@mbsks/rspfx-framework-*`), any other framework (Angular, Lit, etc.) works with a one-file `FrameworkPreset` + `BaseWebPart` and `registerPlugin(definePlugin({ frameworkPreset }))` in `vite.config.ts`/`rsbuild.config.ts`/`rspack.config.ts` with `framework: 'my-framework' as const` and no CLI fork (`docs/custom-framework.md` is the fact home); Heft guidance clarifies manual AOT (`ngc`/`ng-packagr`) is required without a preset layer; `README.md`, `docs/roadmap.md`, `docs/why-not-to-migrate.md`, `docs/roadblocks.md`, and `skills/rspfx/SKILL.md` now consistently route to the preset contract.
