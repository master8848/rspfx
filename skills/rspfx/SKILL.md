---
name: rspfx
description: Create and build SharePoint Framework (SPFx) web parts with RSPFX — the community, Rspack-powered toolchain (NOT supported by Microsoft) — plus the official Microsoft Heft toolchain for when official support is required. Use when scaffolding an SPFx project (rspfx new), running the workbench dev server, packaging/deploying .sppkg, choosing between modern (Rspack/Vite/Turbopack, any frontend) and official (Heft + webpack) toolchains, or migrating an existing SPFx project off gulp/Heft.
---

# RSPFX — SPFx on Rspack/Turbopack/Vite (any frontend)

## ⚠️ Support status — read first

- **RSPFX is a community toolchain — NOT supported by Microsoft.** Microsoft only supports the official Heft toolchain (last section). No MS docs, MS support tickets, or Stack Overflow for Heft/webpack apply to RSPFX builds.
- Pick RSPFX for: **speed** (Rust-based Rspack, ~5–10× faster builds than webpack), **any frontend** (React, Vue, Svelte, Solid, Preact, vanilla — official SPFx is React-only), **any bundler** (Rspack default, Vite, Turbopack), one config file instead of gulp + Heft + webpack. Most users choose it for the faster, modern toolchain.
- Limitations: web parts only (no `ApplicationCustomizer`, `ListViewCommandSet`, library components, Angular), SPFx 1.20–1.23 only, single-locale UI strings.

## 1. Install

```sh
node -v        # need 20+
npm i -g @mbsks/rspfx-cli
rspfx --version
```

## 2. Scaffold a project

```sh
rspfx new my-app    # interactive: framework, language, Fluent, SPFx version, pm
```

Non-interactive (CI-safe):

```sh
rspfx new my-app --framework react --language ts --fluent --spfx-version 1.22 --pm pnpm --yes
```

| Flag | Values |
|---|---|
| `--framework` | `vanilla` \| `react` \| `solid` \| `preact` \| `vue` \| `svelte` |
| `--language` | `ts` \| `js` |
| `--fluent` | Fluent UI adapter (React only) |
| `--spfx-version` | `1.20` \| `1.21` \| `1.22` \| `1.23` (default 1.23) |
| `--pm` | `pnpm` \| `npm` \| `yarn` |
| `--no-install` | skip dependency install |

## 3. Dev loop (workbench-first, like `gulp serve`)

```sh
rspfx dev                       # HTTPS dev server :4321 + auto-open SharePoint workbench
rspfx dev --tenant https://contoso.sharepoint.com   # if no dev.tenantUrl in config / SPFX_SERVE_TENANT_DOMAIN
rspfx dev --refresh             # state-preserving fast refresh (react/preact/solid/vue/svelte)
rspfx playground                # localhost sandbox — no SharePoint needed
```

- Cert: self-signed cert auto-generated in `~/.rspfx/certs`; trust it (macOS: Keychain Access → import → Always Trust; CLI prints the command).
- Tenant URL: `dev.tenantUrl` in config, `SPFX_SERVE_TENANT_DOMAIN` env var, or `--tenant`.

## 4. Build / package / deploy

```sh
rspfx build       # dist/ bundles + release/ manifests
rspfx package     # → sharepoint/solution/<name>.sppkg
rspfx deploy      # upload to app catalog via REST (RSPFX_ACCESS_TOKEN + RSPFX_APP_CATALOG_URL); prints manual steps without a token
rspfx doctor      # env/config/port checks; exit 1 on failure — run first when something breaks
rspfx analyze     # bundle size report → .rspfx/analyze.html
rspfx clean
```

Manual install: upload the `.sppkg` to the tenant app catalog → Deploy → site → Add an app → Add to page.

## 5. Config — your bundler, your frontend

Project config is a **plugin inside your bundler config**; the CLI finds it by its marker symbol.

**Rspack (default)** — `rspack.config.ts`:

```ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';
export default {
  mode: 'development',
  plugins: [new RspfxPlugin({
    name: 'my-app', framework: 'react', spfxVersion: '1.22',
    dev: { tenantUrl: 'https://contoso.sharepoint.com' },
    build: { minify: true },
  })],
};
```

**Vite** — `vite.config.ts`: `plugins: [rspfxVite({ ... })]` (build + dev; playground is Rspack-only).
**Turbopack / webpack-compatible** — `RspfxPlugin` implements the webpack plugin interface (`apply(compiler)`); **experimental**, testable only — prefer Rspack or Vite.

Migrating an existing project: `node scripts/migrate-to-rspfx.mjs .` then `rspfx doctor` → `rspfx dev` → `rspfx package`.

---

## Official Microsoft-supported toolchain (Heft + webpack)

Use this when official support, extensions (ApplicationCustomizer, ListViewCommandSet), library components, Angular, or SPFx < 1.20 / on-premises is required. Slower, webpack-based, React-only, but fully documented and supported by Microsoft.

**Prereqs:** Node 22 LTS, Microsoft 365 (developer) tenant, modern browser.

**Install (one line):**

```sh
npm install @rushstack/heft yo @microsoft/generator-sharepoint --global
```

**Create + dev:**

```sh
yo @microsoft/sharepoint   # SPFx 1.22+ → Heft toolchain by default; --use-gulp for legacy
cd my-app && npm install
heft trust-dev-cert        # trust the :4321 self-signed cert
heft start --clean         # dev server + workbench (aka npm run start)
```

**Build / package / test:**

```sh
heft build                              # compile + bundle
heft package-solution --production      # → sharepoint/solution/<name>.sppkg
heft test                               # unit tests
```

- SPFx ≤ 1.21.1: legacy **gulp** toolchain (`npm i -g gulp-cli yo @microsoft/generator-sharepoint`; `gulp serve`, `gulp trust-dev-cert`, `gulp bundle --ship`, `gulp package-solution --ship`).
- SPFx 1.23+: Heft only (gulp officially unsupported from 1.24). Microsoft docs: https://learn.microsoft.com/sharepoint/dev/spfx/set-up-your-development-environment

## Decision shortcut

| Need | Toolchain |
|---|---|
| Speed, modern tooling, any frontend/bundler, web parts only, SPFx 1.20–1.23 | **RSPFX** |
| Microsoft support, extensions/ACEs/library components/Angular, older SPFx, on-prem | **Official Heft** (or gulp for ≤1.21.1) |
