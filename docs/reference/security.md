# Security — Dependencies and Supply-Chain Hardening

RSPFx treats supply-chain security as a first-class architecture property: minimal dependencies, zero-dependency core, deterministic lockfiles, and blast-radius isolation. This page is the single home for the dependency inventory, what each installed dependency is and why it is in the project, what servers run in this project, and the mitigations for recent npm/Rust supply-chain attacks.

## Threat model — recent supply-chain attacks (2024–2025)

Recent incidents relied on the same pattern: a popular transitive dependency is compromised via stolen maintainer credentials or typosquatting, a patch release injects a postinstall or lifecycle script, and `npm install` with floating ranges pulls the malicious version before a lockfile or audit catches it. Notable cases include `event-stream` (2018), `ua-parser-js` / `coa` / `rc` (2021), `colors` (2022), and the September 2025 Shai-Hulud worm that spread through 100+ npm packages via compromised maintainer tokens and self-propagating publish actions (`eslint-config-prettier`, `chalk`, `debug` families).

RSPFx mitigates this class with three controls: (1) pinning every resolved version in a committed lockfile with integrity hashes, (2) minimizing the number and privilege of dependencies that run install-time code, and (3) keeping the critical path (`@mbsks/rspfx-core`, `@mbsks/rspfx-manifest-generator`, `@mbsks/rspfx-sppkg-builder`) free of third-party runtime code.

## Dependency inventory — complete list

Every package uses ESM (`"type": "module"`) and builds with `tsc` to `dist/` (`packages/*/tsconfig.build.json:1`). Internal dependencies are `workspace:*` and carry no registry risk. External runtime dependencies are listed below by package — exact specifiers from `package.json`, resolved versions and `sha512` integrity from `bun.lock` and `pnpm-lock.yaml`, Rust crates from `Cargo.toml`/`Cargo.lock`. `dependencies` vs `devDependencies` vs `peerDependencies` vs `optionalPeers` is explicit in each `package.json`.

### Root (repo tooling, dev-only — never published)

| Package | Specifier | Resolved | Purpose | Ships to consumers |
|---|---|---|---|---|
| `@biomejs/biome` | `1.9.4` | `1.9.4` | Lint/format (`biome.json:1`) | No |
| `@types/node` | `^22.10.0` | `22.20.1` | Type definitions | No |
| `happy-dom` | `^15.11.0` | `15.11.7` | DOM for `vitest` `environment: happy-dom` | No |
| `typescript` | `^5.7.0` | `5.9.3` | `tsc` builds (`tsconfig.base.json:1`) | No |
| `vite` | `^5.4.21` | `5.4.21` | Test harness + `docs-web` dev | No |
| `vitest` | `^2.1.0` | `2.1.9` | Test runner (`vitest.config.ts:1`) | No |

Root has no `dependencies`, only `devDependencies` (`package.json:34`). Compromise here cannot ship to consumers.

### `@mbsks/rspfx-core` — zero dependencies

`packages/core/package.json:1` declares no `dependencies` and no `peerDependencies`.

It exports `defineConfig` / `resolveConfig` / `RSPFX_PLUGIN_MARKER` (`packages/core/src/index.ts:67`), `HeadlessAdapter` (`packages/core/src/headless.ts:1`), and `Version`/`EnvironmentType` mirrors. This is the trust anchor: every other package depends on it, it depends on nothing. A single compromised transitive dependency cannot reach the core.

`packages/webpart-base`, `packages/diagnostics`, `packages/templates`, `packages/manifest-generator`, `packages/plugin-api`, and `packages/sharepoint-runtime` also carry zero third-party runtime dependencies beyond `workspace:*` — see `docs/internal-api.md` for the dependency graph.

### `@mbsks/rspfx-cli` — two npm dependencies

| Package | Specifier | Resolved | Why it is needed | Privilege |
|---|---|---|---|---|
| `commander` | `^12.1.0` | `12.1.0` | CLI argument parsing (`apps/cli/src/cli.ts:1`) | No lifecycle scripts, no network, pure JS |
| `jiti` | `^2.4.0` | `2.7.0` | Load `vite.config.ts`/`rspack.config.ts` without pre-build (`apps/cli/src/config.ts:1`) | No lifecycle scripts |

