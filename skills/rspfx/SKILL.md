---
name: rspfx
description: Create and build SharePoint Framework (SPFx) web parts with RSPFX — the community, Rspack-powered toolchain (NOT supported by Microsoft) — plus the official Microsoft Heft toolchain for when official support is required. Use when scaffolding an SPFx project (rspfx new), running the workbench dev server, packaging/deploying .sppkg, choosing between modern (Rspack/Vite/Rsbuild, any frontend) and official (Heft + webpack) toolchains, or migrating an existing SPFx project off gulp/Heft.
---

# RSPFX — SPFx on Rspack/Vite/Rsbuild (any frontend)

## ⚠️ Support status — read first

- **RSPFX is a community toolchain — NOT supported by Microsoft.** Microsoft only supports the official Heft toolchain (last section). No MS docs, MS support tickets, or Stack Overflow for Heft/webpack apply to RSPFX builds.
- Pick RSPFX for: **speed** (Rust-based Rspack, ~5–10× faster builds than webpack), **any frontend** (React, Vue, Svelte, Solid, Preact, vanilla — official SPFx is React-only), **any bundler** (Rspack default, Vite, Rsbuild), one config file instead of gulp + Heft + webpack. Most users choose it for the faster, modern toolchain.
- Capabilities: web parts + extensions (`ApplicationCustomizer`, `FieldCustomizer`, `ListViewCommandSet`, `FormCustomizer`) + library components (`Library`), SPFx 1.20–1.23, multi-webpart in one `.sppkg`, Teams/Outlook install via `teams/manifest.json`, multi-locale (`Resources.resx` + `localizedPath` + `?locale=` preview), favicon at `assets/favicon.svg` (see below).
- Limitations: no Angular, SPFx 1.24 preview not yet supported (see `docs/compatibility.md` + `packages/core/src/versions.ts`).

## 1. Install

```sh
node -v        # need 20+
npm i -g @mbsks/rspfx-cli@0.0.11
rspfx --version  # 0.0.11
```

Mono-version: all 19 publishable packages (`packages/*` + `apps/cli`) share one version via `scripts/publish.mjs:17` `0.0.11`) — `@mbsks/rspfx-core`, `@mbsks/rspfx-plugin`, `@mbsks/rspfx-compiler-rspack`, `@mbsks/rspfx-dev-runtime`, `@mbsks/rspfx-diagnostics`, `@mbsks/rspfx-fluent-adapter`, `@mbsks/rspfx-manifest-generator`, `@mbsks/rspfx-manifest-server`, `@mbsks/rspfx-plugin-api`, `@mbsks/rspfx-sharepoint-runtime`, `@mbsks/rspfx-sppkg-builder`, `@mbsks/rspfx-templates`, `@mbsks/rspfx-framework-*` (`react`/`vanilla`/`vue`/`svelte`/`solid`/`preact`), and `@mbsks/rspfx-cli` all at `0.0.11`; `examples/*` and `apps/playground` are `private:true` and never published (`scripts/publish.mjs:65`).

Upgrade: `npm i -g @mbsks/rspfx-cli@latest` pulls matching peer packages via `workspace:*` in new scaffolds; pin `spfxVersion` separately (`1.20`|`1.21`|`1.22`|`1.23`) — RSPFX version and SPFx target are orthogonal.

## 2. Scaffold a project

```sh
rspfx new my-app    # interactive: framework, language, Fluent, SPFx version, pm, component type
```

Non-interactive (CI-safe):

```sh
rspfx new my-app --framework react --language ts --fluent --spfx-version 1.22 --pm pnpm --yes
rspfx new my-ext --component applicationcustomizer --yes  # fieldcustomizer | listviewcommandset (vanilla, TS)
```

