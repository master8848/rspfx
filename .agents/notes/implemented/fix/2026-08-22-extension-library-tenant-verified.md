# Agent Note: Extension and Library tenant verification

Status: implemented

## Context

Extension (`src/extensions/`) and library (`src/libraries/`) compile/discovery and local preview were implemented, but tenant install was `verified-by-reference` only, and dev manifests regenerated with `webpartsDir` only — custom `paths.extensionsDir`/`librariesDir` diverged between `rspfx build` (`packages/dev-runtime/src/release.ts:68`) and dev (`packages/dev-runtime/src/manifests.ts:47`, `packages/dev-runtime/src/serve.ts:184`, `packages/plugin/src/vite.ts:384`, `packages/plugin/src/rsbuild.ts:99`). `packages/dev-runtime/src/project.ts:791` `pickEntrypoint` missed PascalCase for hyphenated folders (`my-lib/MyLibLibrary.ts`), and `apps/cli/src/prompts.ts:9` omitted `formcustomizer`.

## Decision

Add `librariesDir` to `ManifestRegeneratorOptions` (`packages/dev-runtime/src/manifests.ts:9`) and propagate `extensionsDir`/`librariesDir` through all `createManifestRegenerator` call sites; extend `pickEntrypoint` with PascalCase candidates (`packages/dev-runtime/src/project.ts:791`) and add `formcustomizer` to `COMPONENT_CHOICES` (`apps/cli/src/prompts.ts:9`). Promote docs from `verified-by-reference` to `Verified` in `docs/compatibility.md:24`, `docs/roadblocks.md:7,48,63`, `docs/why-not-to-migrate.md:10,15,65`, `docs/roadmap.md:11,22`, `docs/real-tenant-validation.md:1`, `docs/multi-webpart.md:34`, and add `librariesDir`/`extensionsDir` and operator env vars to `docs/commands.md:292` (`RSPFX_LOG_LEVEL`, `SPFX_SERVE_TENANT_DOMAIN`, `RSPFX_APP_CATALOG_URL`, `RSPFX_ACCESS_TOKEN`, `RSPFX_NPM_OTP`).

## Consequences

`rspfx dev` manifests now honor custom `paths` for extensions/libraries, matching `rspfx build`/`package`; hyphenated library folders resolve via PascalCase; `rspfx new --component formcustomizer|library --yes` works. Tenant gate passed 2026-08-22 validates `.sppkg` layout (`WebPart`/`Extension`/`Library` XML via `packages/sppkg-builder/src/xml.ts:181`) and AMD wrappers across Rspack/Vite/Rsbuild.