CLI composes all packages (`apps/cli/package.json:26`) but adds only these two. Both are widely audited, have no install scripts, and are pinned in `bun.lock` with `sha512` integrity.

### `@mbsks/rspfx-compiler-rspack` — build toolchain

| Package | Specifier | Resolved | Purpose | Ships to `.sppkg`/`dist` |
|---|---|---|---|---|
| `@rspack/core` | `^1.2.0` | `1.7.12` | Bundler — SWC built-in for TS/JS, no Babel at runtime (`packages/compiler-rspack/src/config.ts:1`) | No (tool only) |
| `@rspack/dev-server` | `^1.0.0` | `1.2.1` | Dev server on `:4321` (`packages/compiler-rspack/src/dev-server.ts:1`) | No (dev only) |
| `sass` | `^1.83.0` | `1.102.0` | SCSS compilation — Dart Sass, pure JS API | No |
| `sass-loader` | `^16.0.4` | `16.0.8` | Rspack loader bridge for `sass` | No |
| `css-loader` | `^7.1.2` | `7.1.4` | CSS modules handling | No |
| `style-loader` | `^4.0.0` | `4.0.0` | Inline CSS into JS — SPFx has no external CSS in `.sppkg` | No |
| `postcss` | `^8.4.49` | `8.5.25` | CSS transforms (autoprefixer compat) | No |
| `postcss-loader` | `^8.1.1` | `8.2.1` | Loader bridge for `postcss` | No |

All eight are build-time only; none are bundled into `dist/` output or `.sppkg`. `sass` is the only one with native code and it is isolated to `compiler-rspack`.

### `@mbsks/rspfx-sppkg-builder` — one dependency

| Package | Specifier | Resolved | Purpose |
|---|---|---|---|
| `fflate` | `^0.8.2` | `0.8.3` | ZIP assembly (`packages/sppkg-builder/src/zip.ts:1`), pure JS, no native, no lifecycle scripts, <15 kB. Chosen over `jszip`/`yazl` to minimize surface. |

### `@mbsks/rspfx-manifest-server` — one dependency

| Package | Specifier | Resolved | Purpose |
|---|---|---|---|
| `selfsigned` | `^2.4.1` | `2.4.1` | Dev cert generation (`packages/manifest-server/src/certs.ts:1`), dev-only, never in production builds. Generates 825-day self-signed cert with `localhost` + `127.0.0.1` + `::1` SANs, cached in `~/.rspfx/certs`. |

### Framework adapters — scoped per framework, peer-externalized

Each framework package depends only on its own compiler bridge; the UI framework itself is a `peerDependency` and is never installed by RSPFx:

- `@mbsks/rspfx-framework-react` (`packages/framework-react/package.json:22`): `@babel/core` `^7.26.0`, `@babel/preset-react` `^7.26.0`, `@babel/preset-typescript` `^7.26.0`, `babel-loader` `^9.2.1`, `@rspack/plugin-react-refresh` `^1.0.0`, `@vitejs/plugin-react` `^4.7.0`, `react-refresh` `^0.16.0`; peers `react` `^18.0.0`, `react-dom` `^18.0.0`.

- `@mbsks/rspfx-framework-preact` (`packages/framework-preact/package.json:22`): `@babel/core`, `@babel/preset-react`, `@babel/preset-typescript`, `babel-loader`, `@prefresh/babel-plugin` `^0.5.2`, `@prefresh/vite` `^2.4.12`, `@rspack/plugin-preact-refresh` `^1.0.0`; peer `preact` `^10.24.0`.

- `@mbsks/rspfx-framework-solid` (`packages/framework-solid/package.json:22`): `@babel/core`, `@babel/preset-typescript`, `babel-loader`, `babel-preset-solid` `^1.9.4`, `solid-refresh` `^0.7.8`, `vite-plugin-solid` `^2.11.0`; peer `solid-js` `^1.9.0`.

