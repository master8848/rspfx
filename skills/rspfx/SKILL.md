---
name: rspfx
description: Build SharePoint Framework (SPFx) web parts with RSPFX (community, Rspack-powered) or the official Microsoft Heft toolchain. Use for scaffolding (rspfx new), dev server, packaging .sppkg, and choosing toolchains.
---

# RSPFX — Fast SPFx Toolchain

RSPFX builds the same `sharepoint/solution/*.sppkg` as the official toolchain, using `Rspack` (default), `Vite`, or `Rsbuild` via `@mbsks/rspfx-plugin`.

Supports SPFx `1.20`–`1.23` (default 1.23, `packages/core/src/versions.ts:13`), Node `20+`, React/Vue/Svelte/Solid/Preact/vanilla, multiple web parts per package, and Teams/Outlook install.

> Not supported by Microsoft. Use Heft when you need official support. See bottom of this file.

## When to use which

| Need | Use |
|---|---|
| Speed, any framework/bundler, fast dev, `1.20`–`1.23` | **RSPFX** |
| Microsoft support, Angular, `1.19` or older, on-prem | **Official Heft** |

## Framework support

| Framework | RSPFX | Official Heft |
|---|---|---|
| React, vanilla JS | ✓ | ✓ |
| Vue, Svelte, Solid, Preact | ✓ | — |

Need Vue/Svelte/Solid/Preact → use RSPFX; need Angular or Microsoft support → stay on Heft.

## Install

```sh
npx @mbsks/rspfx-cli --help        # no install needed
npm i -g @mbsks/rspfx-cli          # or global
rspfx --version
rspfx --help
```

Use `npx` if you already use `pnpm`/`npm` locally; global is optional.

## Existing project — quickest switch

```sh
npx @mbsks/rspfx-cli migrate --dry-run   # preview changes
npx @mbsks/rspfx-cli migrate              # apply: writes rspack.config.ts, updates package.json + config/config.json
pnpm install
pnpm dev                                  # local preview at http://localhost:4321
pnpm build                                # production to dist/ + release/
```

`rspfx migrate` is idempotent and never touches `src/` beyond the two documented rewrites.

What it does: drops Heft/gulp/webpack devDependencies, adds `@mbsks/rspfx-plugin` and `rspfx` scripts to `package.json`, rewrites `config/config.json` entrypoints from `./lib/` to `./src/`, renames bundle keys to match `src/webparts/<name>` folders, rewrites `@import 'pkg:…'` SCSS imports, removes Heft-only files (`config/rig.json`, `config/typescript.json`, `config/sass.json`, `config/deploy-azure-storage.json`), writes `rspack.config.ts` with `RspfxPlugin` and a plain `tsconfig.json` if the old one extends a rig.

Flags:

| Flag | Effect |
|---|---|
| `--dry-run` | Print planned edits, change nothing |
| `--bundler rspack\|vite\|rsbuild` | Scaffold `rspack.config.ts`, `vite.config.ts`, or `rsbuild.config.ts` |
| `--revert` | Undo the last `migrate` (or `git restore .` if committed) |

Same manifests: `config/package-solution.json` and `src/*/*.manifest.json` (`src/webparts/<name>/*.manifest.json`, `src/extensions/*/*.manifest.json`, `src/libraries/*/*.manifest.json`) stay untouched.

Switching is just the build command: `pnpm build` / `rspfx build` runs RSPFX, `heft build` / `gulp bundle --ship` still runs Heft on the same checkout until you commit the migration.

Revert: `rspfx migrate --revert` or `git restore . && git clean -fd` if you committed before migrating.

No extra `@microsoft/sp-*` installs: keep the `sp-*` versions you already have (pinned to your `spfxVersion`); RSPFX externalizes them from `node_modules` and emits `"type": "component"` entries so SharePoint resolves its own copies.

After migrate, native commands work too: `npx rspack build --mode production`, `npx vite build`, `npx rsbuild build` all produce the same output as `rspfx build` / `pnpm build`.

Docs: `docs/migrating-from-gulp-heft.md`, `docs/migration-case-study.md`, `docs/why-not-to-migrate.md`.

## Keep both toolchains (interchangeable)

Same manifests: `config/config.json`, `config/package-solution.json`, `src/*/*.manifest.json` stay untouched, so both toolchains produce the same `sharepoint/solution/*.sppkg`.
`rspfx dev` synthesizes `config/` at runtime, so Heft files (`gulpfile.js`, `config/rig.json`, `config/typescript.json`) can stay on disk.
Keep dual scripts in `package.json` and choose per command: `pnpm build:heft` → `heft build`, `pnpm build:rspfx` → `rspfx build` (or `pnpm build` vs `heft build`).
`rspfx migrate` adds `rspack.config.ts` alongside `gulpfile.js`; revert with `rspfx migrate --revert` or `git restore .`.
Tip: `git commit` before `migrate`, keep both configs on separate branches if teams mix toolchains.

