# Command Reference

Global: `rspfx --version`, `rspfx --help`.

All commands load the project's bundler config (`rspack.config.ts` via jiti, `vite.config.ts` for Vite projects, or `rsbuild.config.ts` for Rsbuild projects), find the `RspfxPlugin` / `rspfxVite` / `rspfxRsbuild` plugin by its marker symbol, and use its options, merging CLI flags over them.

The optional `paths` section of the plugin options customizes the project folder layout: `paths.srcDir` (default `src`), `paths.webpartsDir` (default `src/webparts`), `paths.configDir` (default `config`) — see [building-packages.md](building-packages.md) for what each one controls.

If no config or no plugin is found the CLI errors with guidance.

## `rspfx new <name>`

Scaffold a new SPFx project (web part or extension) and install dependencies.

| Flag | Description |
|---|---|
| `--component <type>` | `webpart` \| `applicationcustomizer` \| `fieldcustomizer` \| `listviewcommandset` \| `formcustomizer` \| `library` (default `webpart`). Extensions and libraries scaffold as vanilla TypeScript only — `--framework` / `--language` / `--fluent` are rejected for them |
| `--framework <id>` | `vanilla` \| `react` \| `solid` \| `preact` \| `vue` \| `svelte` (web parts only) |
| `--language <lang>` | `ts` (typescript) \| `js` (javascript) (web parts only) |
| `--fluent` | Enable the Fluent UI adapter (React only) |
| `--spfx-version <v>` | see [docs/compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix) and `packages/core/src/versions.ts:13` |
| `--pm <pm>` | `pnpm` \| `npm` \| `yarn` (dependency install) |
| `--no-install` | Skip dependency installation |
| `--yes` | Accept all defaults; non-interactive |

Web part scaffolds also generate a `config/config.json` with localized resources
(`en-us`/`fr-fr` locale modules under `src/webparts/<name>/loc/`) and a `teams/`
folder with the Teams app manifest plus the 192x192/32x32 PNG icons.

```sh
rspfx new my-app
rspfx new my-app --framework vue --yes
rspfx new my-app --framework react --fluent --spfx-version 1.20 --no-install
rspfx new my-extension --component applicationcustomizer --yes
rspfx new my-commands --component listviewcommandset --no-install
```

## `rspfx dev`

Start the dev environment: Rspack dev server + manifest server on `:4321` (HTTPS with a self-signed cert in workbench mode; plain HTTP in local preview mode).

Dev output is unminified with readable module names and source maps; rebuilds auto-reload the page (client embedded in `/temp/manifests.js` via `window.location.reload()` in `packages/dev-runtime/src/reload.ts:57`).

