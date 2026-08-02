# Command Reference

Global: `rspfx --version`, `rspfx --help`. All commands read `rspfx.config.ts`
(loaded via jiti) and merge CLI flags over config. The optional `paths` section
customizes the project folder layout: `paths.srcDir` (default `src`),
`paths.webpartsDir` (default `src/webparts`), `paths.configDir` (default
`config`) — see [building-packages.md](building-packages.md) for what each one
controls.

## `rspfx new <name>`

Scaffold a new SPFx project and install dependencies.

| Flag | Description |
|---|---|
| `--framework <id>` | `vanilla` \| `react` \| `solid` \| `preact` \| `vue` \| `svelte` |
| `--language <lang>` | `ts` (typescript) \| `js` (javascript) |
| `--styling <style>` | `css` \| `scss` \| `tailwind` |
| `--fluent` | Enable the Fluent UI adapter (React only) |
| `--spfx-version <v>` | `1.20` \| `1.21` \| `1.22` (default `1.22`) |
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

Environment/config/port/dependency checks: Node ≥ 20, `rspfx.config.ts` loads,
framework package resolvable, sp-* versions match the target, web part bundles
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

## Bundler plugin surface (`spfx()`)

`@mbsks/rspfx-compiler-rspack` exports `spfx(options)` — the first step toward
"bring your own bundler config". It returns a **full Rspack `Configuration`**
(the same one the CLI builds internally), ready to drop into your own
`rspack.config.ts`:

```ts
// rspack.config.ts
import { spfx } from '@mbsks/rspfx-compiler-rspack';

export default await spfx({
  projectRoot: process.cwd(),
  framework: 'react',
  entries: [
    {
      name: 'hello',
      import: './src/webparts/hello/HelloWebPart.ts',
      componentIds: [],
      version: '1.0.0'
    }
  ],
  production: false,
  fastRefresh: true
});
```

Options mirror the compile context: `projectRoot`, `framework`, `entries`
(bundle name → entrypoint, manifest ids, version), `externals?`, `aliases?`,
`fastRefresh?` (default false), `production?` (default true), `serveMode?`
(default false), `build?` (minify/sourcemap/splitChunks/outDir/releaseDir
defaults), `additionalPlugins?`, `swcContributions?`.

The CLI remains the opinionated default — `rspfx build` / `rspfx dev` are
unchanged. The plugin surface is the escape hatch for projects that need to
extend the compiler config (extra loaders, plugins, module-federation-style
setups). vite/turbopack variants are future work.
