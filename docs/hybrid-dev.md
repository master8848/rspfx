# Hybrid dev mode

Run `rspfx dev` in an official SPFx project without changing it. See Microsoft docs: [SharePoint Framework toolchain](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/sharepoint-framework-toolchain) and [Use the Workbench](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/tools/workbench).

Dev uses RSPFx on `https://localhost:4321` (or `http://localhost:4321` for local preview); production stays on Heft/Gulp until `rspfx migrate`.

> Most web parts need no `@microsoft/sp-*` install — externalized by default.

## Detection

Hybrid mode activates when:

- `config/config.json` exists, and
- `gulpfile.js` / `gulpfile.mjs` / `heft.json` / `.yo-rc.json` exists, and
- No RSPFx bundler config (`vite.config.ts`, `rsbuild.config.ts`, `rspack.config.ts`) is found.

If a bundler config exists, detection does not run.

When no config is found, `rspfx dev` synthesizes one from `config/config.json` + `package.json` — no manual file needed.

## What works

| Command | Result |
|---|---|
| `rspfx dev` | Debug manifests + bundles for the workbench at `https://localhost:4321` — or local preview at `http://localhost:4321` with `--mode local` |
| `rspfx dev --refresh` | Fast refresh where the framework supports it |
| `build` / `package` / `deploy` / `analyze` | Refused — run `rspfx migrate` first |

Dev settings come from your files (`config/serve.json`, web parts from `src/webparts/*` or `config/config.json` bundles, localized resources, `sp-*` IDs from `node_modules` or fallback).

Synthesized config:

| Field | Source |
|---|---|
| `name` | `package.json` `name` |
| `version` | `package.json` `version` |
| `spfxVersion` | `@microsoft/sp-core-library` version, else `1.24` (default target) |
| `framework` | `react` → `vue` → `svelte` → `preact` → `solid-js` → `vanilla` |
| `language` | `typescript` |

> **Tip:** Hybrid is the zero-risk trial — no files are written, no deps changed, just `rspfx dev` alongside `gulp serve`.

Compare dev servers directly: `gulp serve` vs `rspfx dev` — same manifests, same workbench URL shape, same `:4321` port.

## Switch to RSPFx builds

```sh
rspfx migrate --dry-run   # preview
rspfx migrate             # writes bundler config, backs up to .rspfx/migrate-backup.json
bun install      # or pnpm install / npm install / yarn
rspfx build               # or bun run build / pnpm build / npm run build / yarn build — Vite, Rsbuild, or Rspack
```

Same manifests drive both toolchains — see [migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx](migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx).

Revert with `rspfx migrate --revert` or `git restore .`.

## Errors before migrate

- `OFFICIAL_TOOLCHAIN_BUILD` — production commands refused in hybrid mode.
- `OFFICIAL_SPFX_VERSION_UNSUPPORTED` — `sp-core-library` outside [compatibility.md](compatibility.md).
- `OFFICIAL_SPFX_VERSION_UNKNOWN` — no `sp-core-library` dep (only matters after migrate).
- `OFFICIAL_DEPS_NOT_INSTALLED` — `node_modules/@microsoft/` missing.

## Limits

- No plugin options — serve uses `config/serve.json` + CLI flags only.
- Local preview bundles real `sp-*` if installed; otherwise externalized.

Install `sp-*` only if your code imports that runtime.

> **Tip:** If `rspfx dev` shows a cert warning, run `rspfx doctor` — workbench at `https://localhost:4321` needs `~/.rspfx/certs` trusted, local preview at `http://localhost:4321` does not — see [getting-started.md#cert-trust](getting-started.md#cert-trust).
