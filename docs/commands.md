# Command Reference

Global: `rspfx --version`, `rspfx --help`.

All commands read `config/config.json`, `config/package-solution.json`, `src/*/*.manifest.json`. If a bundler config (`vite.config.ts`, `rsbuild.config.ts`, `rspack.config.ts`) exists it is loaded via `jiti` and the plugin marker is used. If not, the CLI builds it from your manifests and runs Vite or Rspack directly (see [hybrid-dev.md](hybrid-dev.md)). Flags override file options.

Pick your bundler when scaffolding or migrating: `--bundler vite` (default), `rsbuild`, or `rspack`.

> You don't need `@microsoft/sp-*` for most web parts. They are externalized — install only if you import that runtime.

## `rspfx new <name>`

Create a project and install.

| Flag | Description |
|---|---|
| `--component <type>` | `webpart` \| `applicationcustomizer` \| `fieldcustomizer` \| `listviewcommandset` \| `formcustomizer` \| `library` (default `webpart`) |
| `--framework <id>` | `vanilla` \| `react` \| `solid` \| `preact` \| `vue` \| `svelte` (web parts only) |
| `--bundler <id>` | `vite` (default) \| `rsbuild` \| `rspack` |
| `--language <lang>` | `ts` \| `js` (web parts only) |
| `--spfx-version <v>` | see [compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix) |
| `--pm <pm>` | `pnpm` \| `npm` \| `yarn` |
| `--no-install` | Skip install |
| `--yes` | Accept defaults, no prompts |

Also creates `config/config.json` with locales and `teams/` icons for web parts.

```sh
rspfx new my-app
rspfx new my-app --framework vue --bundler vite --yes
rspfx new my-app --framework react --spfx-version 1.20 --no-install
rspfx new my-extension --component applicationcustomizer --yes
```

## `rspfx migrate`

Move an existing Heft/Gulp project to RSPFX. Only command that edits files.

| Flag | Description |
|---|---|
| `--to <version>` | Target `0.1` (default) |
| `--dry-run` | Preview without writing |
| `--bundler <id>` | `vite` (default) \| `rsbuild` \| `rspack` |
| `--revert` | Restore from `.rspfx/migrate-backup.json` |

```sh
rspfx migrate --dry-run
rspfx migrate                    # writes vite.config.ts by default
rspfx migrate --bundler rspack   # writes rspack.config.ts
rspfx migrate --revert
bun install
rspfx dev
```

What it does:

- `package.json` — drops Heft/webpack/gulp deps, adds `rspfx` scripts, adds `@mbsks/rspfx-plugin`.
- `config/config.json` — rewrites `./lib/...WebPart.js` → `./src/...WebPart.ts`, bundle keys to folder names.
- SCSS — rewrites `pkg:` imports for `sass-loader` <16.5.
- Deletes Heft-only files: `config/rig.json`, `config/typescript.json`, `config/sass.json`, `config/deploy-azure-storage.json`, `config/spfx-customize-webpack.js`.
- Writes bundler config + plain `tsconfig.json` if the old one extended a rig.
- Backs up to `.rspfx/migrate-backup.json`.

Commit before migrating so `git diff` shows changes. Same manifests work for both — see [migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx](migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx).

## `rspfx dev`

Dev server on `:4321` (HTTPS in workbench mode, HTTP in local preview).

Rebuilds auto-reload via `/__rspfx_hot.json` → `location.reload()` (`packages/dev-runtime/src/reload.ts:57`). Workbench shows Load debug scripts once per session (`sessionStorage` key `spfx-debug`); same-tab reload keeps it.

Hybrid mode: `rspfx dev` works on official projects without a bundler config — see [hybrid-dev.md](hybrid-dev.md).

| Flag | Description |
|---|---|
| `--refresh` | Fast refresh (state-preserving where supported) |
| `--browser` | Open browser (off by default) |
| `--port <n>` | Override `dev.port` (default 4321) |
| `--mode <local\|sharepoint>` | `local` (default) or `sharepoint` when tenant is set |
| `--tenant <url>` | Tenant URL (else `dev.tenantUrl` or `SPFX_SERVE_TENANT_DOMAIN`) |

Local preview (default, no tenant):

- Preview at `/` — lists every web part/extension, mounts via `/dist/local-runtime.js`.
- Multi-locale: `?locale=fr-fr` (or `?market=`) switches CultureInfo and string modules.
- Mock `/_api` — OData v4 JSON-light (`/_api/web`, `/web/lists`, `/items`, `X-HTTP-Method` for merge/delete, `/contextinfo`). Seed with `local/data.json`.
- HTTP, no cert.

SharePoint mode (tenant set): HTTPS with cert in `~/.rspfx/certs`, `Workbench: https://<tenant>/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=<encoded https://localhost:4321/temp/manifests.js>`. Bundles from `https://localhost:4321/dist/*`.

