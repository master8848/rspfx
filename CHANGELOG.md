# Changelog

All notable changes to this project are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each version corresponds to an annotated git tag `vX.Y.Z` and an npm dist-tag (see [Publishing and tagging](#publishing-and-tagging) below). The single source of truth for history is this file — do not duplicate version history in `docs/` reference pages (see `docs/AGENTS.md`).

Archive policy: this file keeps the full human-readable history from `0.0.1` through the current `Unreleased` until `1.0.0`; on `1.0.0` the pre-`1.0` history will be frozen to `CHANGELOG_ARCHIVE.md` and git history remains the canonical archive — all entries below stay one line, human-readable, with exact package/file/flag references.

## [Unreleased]

> Next publish will promote `Unreleased` into `## [X.Y.Z] - YYYY-MM-DD` and create annotated tag `vX.Y.Z`; push with `git push --follow-tags`.

## [0.0.15] - 2026-08-28

Covers `89556b8..202d0f0` (28 commits since `v0.0.14`).

### Added

- Dev cert diagnostics — `getCertStatus()`, `isCertTrusted()`, `formatTrustInstructions()`, `getCertsDir()` in `packages/manifest-server/src/index.ts:8` with `X509Certificate` expiry/SAN checks and best-effort OS trust check (`security verify-cert` on macOS, `certutil -verify` on Windows) (`.agents/notes/implemented/fix/2026-08-26-cert-trust-diagnostics.md`).
- `rspfx doctor` cert checks — `cert exists` (`~/.rspfx/certs/cert.pem`), `cert valid` (>7d), `key.pem 0600`, `cert trusted` (OS store) in `apps/cli/src/commands/doctor.ts:252` with per-OS trust command in detail and CORS/NOT_TRUSTED guidance.
- `rspfx dev` cert warnings — `packages/dev-runtime/src/serve.ts:134` and `apps/cli/src/commands/dev.ts:71` warn at startup when cert is missing, expiring, or not trusted (CORS / `NET::ERR_CERT_AUTHORITY_INVALID` / blank workbench), linking to `~/.rspfx/certs/cert.pem.trust.txt` and `rspfx doctor`.
- Vite as default bundler — `apps/cli/src/config.ts` prefers `vite.config.ts` over `rspack`/`rsbuild`, zero-config synthesis emits `vite.config.ts` with `rspfxVite()` and auto-detected `spfxVersion` from `@microsoft/sp-core-library`, `rspfx migrate` auto-detects SPFx target with explicit/detected/fallback logging (`59595e9`, `apps/cli/src/commands/migrate.ts`, `scripts/migrate-to-rspfx.mjs`).
- `examples/mixed` — single project with `HelloWebPart` + `BannerApplicationCustomizer` + `UtilsLibrary` on `Vite + rspfxVite` (`1d65470`, `examples/mixed/`).
- `docs/upgrading-spfx-version.md` — one-line `spfxVersion` switch, per-version handling, Node matrix, migrate-then-upgrade flow (`b36a50d`).
- `docs-web` VitePress site — human-first docs with shadcn themes, `Copy as markdown` split button (Copy as Markdown, View as Markdown, Open in ChatGPT/Claude), `/llms` viewer (`docs-web/llm.md`, `docs-web/llms.md`), raw markdown publish to `dist/*.md` + `dist/markdown/*` + `dist/md/*`, extensionless `/md/*` via `docs-web/worker.ts` + `_redirects`/`_headers` + `ASSETS` binding (`e1b3289`, `2840a1a`, `b9c83ba`, `a760cd0`, `2ffbf7b`, `649eb84`, `10f2f95`, `3765b70`, `fe89ee8`, `21cc541`).
- Build-time package manager switcher — `docs-web/theme/utils/pmTransform.ts` replaces GH-compatible fences with `PackageManagerTabs` pill switcher (`pnpm`/`npm`/`yarn`/`bun`/`deno`) with `rspfx-pm` localStorage persistence and `v-pre` hydration (`69854f4`, `tests/docs-web-pm.test.ts`).
- Bun/Deno package manager docs — Heft breakage note and `Bun`/`Deno` tabs in `README.md` and `docs/getting-started.md` (`4c92645`).
- `rspfx new` Bun support, `git init`, manual install — prompts `pnpm|npm|yarn|bun|deno`, runs `git init`, skips auto-install, prints `cd <project> && <pm> install && <pm> run dev`, keeps `--no-install` compat, `doctor` cert hint now shows cert path and restart (`410359b`, `apps/cli/src/commands/new.ts`, `apps/cli/src/commands/doctor.ts`).
- `sppkg` blackbox harness — `packages/sppkg-builder/tests/blackbox.test.ts` diffs `ZIP` vs official Heft (`OFFICIAL_SPPKG_TEST=1`), `bench/blackbox-compare.mjs` helper (`da876d6`).

### Changed

- `cert.pem.trust.txt` now notes CORS/`NET::ERR_CERT_AUTHORITY_INVALID` symptom and `rspfx doctor` (`packages/manifest-server/src/index.ts:14`).
- Docs `getting-started.md#cert-trust`, `commands.md#rspfx-dev` and `commands.md#rspfx-doctor`, `architecture.md#dev-mode`, and `internal-api.md#rspfx-manifest-server` document cert trust per-OS commands, `rspfx doctor` checks, and `rspfx dev` warnings (see `docs/AGENTS.md` fact homes).
- Bundler wording — `README.md`, `docs/why-rspfx.md`, `docs/compatibility.md`, `docs/building-packages.md`, `apps/cli/README.md` now state `Vite, Rsbuild, Rspack` (Vite default) (`d93b37f`, `fd50403`, `cd198a5`).
- Framework table — `README.md` capability matrix marks built-ins, adds `custom FrameworkPreset` via `@mbsks/rspfx-plugin-api`, `spfxVersion` one-line switch, optional `@mbsks/rspfx-fluent-adapter` (`db28e99`).
- Docs refresh — concise human-first theme, VS-official comparisons, removed impl leaks, searchable `Angular`→custom-framework alias, accent picker, sidebar cleanup (`2840a1a`, `b9c83ba`).

### Fixed

- First-run SharePoint workbench CORS confusion — `rspfx dev` no longer silently serves untrusted `https://localhost:4321`; `rspfx doctor` now surfaces missing/expiring/untrusted cert with actionable `sudo security add-trusted-cert` / `certutil -addstore` command instead of user debugging CORS.
- `rspfx dev` source maps now ship in dev (was missing/broken) — Vite `transformEntryBundle` in `packages/plugin/src/vite.ts:199` strips/restores `sourceMappingURL` and offsets mappings `';'` for the capture line plus `build.sourcemap:'hidden'` parity, Rspack `SpfxPublicPathPlugin` in `packages/compiler-rspack/src/public-path.ts:97` preserves `SourceMapSource` via `ConcatSource`/`ReplaceSource`, Rsbuild `modifyRspackConfig` in `packages/plugin/src/rsbuild.ts:414` sets `devtool:'source-map'` dev / `'hidden-source-map'` prod (`74427c7`) — breakpoints/file-origin debugging now works (was unusable vs `spfx-fast-serve`).
- `compiler-rspack` filesystem cache disabled under `VITEST` — `packages/compiler-rspack/src/kernel.ts` guards `experiments.cache` with `!process.env.VITEST` to avoid `rspack_storage` panic `scope not loaded` (`6441784`).
- `sppkg` parity for `1.20`–`1.24` — `[Content_Types].xml` `txt` now conditional on feature usage, `DeveloperProperties` omits `undefined` (not empty string), `IsDomainIsolated` deprecated for `1.24+`, `crates/rspfx-sppkg/src/xml.rs` Rust map fix; `docs/compatibility.md`, `docs/roadblocks.md`, `docs/roadmap.md`, `docs/supporting-a-new-spfx-version.md` clarify verified gate vs CI matrix and mandate blackbox parity (`da876d6`).

> Git tag: `v0.0.15` · npm dist-tag: `latest` · Packages: `packages/*` + `apps/cli` at `0.0.15` (single version, `scripts/publish.mjs`). Compare `v0.0.14...v0.0.15`.

## [0.0.14] - 2026-08-25

Breaking release `0.0.13 → 0.0.14` — the project stays on the `0.0.x` line by design (no `1.0.0` planned). Because `^0.0.13` resolves only `>=0.0.13 <0.0.14`, consumers must opt in explicitly (`pnpm add @mbsks/rspfx-cli@0.0.14`). Run `npx rspfx migrate --to 0.1 --dry-run` then `npx rspfx migrate --to 0.1` and `npx rspfx doctor --fix` to codemod.

### Breaking Changes
- `FrameworkPreset` field `contributions` renamed to `rspack` — `FrameworkPreset<T extends FrameworkId> { rspack(opts)=>FrameworkRspackContributions }` in `packages/plugin-api/src/index.ts` — codemod via `rspfx migrate --to 0.1`.
- `RspfxErrorCode` is now branded string union — `RspfxError.code` is `RspfxErrorCode` not `string` in `packages/diagnostics/src/codes.ts`.
- `defineConfig` preserves literal `framework` — `defineConfig<const T extends RspfxConfig>(config: T): T` in `packages/core/src/config.ts` — add `as const` or `satisfies FrameworkPreset<'react'>`.
- `resolveConfig` rejects unknown keys — `strictObject` dust throws `RspfxError(CONFIG_VALIDATION_FAILED)` with `Issue.path` in `packages/core/src/config.ts:32` — handle via `tryResolveConfig`.
- `createRSPFX` instance replaces globals — `registerPlugin`/`getPlugins` removed, use `rspfx = createRSPFX()` and `rspfx.hooks` in `apps/cli/src/config.ts` and `packages/plugin-api/src/instance.ts`.
- `readProject` is pure — no longer auto-writes `config/serve.json` etc; run `rspfx doctor --fix` via `ensureProjectConfigs` in `packages/dev-runtime/src/project.ts`.
- Kernel cache versioned — `cacheVersionHash` busts `filesystem` cache on config change in `packages/compiler-rspack/src/kernel.ts`.
- Config schema `strictObject` — unknown keys rejected at `parseRSPFXConfig` in `packages/core/src/config.ts` (Phase 8).

### Added
- Per-version changelog rule and tag linkage — `CHANGELOG.md` now requires one `## [X.Y.Z]` per release linked to `vX.Y.Z` and npm dist-tag `latest`/`next`.
- Typed `HookBus` and `RspfxExtension` hooks — `beforeCompile`, `afterStats`, `beforeGenerate`, `afterGenerate`, `beforeStart`, `afterStart`, `beforePackage`, `afterPackage` with `HookResult<T>` in `packages/plugin-api/src/hooks.ts`.
- Structured diagnostics — `LogLevel`, `Logger.child/isLevelEnabled/trace`, `RspfxError`, `AggregateRspfxError`, `formatError`, `formatBytes` in `packages/diagnostics/src`.
- Headless adapter split — `HeadlessWebPart` in `@mbsks/rspfx-webpart-base`, `createXAdapter` per framework in `@mbsks/rspfx-framework-*/headless` with `HeadlessAdapter`/`PropsSelector` in `packages/core/src/headless.ts`.
- Dev store and state machine — `createStore` in `packages/dev-runtime/src/store.ts`, explicit dev machine in `packages/dev-runtime/src/machine.ts`, path/route/devtools extraction.
- Bundler kernel with `filesystem` cache, `lazyCompilation`, asset filenames, CSS dedup in `packages/compiler-rspack/src/kernel.ts`.
- Vite `AsyncLocalStorage` parallel builds and `optimizeDeps` cache isolation in `packages/plugin/src/vite.ts`.
- Rsbuild dev parity — `modifyRspackConfig` entries/externals/output/chunkLoadingGlobal/publicPath plugins, `RsbuildRspfxPlugin` in `packages/plugin/src/rsbuild.ts`.
- Rust crates with JS fallback — `crates/rspfx-sppkg`, `crates/rspfx-manifest`, `crates/rspfx-rspack-plugin` with `try { require('.../index.node') } catch {}` fallback.
- `rspfx migrate --to 0.1` codemod — `--dry-run`, `--revert`, `--bundler vite|rspack|rsbuild`, `.rspfx/migrate-backup.json` backup in `apps/cli/src/commands/migrate.ts`.
- `rspfx doctor --fix` — recreates missing configs via `ensureProjectConfigs` and reports `Issue.path` in `apps/cli/src/commands/doctor.ts`.
- `defineConfig` `as const` wrapper in `packages/templates/src/index.ts` and `svelte.config.js` generation.

### Fixed
- `rspfx build` now delegates to `rspack build` so `rspack.config.ts` `module.rules` are honored (`1689392`).
- CSS `importLoaders` for `.css` `@import` — `1` when PostCSS present, `0` when not (`packages/compiler-rspack/src/config.ts:212`).
- `postcss.config.json` detection — checked alongside `js`/`cjs`/`mjs`/`ts`/`cts`/`mts` (`packages/compiler-rspack/src/config.ts:37`).
- Styling docs `camelCaseOnly` → `asIs` to match `packages/plugin/src/vite.ts:330` and `packages/compiler-rspack/src/helpers/css.ts:58`.
- Bundler choice docs — Rspack manual `module.rules`, Vite default, ranking Vite > Rsbuild > Rspack per `skills/rspfx/SKILL.md`.
- Tailwind `content` note — `content` not `purge` for v3 (`docs/styling.md:87`).
- Rspack resolve `rspack.ts:143` — plugin-injected resolve forwarding via kernel `resolveContributionLoaders`.
- Rsbuild certs and DefinePlugin order — `rsbuild.ts:292` cert handling and `rsbuild.ts:486` `DefinePlugin` ordering.
- `platformOnlyExternal` handling — externalization via `packages/core/src/platform.ts` in rspack/vite/rsbuild.
- Rsbuild `modifyRsbuildConfig` arity and CLI `--to`/`--revert` handling (`632d336`, `85e6e24`).

> Git tag: `v0.0.14` · npm dist-tag: `latest` · Packages: `packages/*` + `apps/cli` at `0.0.14` (single version, `scripts/publish.mjs`). Compare `v0.0.13...v0.0.14`.

## [0.0.13] - 2026-08-23

Human-readable summary of `4bd4ceb..5410ef7` plus the 9 post-bump commits that ship as `0.0.13` (package version `0.0.13` at `5410ef7`; commits `0b4725a..20c23eb` are included here and `Unreleased` is reset after).

### Added
- Custom framework registry — register any framework via `packages/core` + `packages/plugin-api` + `packages/dev-runtime` without forking core (`0b4725a`, `.agents/notes/implemented/feature/2026-08-23-custom-framework-extensibility.md`).
- `rspfx migrate` command (`apps/cli`) with `--dry-run`, `--revert`, and `--bundler vite|rspack|rsbuild` to convert Heft/Gulp projects to RSPFX (`6d2a6f7`).
- Vite as default bundler — new projects scaffold `vite.config.ts` via `packages/plugin` vite preset; rspack/rsbuild remain selectable (`b05775b`).
- Robust styling defaults — SCSS, CSS Modules, PostCSS, and Tailwind wired in `packages/plugin` with zero-config and future-proof helpers (`b05775b`).

### Changed
- Docs: RSPFX-only framework matrix — supported frameworks are first-class in `README.md` and `skills/`; non-RSPFX wrappers removed (`d6035e6`).
- Docs: PnPjs guidance for SharePoint lists replaces generic fetch examples (`d6035e6`).
- Docs: Dual-toolchain interchange explained — same `config.json` + `serve.json` works in Heft/Gulp and RSPFX (`d6035e6`).
- Docs: Human-friendly zero-config and same-manifest guide — `README.md` emphasizes no config needed, manifest parity (`b3836bc`).

### Fixed
- Share same manifest between Heft/Gulp and RSPFX — `packages/dev-runtime` + `apps/cli` read one `config.json` source (`1b7fb98`).
- Vite CSS Modules `localsConvention` set to `asIs` to match rspack output (was `camelCaseOnly`) — `packages/plugin/src/vite.ts:127` (`127986a`).
- Agent Note and reference compliance for custom-framework docs (`b6de572`).

> Git tag: `v0.0.13` · npm dist-tag: `latest` · Packages: `packages/*` + `apps/cli` at `0.0.13` (single version, `scripts/publish.mjs`).

## [0.0.12] - 2026-08-23

Covers `3fb8c26..4bd4ceb` — 22 changes between the `0.0.11` and `0.0.12` bumps; `4bd4ceb` is the bump commit.

### Added
- Hybrid dev mode (`apps/cli` `rspfx dev`) — auto-detects Heft/Gulp vs RSPFX projects and runs the correct pipeline (`adc7f41`, `.agents/notes/implemented/feature/2026-08-23-hybrid-dev-mode.md`).
- FormCustomizer and Library scaffolding + packaging coverage (`0784b37`).
- Extension close-out and Library component support — `packages/templates` + `packages/sppkg-builder` + `packages/manifest-generator` (`ff7d573`, `6bdf864`).

### Changed
- Language flag is scaffold-only — generators emit starter code, runtime no longer branches on `language` (`d04fdcd`).
- Fluent flag is scaffold-only — `fluent-adapter` stays standalone, no core flag (`5972866`).
- Deduped shared helpers and single-source drift risks across `packages/*` (`75337d5`).
- Docs: mono-version note — all publishable packages share one version (`8a65704`).

### Fixed
- `resolveConfig` now accepts `RspfxConfig` union (`packages/core/src/versions.ts:0b110c6`).
- Browser opens once on `rspfx dev` start and Load Debug Scripts dialog is documented (`35737d2`, `.agents/notes/implemented/fix/2026-08-23-browser-open-once-only.md`).
- Browser-safe `./platform` subpath for platform-only externals (`packages/core/src/platform`, `7a46654`).
- Dev-server static middleware matches mounted prefix via `originalUrl` (`packages/dev-server`, `d39fd18`).
- Core stub import adds `.js` extension for `typecheck` (`ba2aafc`).
- Architecture splits and perf polish — smaller bundles, faster dev-server (`3ba587f`).
- Test debt — stub canonicalization and fidelity (`9a639c8`).
- `fluent-adapter` peer and `context-default` strict null fixes (`4724d49`).
- Docs conflicts and low hygiene cleanup (`20c9152`).
- Error codes normalized, CLI prints code, Biome wired (`1b3ea`, `biome.json`).
- Fabricated README Usage sections rewritten (`7853d99`).
- Vite parity: space-free `tmpdir` for builds, default context test fix (`b0ab4df`).
- `sppkg` `Library_` validation and traversal hardening (`5f3d8a3`, `.agents/notes/implemented/fix/2026-08-22-extension-library-tenant-verified.md`).
- Broken scripts fixed, `.gitignore` cleans `lib`, draft banner removed, playground purged (`ed98963`).
- Stray root config and rspack cache ignored (`3480800`).
- Custom `extensions`/`libraries` paths honored in dev; `FormCustomizer` added (`6bdf864`).

> Git tag: `v0.0.12` · npm dist-tag: `latest`.

## [0.0.11] - 2026-08-22

Covers `850f473..3fb8c26` — packaging and manifest hardening that lands as `0.0.11`.

### Fixed
- `sppkg` builder locked to official Heft parity with regression test (`850f473`, `.agents/notes/implemented/fix/2026-08-22-sppkg-official-heft-parity.md`).
- `sppkg` output aligned with official Heft `solution.sppkg` layout (`b701eeb`).
- OPC relationships reverted to SharePoint-valid layout (`f6b48fb`).
- `CultureName` `LocalizedString` emitted and OPC rels validation fixed (`8ac504f`, `.agents/notes/implemented/fix/2026-08-21-sppkg-localizedstring-culturename.md`).
- Empty `DeveloperProperties` omitted to pass `AppManifest` validation (`0e5794c`).
- `ProductID` braced and `Content-Types` MIME types fixed for SharePoint validation (`996c4ef`, `.agents/notes/implemented/fix/2026-08-21-sppkg-productid-and-content-types.md`).

### Added
- Docs: mono-version `0.0.11` noted for all publishable packages (`8a65704`).

> Git tag: `v0.0.11` · npm dist-tag: `latest`.

## [0.0.10] - 2026-08-21

Covers `65df8ff..996c4ef` and `d19a9e4..53bc50e` — Teams/Outlook and config hardening before `0.0.11`.

### Added
- Default favicon, Teams/Outlook manifest with icons and multi-webpart docs (`6aa9ddf`, `.agents/notes/implemented/feature/2026-08-19-favicon-teams-multi-webpart.md`).
- `serve.json` env-var interpolation and auto-create for missing configs (`53bc50e`).
- Docs: project structure, manifest naming, and deployment guide (`d19a9e4`).

### Fixed
- Teams/Outlook manifest now correctly enables `teams.enabled` with icons (`65df8ff`).
- Teams auto-create gated on `teams.enabled` flag (`ff4bda6`).
- XSS/CORS/certs hardening, cert SAN fix, `dev-server` CORS, and `deploy` hardening (`f86b2c3`, `a5bf274`, `.agents/notes/implemented/fix/2026-08-19-harden-xss-cors-certs.md`, `.agents/notes/implemented/security/2026-08-19-security-audit-spfx-spa.md`).
- Broken relative links fixed and cert trust warning added (`a93d79e`).

### Changed
- Docs deduped, roadblocks and real-tenant docs added (`a5bf274`).

> Git tag: `v0.0.10` (rolled into `0.0.11` bump; no separate npm tag).

## [0.0.9] - 2026-08-04

Covers `bed37f9..0d490c6` — extensions, bundler parity, and standards.

### Added
- SPFx Extensions end-to-end — Application Customizer, Field Customizer, ListView CommandSet discovered and emitted (`fd1eba5`, `b43de9f`, `cd3d0c6`).
- SharePoint runtime extension mounting and locale switching in local preview (`51c9c85`).
- Teams assets and localized `resx` metadata packaged into `sppkg` (`cd3d0c6`).
- Vite/Rsbuild framework presets + parity suite — M8 bundler parity (`bed37f9`, PR #4).
- Benchmark harness comparing Heft/Gulp vs RSPFX (`cece838`).
- Solid fast refresh via `solid-refresh/babel` with stub fallback (`601531c`, PR #3).

### Fixed
- Platform-only modules externalized in local preview (`a699e3d`).
- Mock API handle made async to match `dev-server` route handler (`bbe6880`).

### Changed
- Bundler wording `Turbopack → Rspack/Rsbuild` and roadmap updated (`38adf56`).
- Docs: extensions, Teams/Outlook, multi-locale, and dev-preview documented (`42d1184`, `4eb8f5a`).

> Git tag: include in `0.0.11` lineage; PRs #4 and #5 merged `b23ecfb`.

## [0.0.8] - 2026-08-03

Covers `da5b615..bcf18d4` — local preview mode (SPFx client emulation without SharePoint tenant).

### Added
- Local preview mode — `packages/sharepoint-runtime` + `packages/dev-runtime` emulates Workbench, `WebPartContext`, `serviceScope`, `httpClient` (`da5b615`, PR #2).
- `rsbuild` dev parity with vite — manifests, auto-reload, unminified (`0819f27`).
- Opt-in browser opening, unminified dev builds, Workbench auto-reload (`9c275c3`).
- Docs: local preview replaces playground — `docs/commands.md`, `docs/internal-api.md`, `docs/architecture.md` (`65ae096`).

### Fixed
- `WebPartContext` params parity and build-breaking types (`ac5b77e`).
- `dev-runtime`/`cli`/`templates` tests aligned to OData v4 and post-playground reality (`d114f8d`).
- `rspfx dev --mode local` warns on vite/rsbuild projects (`b9c7c30`).

> Git tag: PR #2 `855acc5`.

## [0.0.7] - 2026-08-02

Covers `f84cf49..dda45d5` and `2299346..f836de1` — plugin foundation and publishing pipeline.

### Added
- Plugin-based project config — `rspack.config.ts` / `vite.config.ts` with `spfx()` (`644476e`, `729dd68`).
- Bundler-agnostic plugin foundation — one `spfx()` entry for all bundlers (`101829d`, `729dd68`).
- Native pipelines — `vite`, `rspack`, `rsbuild` presets with `rspfxResolve` (`dc720ba`).
- Shared `assembleRelease` pipeline and `release`/`dev` hooks (`dc720ba`).
- Localized string resources, `publicPath` capture, configurable project paths (`ef35747`).
- Examples: `examples/solid` Todo with SharePoint list creation, plus standardized copy-paste configs and `why-rspfx` (`958028c`, `f836de1`).

### Changed
- Self-mounting web part classes replace framework adapters (`2299346`).
- Single bundler spawn and read-back; docs show native commands (`bcf18d4`).

### Fixed
- Publishing pipeline `scripts/publish.mjs` added with resume detection and verification (`27a58ec`, `e45665a`, `77a7b2b`, `1cfb34e`, `725a8ea`, `3c2f11a`).
- `pnpm publish` piped stdin to avoid interactive prompts (`3c2f11a`).
- `apps/cli` entry guard uses `realpath` for npm-installed bin (`c485f26`).
- Scaffolded deps pinned to release version; `.npmrc` with `legacy-peer-deps` for `sp-*` exact peers (`88c122f`, `a1f85a1`).

> Git tag: `v0.0.6` at `f84cf49` · npm dist-tag: `latest`.

## [0.0.6] - 2026-08-02

- Bump all publishable packages to `0.0.6` (`f84cf49`) — plugin-config merge `dda45d5` (PR #1).

> Git tag: `v0.0.6`.

## [0.0.5] - 2026-08-02

- Bump to `0.0.5` (`65b8b86`) — adds `rspfx-cli` to scaffolded deps (`88c122f`).

> Git tag: `v0.0.5`.

## [0.0.4] - 2026-08-02

- Bump to `0.0.4` (`0c97aba`) — fixes npm bin guard (`c485f26`), read-after-write lag in publish verification (`77a7b2b`).

> Git tag: `v0.0.4`.

## [0.0.3] - 2026-08-02

- Bump to `0.0.3` (`e45665a`) — publish pipeline resume/retry logic, TDZ fix, stdin pipe, E409 backoff.

> Git tag: `v0.0.3`.

## [0.0.1] - 2026-08-02

Initial public line — rebrand `@rspfx → @mbsks`, workspace and examples setup (`87d4ae3`, `acd162d`, `61d77f6`, `d25896b`, `ecc70cf`, `abdf472`).

### Added
- Monorepo skeleton with `packages/*`, `apps/cli`, `apps/playground`, `examples/*` (`d25896b`, `61d77f6`).
- `rspfx` CLI — `new`/`build`/`dev`/`package`/`deploy`/`playground`/`doctor`/`analyze`/`clean` (`abdf472`).
- Framework web part classes — `react`, `preact`, `vue`, `svelte`, `solid`, `vanilla` (`f1f60f2`–`0bab54b`).
- Compiler `rspack` with framework import stubs, AMD per-entry library names, externals table (`fix(compiler-rspack)` series).
- `dev-runtime` serve mode, `sharepoint-runtime` mock context, `manifest-generator`, `sppkg-builder` (`da5b615` lineage).
- Benchmark harness `bench/bench.mjs` (`4cb6f48`).
- Docs: `docs/architecture.md`, `docs/commands.md`, `docs/frameworks.md`, `docs/compatibility.md`, `docs/fast-refresh.md`, `docs/migration.md`, `docs/roadmap.md` (`ecc70cf`).
- Normalized `repository` URLs to `git+` and uniform `@mbsks/rspfx-*` naming (`d2848d2`, `acd162d`).

> Git tag: `v0.0.1` · npm scope `@mbsks`.

## Publishing and tagging

- **Git tag:** `vX.Y.Z` annotated tag created by `scripts/publish.mjs` on every successful publish. Message body references `CHANGELOG.md#X-Y-Z`. Push with `git push --follow-tags` or `git push origin vX.Y.Z`.
- **npm dist-tag:** published via `pnpm publish --tag <dist-tag>` (default `latest`; prereleases default to `next`; override with `node scripts/publish.mjs --tag <dist-tag>`). All 19 publishable packages share the same version and tag in one run.
- **CHANGELOG.md:** one `## [X.Y.Z] - YYYY-MM-DD` section per version. Link the tag in the section footer. `Unreleased` tracks work since the last tag. On `v1.0.0`, freeze pre-`1.0` entries to `CHANGELOG_ARCHIVE.md`.

[Unreleased]: https://github.com/master8848/rspfx/compare/v0.0.15...HEAD
[0.0.15]: https://github.com/master8848/rspfx/compare/v0.0.14...v0.0.15
[0.0.14]: https://github.com/master8848/rspfx/compare/v0.0.13...v0.0.14
[0.0.13]: https://github.com/master8848/rspfx/compare/v0.0.12...v0.0.13
[0.0.12]: https://github.com/master8848/rspfx/compare/v0.0.11...v0.0.12
[0.0.11]: https://github.com/master8848/rspfx/compare/v0.0.10...v0.0.11
[0.0.10]: https://github.com/master8848/rspfx/compare/v0.0.9...v0.0.10
[0.0.9]: https://github.com/master8848/rspfx/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/master8848/rspfx/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/master8848/rspfx/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/master8848/rspfx/releases/tag/v0.0.6
[0.0.5]: https://github.com/master8848/rspfx/releases/tag/v0.0.5
[0.0.4]: https://github.com/master8848/rspfx/releases/tag/v0.0.4
[0.0.3]: https://github.com/master8848/rspfx/releases/tag/v0.0.3
[0.0.1]: https://github.com/master8848/rspfx/releases/tag/v0.0.1