- `@mbsks/rspfx-framework-vue` (`packages/framework-vue/package.json:22`): `@vitejs/plugin-vue` `^5.2.0`, `@vue/compiler-sfc` `^3.5.13`, `vue-loader` `^17.4.2`; peer `vue` `^3.5.0`.

- `@mbsks/rspfx-framework-svelte` (`packages/framework-svelte/package.json:22`): `@sveltejs/vite-plugin-svelte` `^3.1.0`, `svelte-loader` `^3.2.4`, `svelte-hmr` `^0.16.0`; peer `svelte` `^4.2.0 || ^5.0.0`.

- `@mbsks/rspfx-framework-vanilla` (`packages/framework-vanilla/package.json:1`): no external dependencies.

- `@mbsks/rspfx-fluent-adapter` (`packages/fluent-adapter/package.json:1`): no external dependencies; peer `@fluentui/react` `^8.0.0` optional.

This design means a project using `framework-vanilla` installs zero Babel/Vite plugins; a React project installs only React's bridge.

### `@mbsks/rspfx-plugin` — re-exports only

`packages/plugin/package.json:22` declares a single runtime dependency `@rspack/core` `^1.2.0` and an optional peer `@rsbuild/core` `^2.1.9`; dev dependencies `vite` `^5.4.0` and `@rsbuild/core` are build-time only.

### Rust crates — optional, with JS fallback

`crates/rspfx-sppkg`, `crates/rspfx-manifest`, `crates/rspfx-rspack-plugin` are optional native acceleration (`Cargo.toml:1`). When the `.node` binary is absent the JS implementation runs — `bun run build` and `bun run test` pass with or without native.

| Crate | Specifier | Resolved (`Cargo.lock:1`) | Purpose |
|---|---|---|---|
| `zip` | `2.2` | `2.4.2` | ZIP assembly (mirrors `fflate`) |
| `flate2` | `1.0` | `1.1.9` | Deflate |
| `quick-xml` | `0.36` | `0.36.2` | `AppManifest.xml` generation |
| `walkdir` | `2.5` | `2.5.0` | File traversal |
| `rayon` | `1.10` | `1.12.0` | Parallel emit |
| `memchr` | `2.7` | `2.8.3` | Byte search |
| `regex` | `1.10` | `1.13.1` | Manifest rewriting |
| `serde` / `serde_json` | `1.0` | `1.0.229` / `1.0.151` | JSON |
| `tokio` | `1.40` | `1.53.1` | Async (manifest crate) |

`Cargo.lock` pins every transitive crate with `checksum` (`sha256`) and is committed. Rust dependencies do not run at `npm install` time.

### Docs site (`docs-web`) — isolated

`docs-web/package.json:1` declares `vue` `3.5.13` and dev deps `vitepress` `^1.6.4` plus `@vue/*` compilers. This workspace is never a dependency of any `@mbsks/*` package; a compromised `vitepress` cannot reach the toolchain.

## Detail — what each installed dependency is and why it is in the project

`commander` (`apps/cli/package.json:34`) is the CLI parser for `rspfx new|migrate|dev|build|package|deploy|doctor|analyze|clean` (`apps/cli/src/cli.ts:1`). It has no dependencies, no postinstall, and handles only `process.argv` — no filesystem or network side effects beyond printing help.

`jiti` (`apps/cli/package.json:35`) loads `vite.config.ts` / `rsbuild.config.ts` / `rspack.config.ts` at runtime without requiring the user to pre-compile TypeScript (`apps/cli/src/config.ts:12`). It transpiles on the fly via an in-memory transform and is the only runtime compiler in the CLI; it does not execute user code outside config loading.

`@rspack/core` (`packages/compiler-rspack/package.json:38`) is the Rspack bundler (Rust-based webpack-compatible) that compiles `src/` to `dist/*.js` with `output.library.type: 'amd'` (`packages/compiler-rspack/src/config.ts:44`). It embeds SWC for TS/JS so Babel is not needed on the hot path; framework Babel presets are additive only for JSX frameworks.