| Flag | Values |
|---|---|
| `--framework` | `vanilla` \| `react` \| `solid` \| `preact` \| `vue` \| `svelte` |
| `--language` | `ts` \| `js` |
| `--fluent` | Fluent UI adapter (React only) |
| `--spfx-version` | `1.20` \| `1.21` \| `1.22` \| `1.23` (default 1.23, see `docs/compatibility.md#spfx-version-matrix`) |
| `--pm` | `pnpm` \| `npm` \| `yarn` |
| `--component` | `webpart` (default) \| `applicationcustomizer` \| `fieldcustomizer` \| `listviewcommandset` \| `formcustomizer` \| `library` |
| `--no-install` | skip dependency install |

Scaffold copies a default favicon `assets/favicon.svg` — a 32×32 SVG combining the Rspack cube red, Vite lightning yellow/purple, and SPFx `S` blue on `#111827` (`packages/templates/src/index.ts` `faviconSvg()`). Copying the project (`cp -r my-app my-copy`) retains `assets/favicon.svg`; no broken favicon in the browser. Replace `assets/favicon.svg` with your own `32×32 viewBox="0 0 32 32"` SVG or add `assets/favicon.ico` + a second `<link>`; dev server serves `/assets/favicon.svg` (`packages/dev-runtime/src/serve.ts` `staticFolders`) and local preview injects `<link rel="icon" type="image/svg+xml" href="${origin}/assets/favicon.svg">` (`packages/dev-runtime/src/local-page.ts`).

## 3. Dev loop (workbench-first, like `gulp serve`)

```sh
rspfx dev                       # local preview at http://localhost:4321/ when no tenant; HTTPS :4321 + SharePoint workbench when tenant set
rspfx dev --tenant https://contoso.sharepoint.com   # if no dev.tenantUrl in config / SPFX_SERVE_TENANT_DOMAIN
rspfx dev --refresh             # state-preserving fast refresh (react/preact/solid/vue/svelte)
rspfx dev --mode local          # force local preview (no tenant, plain HTTP, mock /_api)
```

- Cert: self-signed cert auto-generated in `~/.rspfx/certs` for SharePoint mode only (`docs/getting-started.md#https-certificate-trust-sharepoint-mode-only`); trust it (macOS: Keychain Access → import → Always Trust; Windows: `certutil -addstore Root`; CLI prints the command and `cert.pem.trust.txt` + warns `dev-only, machine-wide` + removal). Local mode `http://localhost:4321/` needs no cert.
- Tenant URL: `dev.tenantUrl` in `rspack.config.ts`, `SPFX_SERVE_TENANT_DOMAIN` env var, or `--tenant`.

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

**Vite** — `vite.config.ts`: `plugins: [rspfxVite({ ... })]` (build + dev; local preview `http://localhost:4321/` + mock `/_api` is Rspack-only for now).
**Rsbuild** — `rsbuild.config.ts`: `plugins: [rspfxRsbuild({ ... })]` (same).
**Turbopack / webpack-compatible** — `RspfxPlugin` implements the webpack plugin interface (`apply(compiler)`); **not possible today** — Turbopack has no webpack plugin API outside Next.js (`docs/roadmap.md`); prefer Rspack or Vite.

Migrating an existing project: `node scripts/migrate-to-rspfx.mjs .` then `rspfx doctor` → `rspfx dev` → `rspfx package`.

## 6. Teams and Outlook install

Teams and Outlook share the same Teams app manifest (see `docs/teams-outlook-install.md`).

Scaffold generates `teams/manifest.json` (Teams schema 1.13, `id` = SharePoint `componentId`, `packageName` `com.contoso.<name>`, `staticTabs` `personal` + `configurableTabs` `team`) + `teams/<id>_color.png` (192×192) + `teams/<id>_outline.png` (32×32) (`packages/templates/src/index.ts` `teamsManifest`). `rspfx package` bundles them under `ClientSideAssets/teams/` in the `.sppkg` (`packages/sppkg-builder/src/sppkg-builder.ts` auto-detects `teams/`).

Install:

1. `rspfx package` → `sharepoint/solution/<name>.sppkg`.
2. SharePoint app catalog → `Apps for SharePoint` → upload → `Deploy` (or `skipFeatureDeployment: true`).
3. Same catalog entry → `Sync to Teams` (or `Teams Admin Center → Manage apps → Upload`). App appears in `Teams → Apps → Built for your org` (`supportedHosts` `TeamsPersonalApp`/`TeamsTab` in `webpartManifest` `500`).
4. Outlook (new Outlook): Teams personal apps (`personal` scope) surface automatically in `Outlook → Apps → Apps built for your org` after sync (10–120 min, sign out/in). No separate Outlook manifest. If missing, verify `staticTabs[0].scopes` contains `personal` and `validDomains` includes `*.office.com` (add `*.outlook.office.com` if needed and repack).

Update: bump `package.json` `version` + `package-solution.json` `solution.version`, `rspfx package`, re-upload → `Replace`. Uninstall: `Teams Admin Center → Block` or catalog `Remove` (Outlook follows).

Details: `docs/teams-outlook-install.md`.

## 7. Multi-webpart (one project, many web parts)

One project ships many web parts in one `.sppkg` (see `docs/multi-webpart.md`).

`rspfx new my-app` scaffolds `src/webparts/my-app/`. Add a second: copy `src/webparts/my-app/` → `src/webparts/todo/`, then in `todo.manifest.json` set new `id` (`node -e "console.log(crypto.randomUUID())"`), `alias` `TodoWebPart`, `preconfiguredEntries[0].title` `Todo`; in `todoWebPart.ts` + `components/Todo.tsx` rename class to `TodoWebPart` + import `Todo` + `styles.Todo`. Each folder needs one `*.manifest.json` + one entrypoint (`<Name>WebPart.ts` etc. — `packages/dev-runtime/src/project.ts` `discoverWebParts`). Extensions live in `src/extensions/` (`rspfx new --component ...`) and mix with web parts.

Build: `rspfx dev` serves `https://localhost:4321/dist/<bundle>.js` per folder + `/temp/manifests.js` concatenating every `id` (`packages/dev-runtime/src/serve.ts`); `rspfx package` emits `<featureId>/WebPart_<id>.xml` per id + `ClientSideAssets/<bundle>.js` per bundle (`docs/building-packages.md` `feature_<id>.xml`). Verify `unzip -l sharepoint/solution/<name>.sppkg`.

## 8. Favicon and assets

New projects scaffold `assets/favicon.svg` (see §2) served at `/assets/favicon.svg` (`packages/dev-runtime/src/serve.ts`) and linked in local preview (`packages/dev-runtime/src/local-page.ts`). Without it browsers 404 `/favicon.ico` and users think the build is broken — hence the default.

Replace: overwrite `assets/favicon.svg` with any 32×32 SVG, or add `assets/favicon.ico`/`.png` + second `<link>`. Per-webpart images belong in `src/webparts/<name>/assets/` (`packages/templates/src/index.ts:109`), shared branding in `assets/` or `sharepoint/assets/`. Production SharePoint favicon is the site favicon, not `assets/favicon.svg` — `assets/favicon.svg` is dev-only and not packaged (`packages/sppkg-builder/src/sppkg-builder.ts` does not copy `assets/`). To ship an icon in the `.sppkg`, import it from a web part bundle.

Details: `docs/favicon-and-assets.md` + `docs/building-packages.md`.

---

## Official Microsoft-supported toolchain (Heft + webpack)

Use this when official support, library components, Angular, or SPFx < 1.20 / on-premises is required. Slower, webpack-based, React-only, but fully documented and supported by Microsoft.

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
| Speed, modern tooling, any frontend/bundler, web parts + extensions + libraries, Teams/Outlook, multi-webpart, SPFx 1.20–1.23 | **RSPFX** |
| Microsoft support, Angular, older SPFx, on-prem | **Official Heft** (or gulp for ≤1.21.1) |
