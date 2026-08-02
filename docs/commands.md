# Command Reference

Global: `rspfx --version`, `rspfx --help`. All commands load the project's
bundler config (`rspack.config.ts` via jiti, or `vite.config.ts` for Vite
projects), find the `RspfxPlugin` / `rspfxVite` plugin by its marker symbol,
and use its options, merging CLI flags over them. The optional `paths` section
of the plugin options customizes the project folder layout: `paths.srcDir`
(default `src`), `paths.webpartsDir` (default `src/webparts`), `paths.configDir`
(default `config`) — see [building-packages.md](building-packages.md) for what
each one controls. If no config or no plugin is found the CLI errors with
guidance.

## `rspfx new <name>`

Scaffold a new SPFx project and install dependencies.

| Flag | Description |
|---|---|
| `--framework <id>` | `vanilla` \| `react` \| `solid` \| `preact` \| `vue` \| `svelte` |
| `--language <lang>` | `ts` (typescript) \| `js` (javascript) |
| `--styling <style>` | `css` \| `scss` \| `tailwind` |
| `--fluent` | Enable the Fluent UI adapter (React only) |
| `--spfx-version <v>` | `1.20` \| `1.21` \| `1.22` \| `1.23` (default `1.23`) |
| `--pm <pm>` | `pnpm` \| `npm` \| `yarn` (dependency install) |
| `--no-install` | Skip dependency installation |
| `--yes` | Accept all defaults; non-interactive |

```sh
rspfx new my-app
rspfx new my-app --framework vue --styling scss --yes
rspfx new my-app --framework react --fluent --spfx-version 1.20 --no-install
```

## `rspfx dev`

Start the dev environment: Rspack dev server + HTTPS manifest server on `:4321`,
then auto-open the workbench.

| Flag | Description |
|---|---|
| `--refresh` | Enable fast refresh (state-preserving where supported) |
| `--no-browser` | Do not auto-open the browser |
| `--port <n>` | Override `dev.port` (default 4321) |
| `--tenant <url>` | Override the tenant URL (else `dev.tenantUrl` or `SPFX_SERVE_TENANT_DOMAIN`) |

```sh
rspfx dev
rspfx dev --refresh
rspfx dev --tenant https://contoso.sharepoint.com --no-browser
```

## `rspfx playground`

Standalone localhost sandbox — no SharePoint required. Serves the web part on
`config.playground.port` (default 3000) with a generated playground page.

| Flag | Description |
|---|---|
| `--port <n>` | Override `playground.port` |

```sh
rspfx playground
rspfx playground --port 4000
```

## `rspfx build`

Production compile: bundles to `build.outDir` (`dist`), component manifests and
assets to `build.releaseDir` (`release`).

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
`.rspfx/analyze.html`.

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
import { RspfxPlugin } from '@mbsks/rspfx-plugin';

export default {
  mode: 'development',
  plugins: [
    new RspfxPlugin({
      name: 'my-app',
      framework: 'react',
      spfxVersion: '1.22',
      dev: { port: 4321, https: true, hostname: 'localhost', tenantUrl: 'https://contoso.sharepoint.com', openBrowser: true },
      build: { minify: true, sourcemap: false, outDir: 'dist', releaseDir: 'release' },
      version: '1.0.0'
    })
  ]
};
```

`RspfxPlugin` implements the standard webpack plugin interface
(`apply(compiler)`), so it can also be tested under webpack-compatible bundlers
(e.g. Turbopack) for the compile-time parts; the full pipeline (manifests, dev
server, packaging) runs through the rspfx CLI.

### Vite — `vite.config.ts`

```ts
import { rspfxVite } from '@mbsks/rspfx-plugin';

export default {
  plugins: [rspfxVite({ name: 'my-app', framework: 'react', dev: { ... }, build: { ... }, version: '1.0.0' })]
};
```

`rspfx build` / `rspfx package` spawn one `vite build` per web part bundle;
`rspfx dev` spawns `vite` (the plugin serves `/temp/manifests.js`, rebuilds AMD
bundles into `dist/`, opens the workbench). `rspfx playground` is Rspack-only
for now — Vite projects get a clear error.

### Options

The options object carries: `name`, `version` (build-time version used in AMD
library names and manifests — overrides package.json), `spfxVersion`,
`framework`, `fluent`, `language`, `styling`, `dev` (port/https/hostname/
workbench/fastRefresh/openBrowser/tenantUrl/initialPage), `build`
(sourcemap/minify/splitChunks/outDir/releaseDir), `paths`
(srcDir/webpartsDir/configDir), `playground`, `deploy`. Defaults are unchanged
(port 4321, https true, hostname localhost, minify true, dist/release,
src/src/webparts/config).