Example `package.json` scripts:

```json
{ "scripts": { "build:heft": "heft build && heft package-solution --production", "build:rspfx": "rspfx package", "dev:heft": "heft start --clean", "dev:rspfx": "rspfx dev" } }
```

Files on disk when keeping both: `gulpfile.js` + `rspack.config.ts`, `config/config.json` + `config/rig.json`.

## New project

```sh
rspfx new my-app                  # interactive
rspfx new my-app --yes            # defaults
rspfx new my-app --framework react --language ts --spfx-version 1.23 --pm pnpm --yes
```

Common flags: `--framework vanilla|react|vue|svelte|solid|preact`, `--language ts|js`, `--spfx-version 1.20|1.21|1.22|1.23`, `--pm pnpm|npm|yarn`, `--component webpart|applicationcustomizer|fieldcustomizer|listviewcommandset|formcustomizer|library`, `--no-install`, `--yes`.

Project layout is the standard SPFx layout: `src/webparts/<name>/`, `config/package-solution.json`, `config/serve.json`, `config/write-manifests.json`, `sharepoint/assets/`.

## Develop and build

`pnpm dev` and `rspfx dev` are the same after migration; `pnpm build` and `rspfx build` are the same.

```sh
pnpm dev                                          # local preview (HTTP, no tenant)
pnpm dev -- --tenant https://contoso.sharepoint.com  # SharePoint workbench (HTTPS)
rspfx dev --refresh                               # state-preserving fast refresh
rspfx dev --mode local                            # force local preview
rspfx build                                       # production bundles
rspfx package                                     # build + sharepoint/solution/*.sppkg
rspfx doctor                                      # checks setup — run first if something breaks
rspfx analyze                                     # bundle size to .rspfx/analyze.html
rspfx clean                                       # remove dist/ release/ temp/ .rspfx/
```

Local preview (default, no tenant): `http://localhost:4321` at `/`, no cert needed, add `?locale=fr-fr` to preview another language.

SharePoint mode (tenant set via `dev.tenantUrl` in `rspack.config.ts`, `SPFX_SERVE_TENANT_DOMAIN`, or `--tenant`): `https://localhost:4321` with a self-signed cert in `~/.rspfx/certs` that the CLI prints how to trust.

Manual install: upload `sharepoint/solution/*.sppkg` to the app catalog → Deploy → Add to a site.

Docs: `docs/getting-started.md`, `docs/commands.md`, `docs/building-packages.md`, `docs/deployment.md`.

## You do not need to install `@microsoft/sp-*` manually

Keep the `@microsoft/sp-*` versions your project already pins for the chosen `spfxVersion` in `packages/core/src/versions.ts:13`.

`@mbsks/rspfx-plugin` (`RspfxPlugin` / `rspfxVite` / `rspfxRsbuild`) externalizes `sp-*` automatically; the loader config and `manifests.js` reference SharePoint's built-in copies, so nothing extra is installed for externals.

## Config — bundler owns it

The CLI finds the plugin by its marker in your bundler config; no extra config file needed.

Rspack (`rspack.config.ts`, default):

```ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';
export default { plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react', spfxVersion: '1.23', dev: { tenantUrl: 'https://contoso.sharepoint.com' } })] };
```

Vite (`vite.config.ts`): `plugins: [rspfxVite({ ... })]`.

Rsbuild (`rsbuild.config.ts`): `plugins: [rspfxRsbuild({ ... })]`.

Options: `name`, `spfxVersion`, `framework`, `language`, `dev.port`/`tenantUrl`/`openBrowser`/`fastRefresh`, `build.outDir`/`releaseDir`, `paths.srcDir`/`webpartsDir`/`configDir`, `deploy.appCatalogSiteUrl` (`apps/cli/src/commands/deploy.ts:16`, `docs/commands.md#environment-variables`).

## Styling — CSS Modules, global CSS, Tailwind

Vite (`vite.config.ts` with `rspfxVite` from `@mbsks/rspfx-plugin` `packages/plugin/src/vite.ts:340`) is the recommended bundler for styling; Rsbuild and Rspack also work (see `docs/styling.md`). All CSS is inlined into the JS bundle (`style-loader` / `output.injectStyles: true` / `build.cssCodeSplit: false`); never use `type: "css"` or `CssExtractRspackPlugin` — the `.sppkg` has no external CSS.

SCSS/CSS Modules (auto): `*.module.css` and `*.module.scss` hash class names via `css-loader` `modules: { auto: true }` (`packages/compiler-rspack/src/config.ts:183`). Plain `*.css`/`*.scss` stays global. Install `sass` (`pnpm add -D sass`) for SCSS.

