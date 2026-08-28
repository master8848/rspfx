# Hybrid dev mode

Run `rspfx dev` in an official SPFx project (Heft/Gulp) without changing it. Dev uses RSPFX; prod stays on the official toolchain until `rspfx migrate`.

> You don't need `@microsoft/sp-*` for most web parts. Install only if you import that runtime.

## Detection

`apps/cli/src/hybrid.ts` reports an official project when:

- `config/config.json` exists, and
- `gulpfile.js` / `gulpfile.mjs` / `heft.json` / `.yo-rc.json` exists.

Only applies when no RSPFX bundler config (`vite.config.ts`, `rsbuild.config.ts`, `rspack.config.ts`) is found. If one exists, detection doesn't run. When no config is found, `rspfx dev` builds it from `config/config.json` + `package.json` — no manual file needed.

## What works

| Command | Result |
|---|---|
| `rspfx dev` | Debug manifests + bundles for the workbench. Or local preview with `--mode local`. |
| `rspfx dev --refresh` | Fast refresh if the framework supports it. |
| `build` / `package` / `deploy` / `analyze` | Refused — run `rspfx migrate` first. |

Dev settings come from your files (`packages/dev-runtime/src/project.ts`): `config/serve.json`, web parts from `src/webparts/*` or `config/config.json` bundles, localized resources, sp-* ids from `node_modules` or `reference/sp-component-ids.json`.

Synthesized config:

| Field | Source |
|---|---|
| `name` | `package.json` `name` |
| `version` | `package.json` `version` |
| `spfxVersion` | `@microsoft/sp-core-library` version, else `1.23` |
| `framework` | react → vue → svelte → preact → solid-js → vanilla |
| `language` | `typescript` |

## Switch to RSPFX builds

```sh
rspfx migrate --dry-run   # preview
rspfx migrate             # writes config, backs up to .rspfx/migrate-backup.json
bun install
rspfx build               # or bun run build — Vite, Rsbuild, or Rspack runs directly
```

Same manifests drive both toolchains — see [migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx](migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx). Revert with `rspfx migrate --revert` or `git restore .`.

## Errors before migrate

- `OFFICIAL_TOOLCHAIN_BUILD` — production commands refuse in hybrid mode.
- `OFFICIAL_SPFX_VERSION_UNSUPPORTED` — sp-core-library outside [compatibility.md](compatibility.md).
- `OFFICIAL_SPFX_VERSION_UNKNOWN` — no sp-core-library dep (only matters after migrate).
- `OFFICIAL_DEPS_NOT_INSTALLED` — `node_modules/@microsoft/` missing.

## Limits

- No plugin options — serve uses `config/serve.json` + CLI flags only.
- Local preview bundles real sp-* if installed; otherwise externalized. Install only if you import that runtime.