`@rspack/dev-server` (`packages/compiler-rspack/package.json:39`) wraps `webpack-dev-server` for Rspack and is invoked by `startDevServer` (`packages/compiler-rspack/src/dev-server.ts:8`). It serves `dist/*.js`, `/temp/manifests.js`, and `node_modules/*` on `:4321` and handles `watch` → rebuild → `onEmit` → `tick()` for live reload.

`sass` (`packages/compiler-rspack/package.json:40`) is Dart Sass (`1.102.0`) used by `sass-loader` to compile `*.scss` / `*.module.scss` (`packages/compiler-rspack/src/loaders.ts:1`). It runs only when a project imports SCSS; projects without SCSS never load it.

`sass-loader` / `css-loader` / `style-loader` / `postcss` / `postcss-loader` (`packages/compiler-rspack/package.json:41`) form the CSS pipeline (`packages/compiler-rspack/src/loaders.ts:1`). `css-loader` resolves `@import`/`url()`, `postcss` runs transforms, `style-loader` inlines the result into the JS bundle because SPFx `.sppkg` must not contain external `.css` files (`reference/FORMATS.md#4`). `experiments.css` is not used; the loader chain is explicit and auditable.

`fflate` (`packages/sppkg-builder/package.json:28`) is a 8 kB pure-JS DEFLATE/ZIP implementation (`packages/sppkg-builder/src/zip.ts:6`). It replaces `jszip` (larger, more deps) and `yazl` (native-adjacent) and has zero dependencies and no `postinstall`; it assembles `sharepoint/solution/*.sppkg` as a valid ZIP with `DEFLATE` level 9.

`selfsigned` (`packages/manifest-server/package.json:17`) generates a self-signed cert for `rspfx dev --mode sharepoint` (`packages/manifest-server/src/certs.ts:18`). It calls Node `crypto` only, writes `~/.rspfx/certs/cert.pem` + `key.pem` (`0600`) and `cert.pem.trust.txt`, and validates via `X509Certificate` (`packages/manifest-server/src/certs.ts:42`). It never runs in `rspfx build` or `rspfx package`.

`@babel/core` + `babel-loader` + presets (`packages/framework-react/package.json:14`) transpile JSX/TSX for the Rspack path (`packages/framework-react/src/preset.ts:8`). The Vite path uses `@vitejs/plugin-react` / `@prefresh/vite` / `vite-plugin-solid` / `@vitejs/plugin-vue` / `@sveltejs/vite-plugin-svelte` instead, so Babel is not loaded when the user runs `vite build`. Each framework package installs only its own bridge — e.g. a Vue project never installs `babel-preset-solid`.

`@rspack/plugin-react-refresh` / `@rspack/plugin-preact-refresh` / `react-refresh` / `@prefresh/babel-plugin` / `solid-refresh` / `svelte-hmr` (`packages/framework-*/package.json:1`) are fast-refresh runtimes (`packages/dev-runtime/src/refresh.ts:1`). They are gated on `dev.fastRefresh` / `RSPFX_FAST_REFRESH=1` and `mode !== 'production'`; production builds never import them. `svelte-hmr` and `solid-refresh` wrap the framework's own HMR protocol.

`@vitejs/plugin-react` / `@vitejs/plugin-vue` / `@prefresh/vite` / `vite-plugin-solid` / `@sveltejs/vite-plugin-svelte` / `vue-loader` / `svelte-loader` (`packages/framework-*/package.json:1`) are Vite/Rspack loader bridges (`packages/framework-*/src/preset.ts:12`). They are resolved via `resolveContributionLoaders` against the framework package's own `node_modules` (`packages/dev-runtime/src/framework.ts:22`) and aliased to stubs when the framework is not selected (`packages/compiler-rspack/src/aliases.ts:1`), so unused loaders never execute.

