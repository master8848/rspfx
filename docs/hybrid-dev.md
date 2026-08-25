# Hybrid dev mode

Hybrid mode runs `rspfx dev` inside an officially scaffolded SPFx project (gulp or Heft toolchain) without changing that project. Development serving uses rspfx; production builds and packaging stay on the official toolchain until you run `rspfx migrate`. The fact home for this feature is this page; rationale is in [.agents/notes/implemented/feature/2026-08-23-hybrid-dev-mode.md](../.agents/notes/implemented/feature/2026-08-23-hybrid-dev-mode.md).

> **Tip:** You do not need to install `@microsoft/sp-*` manually for hybrid dev — externals are handled internally and SharePoint resolves them at runtime. Install `sp-*` only if your code imports that runtime.

## Detection

`apps/cli/src/hybrid.ts` `detectOfficialProject()` reports an official project when both hold:

- `config/config.json` exists at the project root.
- A toolchain marker exists: `gulpfile.js`, `gulpfile.mjs`, `heft.json`, or `.yo-rc.json`.

Detection applies only when no rspfx bundler config (`rspack.config.ts`, `vite.config.ts`, `rsbuild.config.ts`) is found; projects with an rspfx plugin config behave exactly as before. When no config is found `rspfx dev` synthesizes one from `config/config.json` + `package.json` — no manual `rspack.config.ts` is needed.

## What works on an official project

| Command | Behavior |
|---|---|
| `rspfx dev` | Serves debug manifests + bundles for the workbench (`--tenant <url>` or `SPFX_SERVE_TENANT_DOMAIN`), local preview with `--mode local` |
| `rspfx dev --refresh` | Fast refresh when the detected framework supports it |
| everything else | Refused until you migrate — see below |

Dev settings come from the project's own files, read by `readProject()` (`packages/dev-runtime/src/project.ts`): `config/serve.json` (port/hostname/https/initialPage with `{tenantdomain}` expansion), component discovery from `src/webparts/`, `src/extensions/`, `src/libraries/` or `config/config.json` `bundles`, localized resources from `config.json` (`lib/…/{locale}.js` patterns resolve to `src/`), and `@microsoft/sp-*` externals harvested from `node_modules` when present (otherwise handled internally via `reference/sp-component-ids.json`).

The synthesized config comes from `loadOfficialConfig()`:

| Field | Source |
|---|---|
| `name` | `package.json` `name` (scope stripped) |
| `version` | `package.json` `version` |
| `spfxVersion` | major.minor of the `@microsoft/sp-core-library` dependency when installed, otherwise `1.23` default — externalization does not require the package to be installed |
| `framework` | dependency scan: react → vue → svelte → preact → solid-js → vanilla |
| `language` | always `typescript` |

## Switching to RSPFX builds

Hybrid mode is dev-only by design so production output stays byte-compatible with the official pipeline. To switch builds to RSPFX:

```sh
rspfx migrate --dry-run   # preview
rspfx migrate             # apply — backs up to .rspfx/migrate-backup.json
bun install
rspfx build               # or bun run build — bundler config is optional, Rspack/Vite runs internally
```

After migrate the same `config/config.json`, `config/package-solution.json`, and `src/*/*.manifest.json` drive both toolchains — see [migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx](migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx). Revert with `rspfx migrate --revert` or `git restore .`.

## Production commands refuse (before migrate)

`build`, `package`, `deploy`, and `analyze` throw `RspfxError('OFFICIAL_TOOLCHAIN_BUILD')` via `loadConfigOrRefuseOfficial()`: keep production output byte-compatible with the official pipeline. To migrate a project fully to rspfx builds see [migrating-from-gulp-heft.md](migrating-from-gulp-heft.md).

Other error codes from hybrid loading:

- `OFFICIAL_SPFX_VERSION_UNSUPPORTED` — `@microsoft/sp-core-library` version outside [compatibility.md](compatibility.md).
- `OFFICIAL_SPFX_VERSION_UNKNOWN` — no `@microsoft/sp-core-library` dependency in `package.json` (only matters after migrate when you choose a specific `spfxVersion`; hybrid dev defaults to `1.23` and handles externals internally).
- `OFFICIAL_DEPS_NOT_INSTALLED` — `node_modules/@microsoft/` missing; run the package manager install first (only required if your code imports `sp-*` runtimes; otherwise the local preview serves without them in Rspack zero-config).

## Limitations

- No rspfx plugin options apply; there is no `rspack.config.ts`. Serve behavior is governed by `config/serve.json` and CLI flags only.
- Local preview bundles real `@microsoft/sp-*` packages when they are installed (no externals); when not installed the preview still serves via internal externalization — install `sp-*` only if your code imports that runtime.