Vite — CSS Modules (recommended):

```ts
// src/webparts/hello/components/Hello.module.scss
.hello { color: #0078d4; }
```
```ts
// src/webparts/hello/components/Hello.tsx
import styles from './Hello.module.scss';
export const Hello = () => <div className={styles.hello}>Hello</div>;
```

Vite — global CSS (including Tailwind entry):

```ts
// src/app.css
@import "tailwindcss";
```
```ts
import './app.css';
```

Vite — Tailwind v4 via `postcss.config.mjs` (no custom patch):

```js
// postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } };
```

Install `pnpm add -D tailwindcss @tailwindcss/postcss postcss`, add `postcss.config.mjs` above, add `src/app.css` with `@import "tailwindcss"`, and import `src/app.css` from the web part. Rsbuild uses `tools.postcss` `postcssOptions.plugins` + `output.injectStyles: true` (`packages/plugin/src/rsbuild.ts:319`); Rspack uses `module.rules` with `style-loader` + `css-loader` `modules: { auto: true }` + `sass-loader` `api: "modern"` (`packages/compiler-rspack/src/config.ts:183`).

CSS inlining is the default (`packages/compiler-rspack/src/config.ts:182` `styleLoaderPath`, `packages/plugin/src/vite.ts:340` `cssCodeSplit: false`). Disable only with `build.css: false` in `rspfxVite`/`rspfxRsbuild`/`RspfxPlugin` options, then provide your own rules and keep inlining. Helpers `rspfxCssInlineRule()`/`rspfxSassRule()` from `@mbsks/rspfx-plugin` return the shared inline rules; PostCSS is file-based (`postcss.config.js|.cjs|.mjs` detection) — never add `TailwindPostCSSPatch`. Full reference: `docs/styling.md`.

## Query SharePoint lists — prefer PnPjs

Use `@pnp/sp` (PnPjs) over raw `fetch`/`SPHttpClient` for `select`/`filter`/`expand`/`batch`/`paging`/`caching`; it handles digest, OData, and batching.
Install: `pnpm add @pnp/sp @pnp/graph @pnp/nodejs` (`@pnp/nodejs` only needed for Node scripts).
Init in `src/webparts/<name>/<Name>WebPart.ts:onInit()`: `import { spfi } from "@pnp/sp"; import { SPFx } from "@pnp/sp"; const sp = spfi().using(SPFx(this.context));`
Query: `await sp.web.lists.getByTitle("MyList").items.select("Title").top(10)()` — add `.filter("Title eq 'A'").expand("Author")`, `.paged()`, `.using(Caching())`, or `sp.createBatch()` for batches.
Fallback: `this.context.spHttpClient.get(url, SPHttpClient.configurations.v1)` only for edge cases PnPjs doesn't cover.
Docs: https://pnp.github.io/pnpjs/

## Teams, multi-webpart, assets

One `.sppkg` can sync to Teams/Outlook: `rspfx package` includes `teams/manifest.json`, then Deploy → Sync to Teams in the catalog.

Multiple web parts: copy `src/webparts/<name>/` to a new folder with a new `id` in its `*.manifest.json` (`docs/multi-webpart.md`).

Assets: `assets/` for local preview (e.g. `assets/favicon.svg`), `src/webparts/<name>/assets/` for web part images.

Env vars: `RSPFX_LOG_LEVEL`, `SPFX_SERVE_TENANT_DOMAIN`, `RSPFX_ACCESS_TOKEN`, `RSPFX_APP_CATALOG_URL` (`docs/commands.md#environment-variables`).

## Tips

- Commit or back up before `rspfx migrate`; run with `--dry-run` first.
- Run `rspfx doctor` after migrate and before `pnpm dev` — it checks Node `20+`, config load, port `4321`, and `sp-*` version alignment.
- Use `Vite` (`--bundler vite`) for the fastest dev loop; use `Rspack` for the closest prod parity.
- If `pnpm dev` 404s a bundle, the `config/config.json` bundle key does not match the `src/webparts/<name>` folder — rename the key or set `paths.webpartsDir`.
- Set `dev.tenantUrl` once in `rspack.config.ts` instead of passing `--tenant` each time.

---

## Official Microsoft toolchain (Heft)

Use when you need Microsoft support, Angular, or SPFx `< 1.20`.

```sh
npm install @rushstack/heft yo @microsoft/generator-sharepoint --global
yo @microsoft/sharepoint
heft trust-dev-cert
heft start --clean
heft build
heft package-solution --production
```

For `1.21.1` and older the toolchain is `gulp` (`gulp serve`, `gulp bundle --ship`, `gulp package-solution --ship`). Microsoft docs: https://learn.microsoft.com/sharepoint/dev/spfx/set-up-your-development-environment
