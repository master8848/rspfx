---
name: rspfx
description: Build SharePoint Framework (SPFx) web parts with RSPFX (community, Vite-powered) or the official Microsoft Heft toolchain. Use for scaffolding (rspfx new), dev server, packaging .sppkg, and choosing toolchains.
---

# RSPFX — Fast SPFx Toolchain

RSPFX builds `sharepoint/solution/*.sppkg` without Heft/webpack/gulp, using `Vite` (default) — covers almost everything. `Rsbuild` only if user insists. `Rspack` only in very niche cases (rarely needed).

Supports SPFx `1.20`, `1.21`, `1.22`, `1.23` (default 1.23, `packages/core/src/versions.ts:13`), Node `20+`, React/Vue/Svelte/Solid/Preact/vanilla, multi-webpart, Teams/Outlook.

> Not Microsoft-supported. Need support/`<1.20`/on-prem → use Heft (bottom). Any other framework works via one-file `FrameworkPreset` — see [docs/custom-framework.md](docs/custom-framework.md).

## Source & inspection (AI-first)

This repo is AI-maintained. Docs/skill can lag — **code is truth**.

- **Repo:** `https://github.com/master8848/rspfx` (`skills/rspfx/SKILL.md`, `docs/*.md`, `ARCHITECTURE.md`).
- **When to read code:** limitation, config not working, bundler behavior — check `packages/plugin/src/vite.ts`, `packages/plugin/src/rsbuild.ts`, `packages/compiler-rspack/*`, `apps/cli/src/*` directly instead of guessing from docs.
- **Version:** `rspfx --version` (or `npx @mbsks/rspfx-cli --version`), `package.json` `version`, `CHANGELOG.md` `## [X.Y.Z]`, git tag `vX.Y.Z`.
- **Clone to inspect (temp):** `git clone https://github.com/master8848/rspfx.git $(mktemp -d)` — AI picks temp per OS (`mktemp -d` / `$TMPDIR` / `$env:TEMP`). No need to keep; inspect and discard.

Skill + `docs/` is enough for all workflows; drill into `docs/` or code only when needed.

## When to use which

| Need | Use |
|---|---|
| Speed, any framework, `1.20`–`1.23` | **RSPFX** |
| Microsoft support, `<1.19`, on-prem | **Heft** |

## Framework support

| Framework | RSPFX | Heft |
|---|---|---|
| React, vanilla | ✓ | ✓ |
| Vue, Svelte, Solid, Preact | ✓ built-in | — |
| Other frameworks | ✓ via one-file `FrameworkPreset` (`docs/custom-framework.md`) | — manual setup |

## Install

```sh
npx @mbsks/rspfx-cli --help
npm i -g @mbsks/rspfx-cli   # optional
rspfx --version; rspfx --help
```

## Existing project — quickest switch

```sh
npx @mbsks/rspfx-cli migrate --dry-run   # preview
npx @mbsks/rspfx-cli migrate              # writes vite.config.ts (default)
pnpm install; pnpm dev; pnpm build
```

Idempotent, touches only `package.json`, `config/config.json`, `tsconfig.json` if rig-based, and removes `config/rig.json` etc. Rewrites `@import 'pkg:…'` SCSS. Flags: `--dry-run`, `--bundler vite|rsbuild|rspack` (default `vite`; `rsbuild` if persist, `rspack` very niche), `--revert` (or `git restore .`).

Manifests stay: `config/package-solution.json`, `src/*/*.manifest.json`. `rspfx dev` synthesizes `config/` so `gulpfile.js` can stay. Native `npx vite build` / `npx rsbuild build` / `npx rspack build` all work after migrate.

Docs: `docs/migrating-from-gulp-heft.md`, `docs/why-not-to-migrate.md`.

Keep both: `gulpfile.js` + `vite.config.ts` on disk, dual scripts `build:heft` / `build:rspfx`. Commit before migrate.

## New project

```sh
rspfx new my-app --yes
rspfx new my-app --framework react --language ts --spfx-version 1.23 --pm pnpm --yes
```

Flags: `--framework vanilla|react|vue|svelte|solid|preact`, `--language ts|js`, `--spfx-version 1.20-1.23`, `--pm pnpm|npm|yarn`, `--component webpart|applicationcustomizer|...|library`, `--no-install`. Layout: `src/webparts/<name>/`, `config/package-solution.json`.

