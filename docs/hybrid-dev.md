# Hybrid dev mode

Hybrid mode runs `rspfx dev` inside an officially scaffolded SPFx project (gulp
or Heft toolchain) without changing that project. Development serving uses
rspfx; production builds and packaging stay on the official toolchain. The fact
home for this feature is this page; rationale is in
[.agents/notes/implemented/feature/2026-08-23-hybrid-dev-mode.md](../.agents/notes/implemented/feature/2026-08-23-hybrid-dev-mode.md).

## Detection

`apps/cli/src/hybrid.ts` `detectOfficialProject()` reports an official project
when both hold:

- `config/config.json` exists at the project root.
- A toolchain marker exists: `gulpfile.js`, `gulpfile.mjs`, `heft.json`, or `.yo-rc.json`.

Detection applies only when no rspfx bundler config (`rspack.config.ts`,
`vite.config.ts`, `rsbuild.config.ts`) is found; projects with an rspfx plugin
config behave exactly as before.

## What works on an official project

| Command | Behavior |
|---|---|
| `rspfx dev` | Serves debug manifests + bundles for the workbench (`--tenant <url>` or `SPFX_SERVE_TENANT_DOMAIN`), local preview with `--mode local` |
| `rspfx dev --refresh` | Fast refresh when the detected framework supports it |
| everything else | Refused — see below |

Dev settings come from the project's own files, read by `readProject()`
(`packages/dev-runtime/src/project.ts`): `config/serve.json`
(port/hostname/https/initialPage with `{tenantdomain}` expansion), component
discovery from `src/webparts/`, `src/extensions/`, `src/libraries/` or
`config/config.json` `bundles`, localized resources from `config.json`
(`lib/…/{locale}.js` patterns resolve to `src/`), and `@microsoft/sp-*`
externals harvested from `node_modules`.

The synthesized config comes from `loadOfficialConfig()`:

| Field | Source |
|---|---|
| `name` | `package.json` `name` (scope stripped) |
| `version` | `package.json` `version` |
| `spfxVersion` | major.minor of the `@microsoft/sp-core-library` dependency |
| `framework` | dependency scan: react → vue → svelte → preact → solid-js → vanilla |
| `language` | always `typescript` |

## Production commands refuse

`build`, `package`, `deploy`, and `analyze` throw
`RspfxError('OFFICIAL_TOOLCHAIN_BUILD')` via
`loadConfigOrRefuseOfficial()`: keep production output byte-compatible with the
official pipeline. To migrate a project fully to rspfx builds see
[migrating-from-gulp-heft.md](migrating-from-gulp-heft.md).

Other error codes from hybrid loading:

- `OFFICIAL_SPFX_VERSION_UNSUPPORTED` — `@microsoft/sp-core-library` version outside [docs/compatibility.md](compatibility.md).
- `OFFICIAL_SPFX_VERSION_UNKNOWN` — no `@microsoft/sp-core-library` dependency in `package.json`.
- `OFFICIAL_DEPS_NOT_INSTALLED` — `node_modules/@microsoft/` missing; run the package manager install first.

## Limitations

- No rspfx plugin options apply; there is no `rspack.config.ts`. Serve behavior
  is governed by `config/serve.json` and CLI flags only.
- Local preview bundles real `@microsoft/sp-*` packages (no externals); the
  project must have complete installs for that to compile.