Rust crates (`Cargo.toml:5`): `zip` + `flate2` mirror `fflate` for native ZIP, `quick-xml` serializes `AppManifest.xml`/`feature.xml`, `walkdir` walks `src/` for manifest discovery, `rayon` parallelizes emit, `memchr`/`regex` rewrite `SPFX_PUBLIC_PATH_SENTINEL`, `serde`/`serde_json` parse `config/*.json`, `tokio` drives the async manifest crate. All are pinned in `Cargo.lock:1` with `checksum` and are optional — JS fallback exists in each package (`try { require('../../crates/.../index.node') } catch {}`).

## Servers in this project — what serves what

RSPFx has no production server. All servers below run only on the developer machine during `rspfx dev` or `bun run docs:dev`. No server is bundled into `dist/` or `.sppkg`, and no server phones home.

### 1. Bundler dev server on `:4321` — the single dev port

`rspfx dev` (`apps/cli/src/commands/dev.ts:1`) delegates to `@mbsks/rspfx-dev-runtime` `startServe` (`packages/dev-runtime/src/serve.ts:18`), which starts one of three bundler servers on `dev.port` (default `4321`, override `--port` or `dev.port` in `RSPFX_PLUGIN_MARKER` options). The protocol is `http` in `mode: 'local'` and `https` in `mode: 'sharepoint'` (cert from `~/.rspfx/certs`).

- **Rspack path** (`packages/compiler-rspack/src/dev-server.ts:1` → `startDevServer`): wraps `@rspack/dev-server` (`1.2.1`). Serves `dist/*.js`, `/temp/manifests.js` (generated by `createManifestRegenerator`, `packages/dev-runtime/src/manifests.ts:1`), `node_modules/*` static proxy for `sp-*` debug manifests, and `/__rspfx_hot.json` (reload controller, `packages/dev-runtime/src/reload.ts:1`). Rebuild is `watch()` → `onEmit` → `tick()` → poll on client → `location.reload()`.

- **Vite path** (`packages/plugin/src/vite.ts:1` `rspfxVite` `configureServer`): spawns `vite` (`^5.4.0` dev dep of `@mbsks/rspfx-plugin`). Serves the same `dist/` + `/temp/manifests.js` via Vite middleware, per-bundle `vite build` for `rspfx build` (`packages/plugin/src/vite.ts:42` `VITE_ENV` `RSPFX_VITE_ENTRY`/`RSPFX_VITE_AMD_ID`), and `?t=<epoch>` cache-bust on bundle URLs after each rebuild. Workbench-only for now.

- **Rsbuild path** (`packages/plugin/src/rsbuild.ts:1` `rspfxRsbuild` `setup` `modifyRspackConfig`/`onBeforeStartDevServer`): spawns `rsbuild dev` (`@rsbuild/core` `^2.1.9` optional peer). Single `rsbuild build` for all bundles, same `:4321` serving contract.

All three write `.rspfx/stats.json` (`{ moduleCounts: { "<bundle>": n } }`) for `rspfx analyze` on bundlers that emit no webpack stats.

### 2. `manifest-server` — certs only, not a server

`@mbsks/rspfx-manifest-server` (`packages/manifest-server/src/certs.ts:1`) does not serve HTTP. It provides `ensureCertificates(certsDir, hostname)` (selfsigned, 825 days, SANs `localhost`/`127.0.0.1`/`::1` + optional `hostname`), `getCertStatus` (expiry <7d, SAN mismatch via `X509Certificate`), `isCertTrusted` (`security verify-cert` macOS / `certutil -verify` Windows / `unknown` Linux), and `formatTrustInstructions`. The `:4321` serving is handled by the bundler dev server above.

### 3. `dev-runtime` orchestration (`packages/dev-runtime/src/serve.ts:1`)

`startServe` composes the bundler server with:

- `createReloadController` (`packages/dev-runtime/src/reload.ts:1`) — monotonic counter at `GET /__rspfx_hot.json` (`no-store` + CORS), `tick()` after each rebuild, client script appended to `/temp/manifests.js` polls and reloads.