## Develop and build

```sh
pnpm dev -- --tenant https://contoso.sharepoint.com  # SharePoint workbench (HTTPS)
pnpm dev                                              # local http://localhost:4321
rspfx dev --refresh; rspfx dev --mode local
rspfx build; rspfx package; rspfx doctor; rspfx analyze; rspfx clean
```

Local: `http://localhost:4321` no cert. SharePoint: `https://localhost:4321` cert in `~/.rspfx/certs` (tenant via `dev.tenantUrl` in `vite.config.ts` or `--tenant` / `SPFX_SERVE_TENANT_DOMAIN`).

Docs: `docs/getting-started.md`, `docs/commands.md`, `docs/building-packages.md`.

No `@microsoft/sp-*` install needed — `spfxVersion` pins versions, plugin externalizes `sp-*` (`packages/core/src/versions.ts:13`).

## Config — bundler owns it

Default Vite. Only deviate with reason.

```ts
// vite.config.ts (default)
import { defineConfig } from 'vite';
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default defineConfig({ plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.23', dev: { tenantUrl: 'https://contoso.sharepoint.com' } })] });
```

- `rsbuild.config.ts`: `plugins: [rspfxRsbuild({ ... })]` — if user insists on Rsbuild.
- `rspack.config.ts`: `plugins: [new RspfxPlugin({ ... })]` — very niche only.

Options: `name`, `spfxVersion`, `framework`, `language`, `dev.port/tenantUrl/openBrowser/fastRefresh`, `build.outDir/releaseDir`, `paths.*`, `deploy.appCatalogSiteUrl`.

## Styling

Vite is default for all FE work incl. styling. All CSS inlined (`build.cssCodeSplit:false` / `output.injectStyles:true`); never `type:"css"` / `CssExtractRspackPlugin`. `.sppkg` has no external CSS.

- `*.module.css/scss` → CSS Modules `auto: /\.module\.\w+$/i` `asIs` (Vite `scopeBehaviour:'local'`); plain `*.css/scss` → global. Need SCSS: `pnpm add -D sass`.
- Tailwind v4: `pnpm add -D tailwindcss @tailwindcss/postcss postcss`, `postcss.config.mjs` `{plugins:{"@tailwindcss/postcss":{}}}`, `src/app.css` `@import "tailwindcss"`, import in web part. Detected via `postcss.config.*` incl. `.json`.

Refs: `packages/plugin/src/vite.ts:330`, `packages/compiler-rspack/src/config.ts:212`, `packages/compiler-rspack/src/helpers/css.ts:38`, `docs/styling.md`.

## Query lists — prefer PnPjs

```sh
pnpm add @pnp/sp @pnp/graph
```
`onInit`: `spfi().using(SPFx(this.context))` → `sp.web.lists.getByTitle("MyList").items.select("Title").top(10)()` (add `.filter`/`.expand`/`.paged()`/`Caching()`/batch). Fallback `SPHttpClient` only for edge cases. https://pnp.github.io/pnpjs/

## Teams, multi-webpart, assets

One `.sppkg` → Teams/Outlook via `teams/manifest.json` sync. Multi: copy `src/webparts/<name>/` with new `id` in `*.manifest.json` (`docs/multi-webpart.md`). Assets: `assets/` preview, `src/webparts/<name>/assets/` web part. Env: `RSPFX_LOG_LEVEL`, `SPFX_SERVE_TENANT_DOMAIN`, `RSPFX_ACCESS_TOKEN`, `RSPFX_APP_CATALOG_URL`.

## Tips

- `git commit` + `--dry-run` before `migrate`; `rspfx doctor` after.
- Bundler: default Vite; `Rsbuild` only if persist; `Rspack` very niche — almost never needed.
- `pnpm dev` 404 → `config/config.json` bundle key ≠ `src/webparts/<name>` folder.
- Set `dev.tenantUrl` in `vite.config.ts` once.

---

## Official Heft (when required)

```sh
npm i -g @rushstack/heft yo @microsoft/generator-sharepoint
yo @microsoft/sharepoint; heft start --clean; heft build; heft package-solution --production
```

`gulp` for `≤1.21.1`: `gulp serve` / `gulp bundle --ship`. https://learn.microsoft.com/sharepoint/dev/spfx/set-up-your-development-environment
