---
private: true
search: false
prev: false
next: false
head:
  - - meta
    - name: robots
      content: noindex
---

# Real-tenant validation

Reference for the manual tenant gate: scaffold with `rspfx new` → `rspfx package` → upload `.sppkg` to app catalog → install → render in workbench with no console errors. Gate passed 2026-08-22 for web parts, extensions, and libraries.

## Prerequisites

Microsoft 365 developer tenant with app catalog site (`https://contoso.sharepoint.com/sites/appcatalog`) and test site collection. Node ≥20, Bun, built CLI (`bun run --filter @mbsks/rspfx-cli build`).

For local checks unset tenant override: `SPFX_SERVE_TENANT_DOMAIN= bun run test`.

## Tenant credentials

Create Entra access token with `Sites.Manage.All` scoped to app catalog; export `RSPFX_ACCESS_TOKEN` (bearer) and `RSPFX_APP_CATALOG_URL`.

```sh
export RSPFX_ACCESS_TOKEN='<bearer-token>'
export RSPFX_APP_CATALOG_URL='https://contoso.sharepoint.com/sites/appcatalog'
```

Without these, `rspfx deploy` prints manual upload steps. See [commands.md#rspfx-deploy](commands.md#rspfx-deploy).

## Gate

```sh
rspfx new contoso-gate --framework react --spfx-version 1.23 --yes
cd contoso-gate
rspfx doctor
rspfx package
ls -lh sharepoint/solution/contoso-gate.sppkg
RSPFX_ACCESS_TOKEN=$RSPFX_ACCESS_TOKEN RSPFX_APP_CATALOG_URL=$RSPFX_APP_CATALOG_URL rspfx deploy
```

Manual alternative: app catalog site → Site contents → Apps for SharePoint → Upload `.sppkg` → Deploy — see Microsoft docs: [Use the app catalog](https://learn.microsoft.com/en-us/sharepoint/use-app-catalog).

Install to test site (`Site contents → Add an app`) then open `https://contoso.sharepoint.com/sites/<test>/_layouts/15/workbench.aspx` and add the web part.

Debug loop: `rspfx dev --mode sharepoint --tenant https://contoso.sharepoint.com` serves `https://localhost:4321/temp/manifests.js` and prints the workbench URL — see [architecture.md#dev-mode](architecture.md#dev-mode) and Microsoft docs: [Use the Workbench](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/tools/workbench).

Same steps apply for extensions (`--component applicationcustomizer|fieldcustomizer|listviewcommandset|formcustomizer`) and libraries (`--component library`).

## Checklist

| Check | How |
|---|---|
| No console errors | DevTools Console while loading gate web part |
| IDs match fallback | Compare `release/manifests/<id>.manifest.json` vs `reference/sp-component-ids.json` |
| `.sppkg` entries exact | Unzip and compare entry list (see [compatibility.md](compatibility.md) and [reference/FORMATS.md](../reference/FORMATS.md) §4) |
| AMD wrapper byte-compatible | Bundle starts with capture line then `define('<id>_<version>', …)` |
| `internalModuleBaseUrls` pseudo-URL | When `includeClientSideAssets`, inspect manifest → `['HTTPS://SPCLIENTSIDEASSETLIBRARY/']` |
| App catalog Deployed | Catalog shows Deployed; site can add the web part |

On failure compare against an unzipped official `.sppkg` per `reference/FORMATS.md`.

## Benchmarking on tenant repo

```sh
bun run --filter @mbsks/rspfx-cli build
BENCH_RUNS=3 node bench/bench.mjs examples/shadcn
BENCH_RUNS=3 node bench/compare-official.mjs
```

See `bench/README.md` for `BENCH_KEEP_OUTPUT` and methodology; see [performance.md](performance.md) for baselines.

## Local tests

Run with empty tenant override: `SPFX_SERVE_TENANT_DOMAIN= bun run test` and keep `RSPFX_ACCESS_TOKEN` unset.