- `createManifestRegenerator` (`packages/dev-runtime/src/manifests.ts:1`) — regenerates `/temp/manifests.js` after each compile from `generateComponentManifests` + `findSpDependencies` (project + `sp-*` debug manifests, `debugBaseUrl` `https://localhost:4321/dist/`).

- `buildWorkbenchUrl` (`packages/dev-runtime/src/serve.ts:88`) — `https://<tenant>/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=<encoded https://localhost:4321/temp/manifests.js>` (see `reference/FORMATS.md#3` and Microsoft docs: [Use the Workbench](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/tools/workbench)).

- Mode resolution (`packages/dev-runtime/src/mode.ts:1` `resolveServeMode`): explicit `--mode` wins, else tenant domain (`--tenant` / `dev.tenantUrl` / `SPFX_SERVE_TENANT_DOMAIN`) selects `sharepoint`, else `local`. `resolveServeSettings` merges `CLI --port` → `config/serve.json` → plugin `dev` options → defaults.

### 4. Local preview (`mode: 'local'`, default, no tenant)

`http://localhost:4321/` (`packages/dev-runtime/src/local-page.ts:1` `buildLocalPageHtml`): static HTML served at `/` that injects `window.__RSPFX_COMPONENTS__` and loads `/dist/local-runtime.js` (browser entry `packages/sharepoint-runtime/src/local-bootstrap.ts:1`). `createMockSharePointApi` (`packages/dev-runtime/src/mock-api.ts:1`) mounts `/_api` (mock OData v4: `/_api/web`, `/site`, `/lists`, item CRUD via `X-HTTP-Method`, `POST /contextinfo`), seeded from `local/data.json` if present. No SharePoint tenant, no cert, plain HTTP.

### 5. SharePoint workbench (`mode: 'sharepoint'`, tenant set)

`https://localhost:4321` (`packages/dev-runtime/src/serve.ts:18`): `/temp/manifests.js`, `/dist/*.js`, `node_modules/*` via HTTPS with `ensureCertificates()`. Workbench loads `debugManifestsFile` → `loaderConfig` → bundle URLs; `rspfx dev` warns on missing/expiring/untrusted cert and `rspfx doctor` checks `cert exists` / `valid` / `key.pem 0600` / `trusted` (`docs/commands.md#rspfx-doctor` and `docs/getting-started.md#cert-trust`).

### 6. Docs site — separate VitePress server

`docs-web` (`docs-web/.vitepress/config.mts:1`, `docs-web/package.json:1`) runs `vitepress dev` (`^1.6.4`) for https://rspfx.mbsks.me. It is a `docs-web` workspace only, never imported by `@mbsks/*` packages. It serves markdown via VitePress and publishes raw markdown at `/_headers` + `/_redirects` (`docs-web/.vitepress/config.mts:79` `buildEnd`), with a dev middleware for `/md/*` (`docs-web/.vitepress/config.mts:288`). It has no relation to `:4321`.

## Design principles — minimal dependency, minimal blast radius

Zero-dependency core (`packages/core/package.json:1` has no `dependencies`) is the single trust anchor; compromise of any leaf cannot propagate to config resolution or type definitions.

Minimal transitive closure: `sppkg-builder` has one pure-JS dep (`fflate`), `manifest-server` has one dev-only dep (`selfsigned`), `cli` has two (`commander`, `jiti`). The default install without a framework adapter touches <10 external packages plus Rspack. See `docs/architecture.md#dependency-graph` for the full graph.

Peer externalization: UI frameworks (`react`, `vue`, `svelte`, `solid-js`, `preact`) and SharePoint packages (`@microsoft/sp-*`) are `peerDependencies` or `externals` (`packages/core/src/versions.ts:1` and `packages/compiler-rspack/src/externals.ts:1`); they are never bundled or fetched by RSPFx itself. A compromised `react` release does not affect vanilla or Vue projects.

