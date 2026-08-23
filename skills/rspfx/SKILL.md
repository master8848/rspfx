---
name: rspfx
description: Build SharePoint Framework (SPFx) web parts with RSPFX (community, Rspack-powered) or the official Microsoft Heft toolchain. Use for scaffolding (rspfx new), dev server, packaging .sppkg, and choosing toolchains.
---

# RSPFX — Fast SPFx Toolchain

RSPFX is a community replacement for the official SPFx toolchain (Heft + webpack + gulp). It builds the same `.sppkg` packages but is faster and more flexible.

- **Fast** — Rust-based Rspack, much quicker than webpack.
- **Any frontend** — React, Vue, Svelte, Solid, Preact, or vanilla. Official SPFx is React-only.
- **Any bundler** — Rspack (default), Vite, or Rsbuild. One config file.
- **Same output** — web parts, extensions, and libraries that run in SharePoint and Teams.

> **Not supported by Microsoft.** Microsoft only supports the Heft toolchain (see bottom of this file). Use RSPFX when you want speed and flexibility. Use Heft when you need official support.

Supports SPFx 1.20–1.23, Node 20+, multiple web parts per package, Teams/Outlook install, and multiple languages.

## Install

```sh
npm i -g @mbsks/rspfx-cli@0.0.11
rspfx --version
rspfx --help
```

All `@mbsks/rspfx-*` packages share the same version. Upgrade with `npm i -g @mbsks/rspfx-cli@latest`.

## Create a project

```sh
rspfx new my-app              # interactive prompts
rspfx new my-app --yes        # accept defaults
```

Common options:

- `--framework vanilla | react | vue | svelte | solid | preact`
- `--language ts | js`
- `--spfx-version 1.20 | 1.21 | 1.22 | 1.23` (default 1.23)
- `--pm pnpm | npm | yarn`
- `--component webpart | applicationcustomizer | fieldcustomizer | listviewcommandset | formcustomizer | library`
- `--no-install` — skip installing dependencies

Example (no prompts):

```sh
rspfx new my-app --framework react --language ts --spfx-version 1.22 --pm pnpm --yes
```

Docs: `docs/getting-started.md`, `docs/compatibility.md`

## Develop

```sh
rspfx dev                                      # local preview at http://localhost:4321
rspfx dev --tenant https://contoso.sharepoint.com  # SharePoint workbench (HTTPS)
rspfx dev --refresh                            # keep state on reload
rspfx dev --mode local                         # force local preview
```

- **Local preview** (default, no tenant) — plain HTTP, no certificate needed. Shows all web parts and extensions. Add `?locale=fr-fr` to preview another language.
- **SharePoint mode** (when a tenant is set) — HTTPS on `https://localhost:4321`. Needs a self-signed cert in `~/.rspfx/certs`. The CLI prints how to trust it.
- Set your tenant via `dev.tenantUrl` in config, `SPFX_SERVE_TENANT_DOMAIN` env var, or `--tenant` flag.

## Build, package, deploy

```sh
rspfx build     # production bundles to dist/ + release/
rspfx package   # build + create sharepoint/solution/<name>.sppkg
rspfx deploy    # upload to app catalog (needs RSPFX_ACCESS_TOKEN + RSPFX_APP_CATALOG_URL)
rspfx doctor    # check setup — run this first if something breaks
rspfx analyze   # bundle size report
rspfx clean     # remove build output
```

To install manually: upload the `.sppkg` to your app catalog → Deploy → add it to a site.

Docs: `docs/commands.md`, `docs/building-packages.md`, `docs/deployment.md`

## Config

Your project config lives inside your bundler config. The CLI finds it automatically.

**Rspack** (`rspack.config.ts`, default):

```ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';
export default {
  plugins: [new RspfxPlugin({
    name: 'my-app', framework: 'react', spfxVersion: '1.22',
    dev: { tenantUrl: 'https://contoso.sharepoint.com' }
  })]
};
```

**Vite** (`vite.config.ts`): `plugins: [rspfxVite({ ... })]`
**Rsbuild** (`rsbuild.config.ts`): `plugins: [rspfxRsbuild({ ... })]`

To migrate an existing project: `node scripts/migrate-to-rspfx.mjs .`

Docs: `docs/commands.md#project-config-as-a-bundler-plugin`

## Teams and Outlook

One `.sppkg` can also install as a Teams/Outlook app.

1. `rspfx package` — includes `teams/manifest.json` automatically.
2. Upload `.sppkg` to app catalog → Deploy → **Sync to Teams**.
3. Find it in Teams → Apps → Built for your org. It appears in new Outlook after a short delay (10–120 min).

Docs: `docs/teams-outlook-install.md`

## More

- **Multiple web parts in one package** — copy `src/webparts/<name>/` to a new folder, give it a new `id` and name. See `docs/multi-webpart.md`.
- **Assets** — put shared files in `assets/` (e.g. `assets/favicon.svg` for local preview). Web part images go in `src/webparts/<name>/assets/`.
- **Environment variables** — `RSPFX_LOG_LEVEL`, `SPFX_SERVE_TENANT_DOMAIN`, `RSPFX_ACCESS_TOKEN`, `RSPFX_APP_CATALOG_URL`. See `docs/commands.md#environment-variables`.

---

## Official Microsoft toolchain (Heft)

Use this when you need Microsoft support, Angular, or SPFx < 1.20.

```sh
npm install @rushstack/heft yo @microsoft/generator-sharepoint --global
yo @microsoft/sharepoint
cd my-app && npm install
heft trust-dev-cert
heft start --clean          # dev server
heft build                  # build
heft package-solution --production  # → .sppkg
```

For SPFx ≤ 1.21.1 the older `gulp` toolchain is used (`gulp serve`, `gulp bundle --ship`). Microsoft docs: https://learn.microsoft.com/sharepoint/dev/spfx/set-up-your-development-environment

| Need | Use |
|---|---|
| Speed, any frontend/bundler, Teams/Outlook, multi-webpart, SPFx 1.20–1.23 | **RSPFX** |
| Microsoft support, Angular, older SPFx, on-prem | **Official Heft** |
