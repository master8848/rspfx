# Command Reference

Global: `rspfx --version`, `rspfx --help`.

All commands read `config/config.json`, `config/package-solution.json`, `src/*/*.manifest.json`. If a bundler config (`vite.config.ts`, `rsbuild.config.ts`, `rspack.config.ts`) exists it is loaded via `jiti` and the plugin marker is used; otherwise the CLI synthesizes it from manifests. Flags override file options.

Pick bundler at scaffold/migrate: `--bundler vite` (default), `rsbuild`, or `rspack`.

> You don't need `@microsoft/sp-*` for most web parts — they are externalized.

## `rspfx new <name>`

Create a project and initialize git (no dependency install — run your package manager manually). Convenience wrapper — recommended path is bring-your-own scaffold (`npm create vite@latest` + add `@mbsks/rspfx-plugin`).

| Flag | Values |
|---|---|
| `--component <type>` | `webpart` (default), `applicationcustomizer`, `fieldcustomizer`, `listviewcommandset`, `formcustomizer`, `library` |
| `--framework <id>` | `vanilla`, `react`, `solid`, `preact`, `vue`, `svelte` (web parts) |
| `--bundler <id>` | `vite` (default), `rsbuild`, `rspack` |
| `--language <lang>` | `ts`, `js` (web parts) |
| `--spfx-version <v>` | See [compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix) and [Release 1.23](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.23) |
| `--pm <pm>` | `pnpm`, `npm`, `yarn`, `bun` |
| `--no-install` | Kept for compatibility; install never runs automatically |
| `--yes` | Accept defaults, no prompts |

```sh
rspfx new my-app --framework vue --yes
rspfx new my-extension --component applicationcustomizer --yes
```