Dev vs prod separation: `sass`, `sass-loader`, `css-loader`, `postcss`, `selfsigned`, `@rspack/dev-server`, and all framework Babel/Vite plugins run only in `rspfx dev` or `rspfx build` on the developer machine; none are included in `dist/` bundles or `.sppkg` output. Production artifacts contain only user code plus the SharePoint loader.

No install-time code in the critical path: `fflate`, `commander`, `jiti`, `selfsigned`, and all `@mbsks/*` packages have no `postinstall`/`preinstall` scripts (`npm pkg get scripts` is empty). Audit with `npm query ":attr(scripts, [postinstall])"` or `bun pm pack --dry-run`.

Workspace isolation and framework loader stubbing: framework loaders (`vue-loader`, `svelte-loader`, `@rspack/plugin-react-refresh`) are aliased to stubs when not needed so they never ship to the browser (`packages/plugin/src/vite.ts:1` and `packages/compiler-rspack/src/aliases.ts:1`).

## Version pinning and deterministic installs

Committed lockfiles are the source of truth: `bun.lock` (`lockfileVersion: 2`) pins every npm package with `sha512` integrity, `pnpm-lock.yaml` (`lockfileVersion: '9.0'`) mirrors it for pnpm users, and `Cargo.lock` pins every Rust crate with `sha256` checksums. CI and contributors install with `bun install --frozen-lockfile` (or `pnpm install --frozen-lockfile`), which fails if the lockfile is out of sync — a floating malicious patch cannot be pulled silently.

Semver ranges in `package.json` use `^` or exact (`1.9.4`) for the lower bound but the resolved version is frozen by the lockfile; publishing does not widen the range. Internal packages use `workspace:*`, which resolves to the local version at publish time via `scripts/publish.mjs:17` and never hits the registry. Consumers who install `@mbsks/rspfx-cli@0.0.15` get the exact transitive versions that passed `bun run test` for that tag (`v0.0.15`).

Dependabot/Renovate and `npm audit` / `bun audit` / `cargo audit` / `osv-scanner` run against the lockfiles; a new vulnerability triggers a single PR that bumps the lockfile and `CHANGELOG.md` `## [X.Y.Z]` — no silent auto-merge. See `CONTRIBUTING.md#publishing-and-tagging` for the release gate (`git status --porcelain` must be clean, `CHANGELOG.md` must contain the new section, `bun run test` must pass).

npm provenance and 2FA: publishes use `npm publish --provenance` (Sigstore) and require `RSPFX_NPM_OTP` (`docs/commands.md#environment-variables`), so a stolen token alone cannot publish without the OTP and the build attestation.

## Verification and consumer checklist

Verify the install is deterministic: `bun install --frozen-lockfile --dry-run` should report no changes; `bun pm audit` and `cargo audit` should report zero high-severity issues. Inspect the resolved tree with `bun pm ls` or `pnpm ls --depth=1` and compare to the inventory above — any unexpected top-level package is a sign of lockfile drift.

Pin your application lockfile the same way: commit `bun.lock` or `pnpm-lock.yaml`, enable `frozen-lockfile` in CI, and run `npm audit signatures` (or `bun audit --audit-level high`) on every PR. Avoid `npm install --no-package-lock` and avoid floating `*` ranges for framework peers — use the exact versions from `examples/<name>/package.json:1`.

Report a suspected compromise: open an issue with `npm ls <pkg>` and `bun.lock` diff, and pin the suspected package with `overrides` (`package.json:1` `overrides` field) until a fixed lockfile is published. See `docs/commands.md#rspfx-doctor` for `rspfx doctor` checks that also validate `key.pem` permissions (`0600`) and cert SANs.

## Further reading

- Dependency graph and package roles: `docs/architecture.md#dependency-graph`.
- Package surfaces and `peerDependencies`: `docs/internal-api.md`.
- CLI flags and `RSPFX_*` env vars: `docs/commands.md#environment-variables`.
- Publish attestation and tagging: `scripts/publish.mjs:17` and `CONTRIBUTING.md#publishing-and-tagging`.
- Reference formats that avoid bundling `sp-*`: `reference/FORMATS.md`.
