# Command Reference

Global: `rspfx --version`, `rspfx --help`. All commands read `rspfx.config.ts`
(loaded via jiti) and merge CLI flags over config.

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

Package + upload the `.sppkg` to the app catalog via REST. Credentials come from
`config.deploy` (`tenantUrl`, `username`, `password`, `appCatalogSiteUrl`) or the
env vars `RSPFX_TENANT`, `RSPFX_USERNAME`, `RSPFX_PASSWORD`. **Without
credentials it prints the manual upload steps instead.**

```sh
rspfx deploy
RSPFX_TENANT=https://contoso.sharepoint.com RSPFX_USERNAME=u@contoso.onmicrosoft.com \
RSPFX_PASSWORD=... rspfx deploy
```

## `rspfx analyze`

Build + bundle report: sizes and chunk list as a console table plus
`.rspfx/analyze.html`.

```sh
rspfx analyze
```

## `rspfx doctor`

Environment/config/port/dependency checks (Node ≥ 20, config files, ports, certs,
deps, sp-* resolution). Exit code **1** on failures.

```sh
rspfx doctor
```

## `rspfx clean`

Remove build artifacts: `dist`, `release`, `temp`, `.rspfx`, `node_modules/.cache`.

```sh
rspfx clean
```
