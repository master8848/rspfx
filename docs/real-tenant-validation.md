# Real-tenant validation — reference

This page is a reference for the manual real-tenant gate described in [docs/roadmap.md#real-tenant-validation](roadmap.md#real-tenant-validation) — scaffold with `rspfx new`, produce `sharepoint/solution/<name>.sppkg` with `rspfx package`, upload to `https://contoso.sharepoint.com/sites/appcatalog` via `RSPFX_ACCESS_TOKEN` bearer token (120 s timeout in `apps/cli/src/commands/deploy.ts:62`), install, and render in the workbench with no console errors.

## Prerequisites

Developer tenant with an app catalog site (`https://contoso.sharepoint.com/sites/appcatalog`) and a site collection for testing; Node ≥ 20, pnpm, and a built CLI (`pnpm --filter @mbsks/rspfx-cli build` → `apps/cli/dist/cli.js`).

For local-only checks unset any tenant override so `packages/dev-runtime` stays in local preview mode: `SPFX_SERVE_TENANT_DOMAIN= pnpm test` — see [docs/commands.md](commands.md#rspfx-dev) and `AGENTS.md:47`; for tenant mode set `SPFX_SERVE_TENANT_DOMAIN` or `dev.tenantUrl` in `rspack.config.ts` or pass `rspfx dev --tenant https://contoso.sharepoint.com`.

## Tenant credential setup

Create a Microsoft Entra access token with `Sites.Manage.All` (or equivalent app-catalog write) scoped to the app catalog site; export `RSPFX_ACCESS_TOKEN` (bearer token) and `RSPFX_APP_CATALOG_URL` (`https://contoso.sharepoint.com/sites/appcatalog`) — both are read by `apps/cli/src/commands/deploy.ts:16` and no other `RSPFX_TENANT` / `RSPFX_USERNAME` / `RSPFX_PASSWORD` vars are implemented.

```sh
export RSPFX_ACCESS_TOKEN='<bearer-token>'
export RSPFX_APP_CATALOG_URL='https://contoso.sharepoint.com/sites/appcatalog'
```

Without these vars `rspfx deploy` prints manual upload steps and exits without uploading — see [docs/commands.md](commands.md#rspfx-deploy) for `config.deploy.appCatalogSiteUrl` vs env var precedence.

## Step-by-step gate

Run `rspfx new` to scaffold a minimal project (web part, React, SPFx 1.23 default from `packages/core/src/versions.ts:13` `SPFX_DEFAULT_TARGET`) — use `--yes` for non-interactive runs.

```sh
rspfx new contoso-gate --framework react --spfx-version 1.23 --yes
cd contoso-gate
rspfx doctor
```

Build and package the solution — `rspfx package` implies `rspfx build` and writes `sharepoint/solution/contoso-gate.sppkg` (`paths.zippedPackage` in `config/package-solution.json`; see [docs/commands.md](commands.md#rspfx-package)).

```sh
rspfx package
ls -lh sharepoint/solution/contoso-gate.sppkg
```

Upload to the app catalog — authenticated upload uses `RSPFX_ACCESS_TOKEN` bearer token with a 120 s `AbortSignal.timeout(120_000)` in `apps/cli/src/commands/deploy.ts:62`; on timeout the CLI throws `DEPLOY_TIMEOUT`.

```sh
RSPFX_ACCESS_TOKEN=$RSPFX_ACCESS_TOKEN RSPFX_APP_CATALOG_URL=$RSPFX_APP_CATALOG_URL rspfx deploy
```

Manual alternative if token is unavailable: open `https://contoso.sharepoint.com/sites/appcatalog` → Site contents → Apps for SharePoint → Upload `sharepoint/solution/contoso-gate.sppkg` → Deploy / trust.

Install to a test site and open the workbench — add the app to a site collection (`Site contents → Add an app → contoso-gate`) then navigate to `https://contoso.sharepoint.com/sites/<test>/_layouts/15/workbench.aspx` and add the web part to the page.

Alternatively validate the debug loop: `rspfx dev --mode sharepoint --tenant https://contoso.sharepoint.com` serves `https://localhost:4321/temp/manifests.js` and prints a workbench URL `.../_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=<percent-encoded manifests.js URL>` — see [docs/getting-started.md](getting-started.md#3-development-workflow) and [docs/architecture.md](architecture.md#dev-mode-flow).

## Validation checklist

Confirm the workbench renders the web part with no console errors and zero `webpack`/`Heft`/`gulp` strings in the bundle (`@microsoft/sp-*` are the only allowed externals in production — see [docs/compatibility.md](compatibility.md) and `ARCHITECTURE.md:7`).

| Check | How |
|---|---|
| No console errors in workbench | Open DevTools → Console while loading the gate web part; expect zero errors after install |
| Component IDs and versions match fallback table | Compare `release/manifests/<id>.manifest.json` ids against `reference/sp-component-ids.json:1` and `packages/manifest-generator/src/data/component-ids.ts` — harvested from `node_modules/@microsoft/sp-*/dist/*.manifest.json` |
| `.sppkg` zip entries exact | Unzip and list entries; they must equal the `zipEntries` assertion in `packages/sppkg-builder/tests/sppkg-builder.test.ts:1` (`[Content_Types].xml`, `_rels/.rels`, `AppManifest.xml`, `feature_<id>.xml`, `<featureId>/WebPart_<componentId>.xml`, `ClientSideAssets/` when `includeClientSideAssets`) — see [docs/compatibility.md](compatibility.md) and `reference/FORMATS.md` |
| AMD wrapper header byte-compatible | Bundle starts with currentScript capture line `(function(){window["__rspfx_script_url_<name>"]=` then `define('<componentId>_<version>', ["@microsoft/sp-core-library", ...],` — see `packages/compiler-rspack/src/public-path.ts` and `packages/plugin/tests/parity.test.ts` |
| `internalModuleBaseUrls` rewrites to pseudo-URL when `includeClientSideAssets` | Inspect `ClientSideAssets/<name>.xml` feature element manifest — `loaderConfig.internalModuleBaseUrls` is `['HTTPS://SPCLIENTSIDEASSETLIBRARY/']` in the packaged manifest |
| App catalog status is Deployed / Trusted | App catalog list shows `contoso-gate` as Deployed; site collection can add the web part |

If any check fails, compare against an unzipped official `.sppkg` captured per `reference/FORMATS.md` — never assume a format; see [docs/supporting-a-new-spfx-version.md](supporting-a-new-spfx-version.md#4-harvest-the-official-artifacts-the-core-methodology).

## Benchmarking on your tenant repo

Measure RSPFX alone on `examples/shadcn` (cold 633 ms on M1 Pro per `docs/performance.md:24`) with `BENCH_RUNS=3` — requires built CLI and leaves `dist/`/`release/` behind.

```sh
pnpm --filter @mbsks/rspfx-cli build
BENCH_RUNS=3 node bench/bench.mjs examples/shadcn
```

Compare against the official toolchain (gulp/Heft/fast-serve) — first run installs official skeletons into `bench/.official-work/` (minutes) and honors `BENCH_RUNS`.

```sh
BENCH_RUNS=3 node bench/compare-official.mjs
BENCH_RUNS=3 node bench/compare-official.mjs --tool heft --build-only
BENCH_OFFICIAL_ONLY=1 BENCH_RUNS=3 node bench/compare-official.mjs
```

See `bench/README.md` for `BENCH_KEEP_OUTPUT`, `BENCH_OFFICIAL_FRESH`, and full methodology; for why numbers differ from the M1 Pro baseline see [docs/performance.md](performance.md) and [docs/roadblocks.md](roadblocks.md#migration-and-support-gaps).

## Unsetting tenant for local tests

Local preview and unit tests must not leak a tenant domain — run with an empty override: `SPFX_SERVE_TENANT_DOMAIN= pnpm test` (the `=` with empty value unsets the var for the child process; see [docs/commands.md](commands.md#rspfx-dev)) and keep `RSPFX_ACCESS_TOKEN` unset so `rspfx deploy` falls back to manual steps.

