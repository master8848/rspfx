# Agent Note: Hybrid dev mode for official SPFx projects

Status: implemented

## Context

Adoption barrier: enterprises keep production `.sppkg` output on the official gulp/Heft toolchain, so replacing the whole pipeline is a hard sell. The precedent is `spfx-fast-serve`, which was adopted widely because it only replaced dev serving. Rspfx already read official config shapes everywhere in the dev path (`readProject()` handles `config/config.json` bundles, `config/serve.json`, `lib/`→`src/` localized resources, `findSpDependencies()` harvests sp-* ids from node_modules), so only config synthesis and command gating were missing.

## Decision

`apps/cli/src/hybrid.ts`: `detectOfficialProject()` = `config/config.json` + a toolchain marker (`gulpfile.js`/`heft.json`/`.yo-rc.json`) and no rspfx bundler config. `loadOfficialConfig()` synthesizes an `RspfxConfig` from package.json (`name`, `version`, `spfxVersion` parsed from the `@microsoft/sp-core-library` dependency against `SPFX_VERSIONS`, framework from dependency scan). `runDev` falls back to it on `CONFIG_NOT_FOUND`; `build/package/deploy/analyze` route through `loadConfigOrRefuseOfficial()`, which throws `OFFICIAL_TOOLCHAIN_BUILD` on official projects so production stays on the official pipeline. Fact home: [docs/hybrid-dev.md](../../../docs/hybrid-dev.md).

While testing local preview end-to-end, the browser bundle graph was found to reach Node-only core modules: `sharepoint-runtime/src/platform-modules.ts` imported the `@mbsks/rspfx-core` index, dragging `png.ts` (`node:zlib`) and `package-resolve.ts` (`node:fs`) into every local-preview build (fatal `node:`-scheme rspack errors — present on main, masked by chunk emission). Fixed by adding a `./platform` subpath export to `packages/core/package.json` and deep-importing it; verified by absence of `node:` errors and a clean baseline comparison via `git stash`.

## Consequences

Official-toolchain developers can trial rspfx with zero project changes and zero production risk; full migration stays optional ([docs/migrating-from-gulp-heft.md](../../../docs/migrating-from-gulp-heft.md)). The refusal contract makes the dev-only promise explicit instead of accidental. Local preview on synthetic fixtures without complete sp-* installs still fails on real package graphs (`extension-contexts.ts` lazily imports five real sp-* packages by design); tests therefore cover hybrid serving in workbench mode (`apps/cli/tests/hybrid.test.ts`).