Prefer `npm create vite@latest my-app -- --template react-ts` (or `better-t-stack`, TanStack Router, etc.) then `npm i -D @mbsks/rspfx-plugin @mbsks/rspfx-cli` and add `rspfxVite()` to `vite.config.ts` — see [getting-started.md#2-create-a-project](getting-started.md#2-create-a-project). `rspfx new` does the same but hides the starter choice. No codebase changes needed for other starters — `packages/plugin/src/vite.ts`/`rsbuild.ts`/`rspack.ts` already support Vite/Rsbuild/Rspack.

## `rspfx migrate`

Migrate Heft/Gulp project. Only command that edits files.

| Flag | Values |
|---|---|
| `--to <version>` | `0.1` (default) |
| `--dry-run` | Preview without writing |
| `--bundler <id>` | `vite` (default), `rsbuild`, `rspack` |
| `--revert` | Restore from `.rspfx/migrate-backup.json` |

```sh
rspfx migrate --dry-run
rspfx migrate --bundler rspack
rspfx migrate --revert
```

Edits `package.json` (drops Heft/webpack/gulp, adds `rspfx` scripts), rewrites `config/config.json` `lib` → `src`, rewrites `pkg:` SCSS imports, deletes Heft-only files, writes bundler config + plain `tsconfig.json`, backs up to `.rspfx/migrate-backup.json`. Commit before migrating.

## `rspfx dev`

Dev server on `:4321`.

| Flag | Values |
|---|---|
| `--refresh` | Fast refresh (state-preserving where supported) |
| `--browser` | Open browser (off by default) |
| `--port <n>` | Override `dev.port` (default `4321`) |
| `--mode <local\|sharepoint>` | `local` (default) or `sharepoint` when tenant set |
| `--tenant <url>` | Tenant URL (else `dev.tenantUrl` or `SPFX_SERVE_TENANT_DOMAIN`) |

Local (default, no tenant): `http://localhost:4321/` — preview at `/` + mock `/_api`, HTTP, no cert. Supports `?locale=fr-fr` and `local/data.json` seeding.

SharePoint (tenant set): `https://localhost:4321` — `/temp/manifests.js`, `/dist/*.js`. Workbench URL printed: `https://<tenant>/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=<encoded https://localhost:4321/temp/manifests.js>`.

Cert is auto-generated in `~/.rspfx/certs` (825-day self-signed) and `rspfx dev` warns if missing/expiring/untrusted; `rspfx doctor` verifies. See [getting-started.md#cert-trust](getting-started.md#cert-trust).

Reload via `/__rspfx_hot.json` poll → `location.reload()`.

```sh
rspfx dev
rspfx dev --refresh
rspfx dev --mode sharepoint --tenant https://contoso.sharepoint.com --browser
```

> Tip: `:4321` is HTTP in local preview, HTTPS in SharePoint mode. If the workbench shows blank or CORS errors, run `rspfx doctor` and trust the cert per the printed instructions.

## `rspfx build`

Compile to `dist/` + `release/`.

| Flag | Values |
|---|---|
| `--no-minify` | Disable minify |
| `--sourcemap` | Emit hidden source maps |

Bundler config optional — without it the CLI synthesizes and runs the bundler directly.

```sh
rspfx build --no-minify --sourcemap
```

## `rspfx package`

Build + assemble `sharepoint/solution/<name>.sppkg` (from `paths.zippedPackage`).

| Flag | Values |
|---|---|
| `--no-build` | Use existing `release/` |

Auto-includes `teams/` and `sharepoint/Resources*.resx` when present.

```sh
rspfx package --no-build
```

## `rspfx deploy`

Package + upload to app catalog. Needs `RSPFX_ACCESS_TOKEN` + `RSPFX_APP_CATALOG_URL`. Without token prints manual steps. Validates URL, 120 s timeout.

```sh
RSPFX_ACCESS_TOKEN=<token> RSPFX_APP_CATALOG_URL=https://contoso.sharepoint.com/sites/appcatalog rspfx deploy
```

## `rspfx analyze`

Build + console table + `.rspfx/analyze.html`. Module counts work for all bundlers (Vite/Rsbuild via `.rspfx/stats.json`).

## `rspfx doctor`

Checks Node 20+, manifests, framework, sp-* externals, bundles, port, outDir, cert (`exists` / `valid >7d` / `key.pem 0600` / `trusted`).

| Flag | Values |
|---|---|
| `--fix` | Fix missing configs/certs then re-validate |

Exit 1 on fail — use in CI.

```sh
rspfx doctor --fix
```

## `rspfx clean`

Removes `dist/`, `release/`, `temp/`, `.rspfx`, `node_modules/.cache`, `sharepoint/solution`. Refuses outside a project.

## Bundler plugin

RSPFX is a plugin for any Vite/Rsbuild/Rspack starter — scaffold with `npm create vite@latest`, `better-t-stack`, TanStack Router, `create-rsbuild`, etc., then add the plugin. Config file is optional (CLI synthesizes from manifests if missing).

Vite `vite.config.ts` — recommended default:

```ts
import { defineConfig } from 'vite';
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default defineConfig({ plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.23' })] });
```

Rsbuild `rsbuild.config.ts`:

```ts
import { defineConfig } from '@rsbuild/core';
import { rspfxRsbuild } from '@mbsks/rspfx-plugin';
export default defineConfig({ plugins: [rspfxRsbuild({ name: 'my-app', framework: 'react' })] });
```

Rspack `rspack.config.ts`:

```ts
import { RspfxPlugin, rspfxResolve } from '@mbsks/rspfx-plugin';
export default { resolve: rspfxResolve(), plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react' })] };
```

For all three, `rspfx build` gives the same output as native `vite build` / `rspack build` / `rsbuild build`. No codebase changes needed for new starters — `packages/plugin/src/vite.ts`, `packages/plugin/src/rsbuild.ts`, `packages/plugin/src/rspack.ts` already cover Vite/Rsbuild/Rspack; routers (TanStack Router etc.) are just dependencies inside the Vite project.

### Options

| Group | Keys |
|---|---|
| Identity | `name`, `version`, `spfxVersion`, `framework` |
| Dev | `dev.port` (4321), `dev.https` (true), `dev.hostname` (localhost), `dev.tenantUrl`, `dev.openBrowser` (false), `dev.fastRefresh`, `dev.workbench`/`initialPage` |
| Build | `build.outDir` (dist), `build.releaseDir` (release), `build.sourcemap`/`minify`/`splitChunks` (deprecated — use bundler options; `splitChunks` must stay false) |
| Layout | `paths.srcDir`, `paths.webpartsDir`, `paths.extensionsDir`, `paths.librariesDir`, `paths.configDir` |
| Deploy | `deploy.appCatalogSiteUrl` |

### Environment variables

Single home for operator env vars. No other `RSPFX_*` vars are implemented.

| Variable | Use |
|---|---|
| `RSPFX_LOG_LEVEL` | `error` \| `warn` \| `info` \| `debug` \| `trace` |
| `RSPFX_LOG_JSON` | `1` → JSON lines |
| `SPFX_SERVE_TENANT_DOMAIN` | Fallback for `dev.tenantUrl` |
| `RSPFX_ACCESS_TOKEN` + `RSPFX_APP_CATALOG_URL` | Token + URL for `rspfx deploy` |
| `RSPFX_NPM_OTP` | OTP for `node scripts/publish.mjs` |