```sh
rspfx dev
rspfx dev --refresh
rspfx dev --mode sharepoint --tenant https://contoso.sharepoint.com --browser
```

## `rspfx build`

Production compile to `dist/` + `release/` (manifests + assets).

| Flag | Description |
|---|---|
| `--no-minify` | Disable minify |
| `--sourcemap` | Emit hidden source maps |

Bundler config is optional — without it the CLI builds from manifests and runs Vite or Rspack directly.

```sh
rspfx build
rspfx build --no-minify --sourcemap
```

## `rspfx package`

Build + assemble `sharepoint/solution/<name>.sppkg` (from `paths.zippedPackage`).

| Flag | Description |
|---|---|
| `--no-build` | Use existing `release/` |

Auto-includes `teams/` and `sharepoint/Resources*.resx` when present.

```sh
rspfx package
rspfx package --no-build
```

## `rspfx deploy`

Package + upload to the app catalog. Needs `RSPFX_ACCESS_TOKEN` + `RSPFX_APP_CATALOG_URL` (or `config.deploy.appCatalogSiteUrl`). Without a token it prints manual steps. Validates URL, 120s timeout.

```sh
rspfx deploy
RSPFX_ACCESS_TOKEN=<token> RSPFX_APP_CATALOG_URL=https://contoso.sharepoint.com/sites/appcatalog rspfx deploy
```

## `rspfx analyze`

Build + report sizes as console table + `.rspfx/analyze.html`. Module counts work for all bundlers (Vite/Rsbuild via `.rspfx/stats.json`).

## `rspfx doctor`

Checks Node 20+, manifests, framework, sp-* externals, bundles, port, outDir. Exit 1 on fail.

| Flag | Description |
|---|---|
| `--fix` | Fix missing configs/certs then re-validate |

## `rspfx clean`

Removes `dist/`, `release/`, `temp/`, `.rspfx`, `node_modules/.cache`, `sharepoint/solution`. Refuses outside a project.

## Project config as a bundler plugin

Config lives in your bundler file as a plugin from `@mbsks/rspfx-plugin` — but the file is optional.

### Vite — `vite.config.ts` (recommended)

```ts
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.23', dev: { tenantUrl: 'https://contoso.sharepoint.com' } })] };
```

`rspfx build` spawns one `vite build` per entry, inlines CSS (no `.css` files), writes `.rspfx/stats.json`, handles reload. `rspfx dev` spawns `vite` and serves `/temp/manifests.js`. Fast refresh via `rspfx dev --refresh` or `dev.fastRefresh`. Local preview is Rspack-only for now — Vite dev is workbench-only.

### Rsbuild — `rsbuild.config.ts`

```ts
import { defineConfig } from '@rsbuild/core';
import { rspfxRsbuild } from '@mbsks/rspfx-plugin';
export default defineConfig({ plugins: [rspfxRsbuild({ name: 'my-app', framework: 'react' })] });
```

One `rsbuild build` produces all bundles. Fast refresh via `RSPFX_FAST_REFRESH=1`. Local preview is workbench-only.

### Rspack — `rspack.config.ts`

```ts
import { RspfxPlugin, rspfxResolve } from '@mbsks/rspfx-plugin';
export default {
  mode: 'development',
  resolve: rspfxResolve(),
  plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react', spfxVersion: '1.22' })]
};
```

Keep `resolve: rspfxResolve()` — Rspack builds its resolver from the file, not the plugin. `npx rspack build --mode production` for a direct build.

For all three: `npx vite build` / `npx rspack build` / `npx rsbuild build` works standalone, and `rspfx build` gives the same output through the plugin. Without a config file, `rspfx build` / `bun run build` synthesize it — no manual file needed.

### Options

- **Identity:** `name`, `version`, `spfxVersion`, `framework`
- **Dev:** `dev.port` (4321), `dev.https` (true), `dev.hostname` (localhost), `dev.tenantUrl`, `dev.openBrowser` (false), `dev.fastRefresh`, `dev.workbench`/`initialPage`
- **Build:** `build.outDir` (dist), `build.releaseDir` (release), `build.sourcemap`/`minify`/`splitChunks` (deprecated — use native bundler options; `splitChunks` must stay false)
- **Layout:** `paths.srcDir`, `paths.webpartsDir`, `paths.extensionsDir`, `paths.librariesDir`, `paths.configDir`
- **Deploy:** `deploy.appCatalogSiteUrl`

### Environment variables

| Variable | Use |
|---|---|
| `RSPFX_LOG_LEVEL` | `error` \| `warn` \| `info` \| `debug` \| `trace` |
| `RSPFX_LOG_JSON` | `1` → JSON lines |
| `SPFX_SERVE_TENANT_DOMAIN` | Fallback for `dev.tenantUrl` |
| `RSPFX_ACCESS_TOKEN` + `RSPFX_APP_CATALOG_URL` | Token + URL for `rspfx deploy` |
| `RSPFX_NPM_OTP` | OTP for `node scripts/publish.mjs` |