SharePoint workbench shows Load debug scripts once per browser session (`sessionStorage` key `spfx-debug` on the workbench origin); rebuilds reload the same tab so the dialog does not reappear — see [getting-started.md#load-debug-scripts-dialog](getting-started.md#load-debug-scripts-dialog) for cert trust, Chrome 142+ Local Network Access, `?reset=true` reset, and the stable `debugManifestsFile` URL (`packages/dev-runtime/src/serve.ts:121`).

Officially scaffolded SPFx projects (gulp/Heft, no rspfx config) run in hybrid mode: `rspfx dev` synthesizes its config from `config/config.json`, `config/serve.json`, and `package.json` — see [hybrid-dev.md](hybrid-dev.md).

| Flag | Description |
|---|---|
| `--refresh` | Enable fast refresh (state-preserving where supported); on Vite/Rsbuild projects the flag (or `dev.fastRefresh`) sets `RSPFX_FAST_REFRESH=1` for the spawned dev process |
| `--browser` | Open the local preview or workbench in a browser (off by default) |
| `--port <n>` | Override `dev.port` (default 4321) |
| `--mode <local\|sharepoint>` | Serve mode — default `local`, or `sharepoint` when a tenant is configured (`--tenant` / `dev.tenantUrl` / `SPFX_SERVE_TENANT_DOMAIN`) |
| `--tenant <url>` | Tenant URL or domain (else `dev.tenantUrl` or `SPFX_SERVE_TENANT_DOMAIN`) |

### Local preview mode (default)

With no tenant configured, `rspfx dev` serves a **local preview page at `/`** —
no SharePoint tenant needed:

- The page lists every discovered web part and extension (injected into `window.__RSPFX_COMPONENTS__`) and loads the `/dist/local-runtime.js` bootstrap, which mounts each component with an emulated SPFx context.
  - ApplicationCustomizer: working placeholder provider (Top/Bottom).
  - FieldCustomizer: sample 3-row list via `onRenderCell`.
  - ListViewCommandSet: command toolbar via `onListViewUpdated`/`onExecute`.
- **Multi-locale**: append `?locale=fr-fr` (alias `?market=`) to the preview
  URL to switch the emulated CultureInfo (LCID, RTL flag, language name) and
  load the matching `dist/<name>_<locale>.js` string modules, falling back to
  `en-us` when the exact locale file is missing.
- File saves trigger a rebuild followed by an automatic `location.reload()` in the same tab (the reload client in `packages/dev-runtime/src/reload.ts:57` polls `/__rspfx_hot.json`).
- Served over HTTP — no self-signed cert required.

A mock SharePoint REST API is served at `/_api` (OData v4 JSON-light: flat
objects, collections as `{ value: [...] }`, no `d:` envelopes):

- `GET /_api/web`, `/site`, `/web/currentuser`, `/web/lists`, `/web/siteusers`
- `GET /_api/web/lists(guid'…')` and `/web/lists/getbytitle('…')`
- `GET` / `POST` `/_api/web/lists/getbytitle('…')/items` (collection with
  `$top`/`$orderby`/`$select`, create)
- `GET` / `MERGE` / `PUT` / `DELETE` `/_api/web/lists/getbytitle('…')/items(<id>)` — mutations via the `X-HTTP-Method` override header.
- `POST /_api/contextinfo` returns `{ GetContextWebInformation: { FormDigestValue } }`.
- Missing lists/items return 404; anything unsupported returns 400 with a clear
  `{ error: { code, message } }` envelope

Seed the mock data with a `local/data.json` file in the project root
(`{ lists: [...], currentUser: {...} }` overrides the defaults).

```sh
rspfx dev
rspfx dev --refresh
rspfx dev --mode local
rspfx dev --mode sharepoint --tenant https://contoso.sharepoint.com --browser
```

## `rspfx build`

Production compile: bundles to `build.outDir` (`dist`), component manifests and
assets to `build.releaseDir` (`release`). On an official SPFx project this
command refuses with `OFFICIAL_TOOLCHAIN_BUILD` — see
[hybrid-dev.md](hybrid-dev.md).

| Flag | Description |
|---|---|
| `--no-minify` | Disable minification (`build.minify` default true) |
| `--sourcemap` | Emit hidden source maps (`build.sourcemap` default false) |

```sh
rspfx build
rspfx build --no-minify --sourcemap
```

`rspfx build` loads the framework preset (`loadFrameworkPreset`) and resolves
its loader/babel entries from the framework package's own `node_modules`
(`resolveContributionLoaders`), passing the contributions to the compiler as
`swcContributions` — production builds apply the same framework compiler
configuration as `rspfx dev`.

## `rspfx package`

Build + assemble the solution package to `sharepoint/solution/<name>.sppkg`
(from `config/package-solution.json` → `paths.zippedPackage`).

| Flag | Description |
|---|---|
| `--no-build` | Skip the build step; package existing `release/` output |

```sh
rspfx package
rspfx package --no-build
```

The command auto-detects optional inputs when present:

- **`teams/`** (Teams app `manifest.json` + icons) — included under
  `ClientSideAssets/` in the package.
- **`sharepoint/Resources*.resx`** — embedded at the package root and used to
  resolve `"$Resources:KeyName"` values in
  `metadata.shortDescription`/`longDescription` of `package-solution.json`
  into localized `<LocalizedString CultureName="...">` entries (`Resources.resx` → `CultureName="default"`, each `Resources.<lang>.resx` → its `CultureName`).

## `rspfx deploy`

Package + upload the `.sppkg` to the app catalog via REST, authenticated with a
bearer access token. The app catalog URL comes from
`config.deploy.appCatalogSiteUrl` or the `RSPFX_APP_CATALOG_URL` env var
(interactively prompted otherwise); the token from `RSPFX_ACCESS_TOKEN`.
**Without a token it prints the manual upload steps instead.** The catalog URL
is validated before upload and the upload fails fast after a 120s timeout.

```sh
rspfx deploy
RSPFX_ACCESS_TOKEN=<token> RSPFX_APP_CATALOG_URL=https://contoso.sharepoint.com/sites/appcatalog rspfx deploy
```

## `rspfx analyze`

Build + bundle report: sizes and chunk list as a console table plus
`.rspfx/analyze.html`. Module counts come from the bundler stats (Rspack) or,
when the bundler emits no webpack-style stats (Vite/Rsbuild), from the
`.rspfx/stats.json` the plugins write during the build — the modules column is
populated for all bundlers.

```sh
rspfx analyze
```

## `rspfx doctor`

Environment/config/port/dependency checks: Node ≥ 20, the bundler config loads
and exposes the rspfx plugin, framework package resolvable, sp-* versions match the target, web part bundles
discovered, the configured dev port (`dev.port`) free, `build.outDir` writable.
Exit code **1** on failures.

```sh
rspfx doctor
```

## `rspfx clean`

Remove build artifacts: `build.outDir` (`dist`), `build.releaseDir`
(`release`), `temp`, `.rspfx`, `node_modules/.cache`, `sharepoint/solution`.
Refuses to run outside a project and respects the configured output dirs.

```sh
rspfx clean
```

## Project config as a bundler plugin

The project config lives in your bundler config as a plugin instance from
`@mbsks/rspfx-plugin`. The CLI finds it by its marker symbol
(`RSPFX_PLUGIN_MARKER`) and uses its options.

### Rspack (default) — `rspack.config.ts`

```ts
import { RspfxPlugin, rspfxResolve } from '@mbsks/rspfx-plugin';

export default {
  mode: 'development',
  resolve: rspfxResolve(),
  plugins: [
    new RspfxPlugin({
      name: 'my-app',
      framework: 'react',
      spfxVersion: '1.22',
      dev: { port: 4321, https: true, hostname: 'localhost', tenantUrl: 'https://contoso.sharepoint.com', openBrowser: false },
      build: { minify: true, sourcemap: false, outDir: 'dist', releaseDir: 'release' },
      version: '1.0.0'
    })
  ]
};
```

`RspfxPlugin` implements the standard webpack plugin interface
(`apply(compiler)`), so it can also be tested under webpack-compatible bundlers
(e.g. Rspack) for the compile-time parts; the full pipeline (manifests, dev
server, packaging) runs through the rspfx CLI.

### Running the bundler directly (native commands)

The bundler commands work standalone — no rspfx CLI needed:

- `npx vite build` — builds every web part bundle (one vite build per entry,
  since Rollup cannot give each entry its own `define('id', …)` in a single
  config) and assembles the release output (`release/manifests` +
  `release/assets`).
- `npx rspack build` — the scaffolded `rspack.config.ts` is fully
  self-sufficient: `rspfxResolve()` provides the standard resolve block
  (TypeScript/JSX/SCSS extensions, `.js → .ts` extension alias, build-time stub
  aliases and localized-resource aliases), `RspfxPlugin` composes entries,
  externals, AMD output, framework loader contributions and swc/SCSS rules at
  compile time, and assembles the release output after a production compile.
  Note rspack's resolver factory is built from the config file at
  compiler-creation time, so plugin-injected resolve options are not picked up —
  keep the `resolve: rspfxResolve()` line. Use `--mode production` for a
  production build (`rspfx build` always builds production).
- `npx rsbuild build` — the rsbuild plugin configures entries/externals/output
  via `modifyRspackConfig` and assembles the release output after the build.

`rspfx build` / `rspfx package` use the same pipeline through the plugins:
`rspfx build` spawns the project's bundler once and the plugin assembles the
release, so native and CLI builds produce identical output.

### Vite — `vite.config.ts`

```ts
import { rspfxVite } from '@mbsks/rspfx-plugin';

export default {
  plugins: [rspfxVite({ name: 'my-app', framework: 'react', dev: { ... }, build: { ... }, version: '1.0.0' })]
};
```

`rspfx build` / `rspfx package` spawn one `vite build`; the plugin builds
every web part bundle (one vite build per entry via `closeBundle`) and
assembles the release output. `rspfx dev` spawns `vite` (the plugin serves
`/temp/manifests.js`, rebuilds AMD bundles into `dist/`, opens the workbench
when a tenant is configured). The plugin loads the framework preset's `vite()`
contributions, prepends the same script-URL capture line as the Rspack path,
inlines CSS into the JS bundle (no `.css` files in `dist/`), ticks the reload
controller after rebuilds (`?t=`
cache-busting), and writes `.rspfx/stats.json` module counts for
`rspfx analyze`. Fast refresh is enabled with `rspfx dev --refresh` or
`dev.fastRefresh` (passed to the dev process as `RSPFX_FAST_REFRESH=1`). The
local preview page and mock `/_api` API are served by dev-runtime's
`startServe`, which the CLI runs on the Rspack path — the Vite dev flow is
workbench-only for now.

### Rsbuild — `rsbuild.config.ts`

```ts
import { defineConfig } from '@rsbuild/core';
import { rspfxRsbuild } from '@mbsks/rspfx-plugin';

export default defineConfig({
  plugins: [rspfxRsbuild({ name: 'my-app', framework: 'react', dev: { ... }, build: { ... }, version: '1.0.0' })]
});
```

The plugin injects the SPFx pipeline into Rsbuild's underlying Rspack config:
web part entries (AMD library names `<componentId>_<version>`), sp-*
externals + localized resources, the `webpackJsonp_<uniqueName>`
`chunkLoadingGlobal`, the public-path capture and localized-resource plugins,
and the `DEBUG`/`NODE_ENV` defines; HTML output is disabled (SPFx ships raw
JS bundles). The framework preset is merged in `modifyRspackConfig`
(`rsbuild()` contributions — babel-based react/preact refresh,
vue/svelte/solid reuse the rspack loader rules; no swc — Rsbuild owns SWC),
with fast refresh gated on dev + `RSPFX_FAST_REFRESH`/`dev.fastRefresh`, and
`.rspfx/stats.json` module counts are written via `onAfterBuild` for
`rspfx analyze`. `rspfx build` / `rspfx package` run a single `rsbuild build`
(one build produces all web part bundles in `dist/`, and the plugin assembles
the release output via `onAfterBuild`); `rspfx dev` spawns
`rsbuild dev` and prints the workbench URL when a tenant is configured. The
local preview (`--mode local`) is served by dev-runtime's Rspack `startServe`
path — the Rsbuild dev flow is workbench-only for now.

### Options

The `RspfxPlugin` options carry your project settings:

- **Identity:** `name`, `version` (used in AMD ids and manifests), `spfxVersion`, `framework`, `fluent`, `language`
- **Dev:** `dev.port` (4321), `dev.https` (true), `dev.hostname` (localhost), `dev.tenantUrl`, `dev.openBrowser` (false, opens workbench once via `packages/dev-runtime/src/browser.ts:3`; reloads stay in same tab per `packages/dev-runtime/src/reload.ts:57`), `dev.fastRefresh`, `dev.workbench`/`initialPage`
- **Build:** `build.minify` (true), `build.sourcemap` (false), `build.outDir` (dist), `build.releaseDir` (release)
- **Layout:** `paths.srcDir`, `paths.webpartsDir` (src/webparts), `paths.extensionsDir` (src/extensions), `paths.librariesDir` (src/libraries), `paths.configDir` (config)
- **Deploy:** `deploy.appCatalogSiteUrl` (or env var)

### Environment variables

| Variable | What it does |
|---|---|
| `RSPFX_LOG_LEVEL` | Log verbosity (debug/info/warn) — see `packages/diagnostics/src/logger.ts:30` |
| `SPFX_SERVE_TENANT_DOMAIN` | Tenant domain fallback for `dev.tenantUrl` — see `packages/dev-runtime/src/serve.ts:102` |
| `RSPFX_ACCESS_TOKEN` + `RSPFX_APP_CATALOG_URL` | Bearer token and catalog URL for `rspfx deploy` — see `apps/cli/src/commands/deploy.ts:16` |
| `RSPFX_NPM_OTP` | One-time password for `node scripts/publish.mjs:34` |
