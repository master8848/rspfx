# `rspfx dev:vite` — fastest way to try dev mode

TL;DR: `rspfx dev:vite` auto-detects Node, SPFx version, framework, and `tsconfig.json`, adds the lean dev plugin, creates `vite.config.ts`, and starts Vite on `:4321`.

It is the easiest way to try RSPFx dev in any SPFx project without migrating.

## One command

Run in any SPFx project root (yo-generated, gulp/heft, `1.11` to `1.24`):

```sh
npx @mbsks/rspfx-cli dev:vite --dry-run   # preview plan, no writes
npx @mbsks/rspfx-cli dev:vite             # scaffold + start Vite
```

You do not need a `vite.config.ts` or `@mbsks/rspfx-plugin-dev` beforehand.

The CLI does it for you.

After the first run, also use:

```sh
npm run dev:vite   # runs `vite`
vite --port 4321   # direct Vite
bunx vite
```

`gulp serve`, `heft build`, and CI that produces `.sppkg` keep working.

Delete `vite.config.ts` to revert.

## Local testing with unpublished changes (`../spfx` → `spfx-test-versions`)

We test that the dev-mode-only plugin (`@mbsks/rspfx-plugin-dev`) works on both old and new SPFx projects (`spfx-test-versions`: `1.14` / `1.18.2` / `1.20` / `1.23.2`).

> **Careful:** the global `rspfx` CLI is **not** file-based. Changes in `../spfx` are not live and are not published to npm until release. After editing `apps/cli` or `packages/plugin-dev`, rebuild and reinstall the CLI globally from local files, and install the dev plugin from file instead of npm.

```sh
# 1) build rspfx locally (sibling repo of spfx-test-versions)
cd ../spfx
bun install
bun run build

# 2) install/replace global CLI from local build (not npm)
# option A — pack + global install (reproducible)
npm pack ./apps/cli
npm i -g ./apps/cli/mbsks-rspfx-cli-*.tgz
# or: (cd apps/cli && bun pm pack) then npm i -g ./apps/cli/mbsks-rspfx-cli-*.tgz
# option B — npm link (dev loop)
# npm link ./apps/cli

rspfx --version
which rspfx  # should point to global install you just replaced

# 3) in each test project, install dev plugin from file instead of npm
#    (otherwise `rspfx dev:vite` would add `@mbsks/rspfx-plugin-dev@^${cliVersion}` from npm)
cd ../spfx-test-versions/spfx-2021-contoso-tracker
bun add -D file:../../spfx/packages/plugin-dev
# or: npm i -D file:../../spfx/packages/plugin-dev

# repeat for the other eras
cd ../spfx-2024-contoso-tracker && bun add -D file:../../spfx/packages/plugin-dev
cd ../spfx-2025-contoso-tracker && bun add -D file:../../spfx/packages/plugin-dev
cd ../spfx-2026-contoso-tracker && bun add -D file:../../spfx/packages/plugin-dev
```

Then verify scaffold without starting Vite:

```sh
rspfx dev:vite --dry-run  # preview: Node/SPFx/framework/tsconfig detection, package.json + vite.config.ts plan
rspfx dev:vite             # scaffold + `vite --port 4321` (needs Node >=20, see below)
```

The CLI (`apps/cli/src/commands/dev-vite.ts:195`) auto-detects `spfxVersion`/`framework`/`tsconfig` and writes the lean `vite.config.ts` (`@mbsks/rspfx-plugin-dev/vite`). Re-run `bun run build && npm i -g ./apps/cli/*.tgz` after any CLI change — the global binary does not watch files.

## What `dev:vite` does

`apps/cli/src/commands/dev-vite.ts:195` `runDevVite` runs these steps in order.

Check Node compatibility (`process.versions.node`).

Requires `>=20` (`package.json:8` `engines.node`).

Warns on Node 14/16/18 per `docs/reference/compatibility.md#node-requirements` and `docs/reference/compatibility.md#vite-node-matrix` (Vite 8 needs `>=20.19`).

Check SPFx version (`apps/cli/src/commands/dev-vite.ts:53` `detectSpfxVersion`).

Reads `package.json` `dependencies.@microsoft/sp-core-library`.

Uses `packages/core/src/versions.ts:13` `SPFX_VERSIONS` (`1.20`–`1.24` full, `1.11`–`1.19` registered dynamically for dev-only via `registerSpfxVersion`).

Source logged as `config` or `package.json (1.11.0)` or `default`.

Detects framework from `dependencies` (`react` → `react`, `vue` → `vue`, `svelte`/`preact`/`solid-js` → vanilla fallback) (`apps/cli/src/commands/dev-vite.ts:96`).

Loads or synthesizes `RspfxConfig` (`apps/cli/src/config.ts:25` `loadConfig` via `jiti` + `RSPFX_PLUGIN_MARKER`).

If no bundler config exists, probes official project (`apps/cli/src/hybrid.ts:44` `detectOfficialProject`: `config/config.json` + `gulpfile.js`/`heft.json`).

Falls back to `synthesizeConfigFromPackageJson` (`apps/cli/src/commands/dev-vite.ts:69`) when no marker is found (fresh yo project).

Find tsconfig (`apps/cli/src/commands/dev-vite.ts:35` `findTsconfigFile`).

Scans `tsconfig.json`, `tsconfig.build.json`, `tsconfig.app.json`, plus any `tsconfig*.json` in the project root.

Respects `build.tsconfigPath` / `tsconfigPath` (`packages/core/src/config.ts:32`).

`tsconfig.json` (yo default) needs no extra config.

Custom file is linked as `build: { tsconfigPath: 'tsconfig.app.json' }` in the generated config.

Use `--tsconfig tsconfig.custom.json` to override.

Update `package.json` (`apps/cli/src/commands/dev-vite.ts:142` `ensurePackageJsonDevPlugin`).

Sets `type: "module"` to avoid Vite 8 `configLoader: 'native'` warning `ESM syntax in a file loaded as CommonJS (vite.config.ts:1:1)`.

Adds `devDependencies.@mbsks/rspfx-plugin-dev` `^${cliVersion}` (lean, no `@rspack/core`/`sass`).

Adds `devDependencies.vite` `^8.0.0` if missing.

Adds script `dev:vite: vite`.

Writes `vite.config.ts` (`apps/cli/src/commands/dev-vite.ts:106` `ensureViteConfigFile`).

Skips if `vite.config.*`/`rsbuild.config.*`/`rspack.config.*` exists (`apps/cli/src/config.ts:25` `CONFIG_CANDIDATES` includes `vite.config.mts/.mjs/.cjs`).

Honors `--force` to overwrite.

Content is the lean dev-only plugin:

```ts
import { defineConfig } from 'vite';
import { rspfxViteDev } from '@mbsks/rspfx-plugin-dev/vite';

export default defineConfig({
  plugins: [rspfxViteDev({ name: 'my-app', framework: 'react' as const, spfxVersion: '1.24' })],
});
```

Custom tsconfig adds `build: { tsconfigPath: 'tsconfig.app.json' }`.

Start Vite (`apps/cli/src/vite.ts:1` `spawnViteDev` with `VITE_CONFIG_NATIVE_IGNORE_WARNING=true`).

Reads `config/serve.json` + `dev` config via `packages/dev-runtime/src/serve.ts:60` `resolveServeSettings`/`resolveServeMode`.

Prints workbench URL via `packages/dev-runtime/src/serve.ts:buildWorkbenchUrl`.

Validates cert in `~/.rspfx/certs` for `sharepoint` mode (`packages/manifest-server/src/index.ts:132` `ensureCertificates`).

Same runtime as `packages/plugin-dev/src/vite.ts:110` `rspfxViteDev` (`config` returns `server.host`/`port`/`https` + `esbuild.tsconfigRaw`; `configureServer` serves `/temp/manifests.js`).

## Flags

See `docs/reference/commands.md#rspfx-devvite` for the full table.

| Flag | Effect |
|---|---|
| `--dry-run` | Log plan, do not write `package.json`/`vite.config.ts` or spawn Vite |
| `--force` | Overwrite existing `vite.config.*` |
| `--tsconfig <path>` | Explicit tsconfig (relative to project root or absolute) |
| `--port <n>` | Override `dev.port` (`4321`) |
| `--mode <local\|sharepoint>` | Force `local` (HTTP, no cert) or `sharepoint` (HTTPS) |
| `--tenant <url>` | Tenant URL for workbench (`https://contoso.sharepoint.com`) |
| `--refresh` | Enable fast refresh (`dev.fastRefresh`) |
| `--browser` | Open workbench in browser |

```sh
rspfx dev:vite --dry-run
rspfx dev:vite --tsconfig tsconfig.app.json
rspfx dev:vite --force
rspfx dev:vite --tenant https://contoso.sharepoint.com --mode sharepoint
rspfx dev:vite --port 5432 --refresh --browser
```

Alias: `rspfx vite:dev` is identical (`apps/cli/src/cli.ts:209`).

## Tsconfig handling

Default `tsconfig.json` (yo generator) is detected automatically.

No `build.tsconfigPath` needed.

Non-standard names (`tsconfig.app.json`, `tsconfig.build.json`, any `tsconfig*.json`) are auto-discovered and linked.

Explicit path takes precedence over auto-detect:

```sh
rspfx dev:vite --tsconfig tsconfig.custom.json
```

The plugin (`packages/plugin-dev/src/vite.ts:36` `resolveTsconfigRaw`, `packages/plugin/src/vite.ts:138` `resolveTsconfigRawForVite`) also stubs missing `@microsoft/rush-stack-compiler-4.1/includes/base.json` when `tsconfig.json` extends `rush-stack` and the base is absent — fixes `Tsconfig not found .../includes/base.json` on older projects (`spfx-2021-contoso-tracker` with `rush-stack-compiler-4.1`).

`esbuild.tsconfigRaw` fallback is set via `config` hook so `builtin:vite-transform` does not throw.

Run `rspfx migrate` to rewrite legacy `tsconfig.json` to plain config (`packages/templates/src/index.ts:223`).

## Node and Vite compatibility

Requires Node `>=20`.

`rspfx dev:vite` logs `Node 22.x OK` or warns `Node 14 below RSPFx required >=20`.

Vite 8 needs `>=20.19` (`docs/reference/compatibility.md#vite-node-matrix`).

`rspfx doctor` checks the same (`apps/cli/src/commands/doctor.ts:159`).

For older SPFx (`1.11` on Node 14), keep `gulp bundle` on Node 14 and run `rspfx dev:vite` on Node 20+ via `nvm use 20` or `volta pin node@20`.

## Local vs SharePoint mode

Mode is resolved by `packages/dev-runtime/src/serve.ts:131` `resolveServeMode`.

`local` (no `tenantDomain`) uses `http://localhost:4321/`, `https: false`, no cert, local preview with mock `/_api`.

`sharepoint` (tenant set) uses `https://localhost:4321`, `https: true`, cert in `~/.rspfx/certs`, workbench URL `https://<tenant>/_layouts/15/workbench.aspx?debugManifestsFile=https://localhost:4321/temp/manifests.js`.

`rspfx dev:vite` and `packages/plugin-dev/src/vite.ts:122` `config` only call `ensureCertificates` when `mode === 'sharepoint' && https`.

## Existing projects — no migration

`rspfx dev:vite` works in official SPFx projects without writing bundler config:

- `config/config.json` + `gulpfile.js`/`heft.json` → hybrid detection, synthesis, lean scaffold, dev on `vite`, production stays `gulp bundle && gulp package-solution`.

- `config/package-solution.json`, `serve.json`, `src/*/*.manifest.json` are read but not modified.

When you want full build/package on RSPFx, run `rspfx migrate --dry-run` then `rspfx migrate`.

See `docs/guide/migration/migrating-from-gulp-heft.md` and `docs/guide/migration/hybrid-dev.md`.

## Manual alternative

If you prefer to write `vite.config.ts` by hand, see `docs/guide/dev-plugin.md`.

Install `@mbsks/rspfx-plugin-dev` yourself and add `rspfxViteDev()` to `vite.config.ts`.

Then run `vite --port 4321` directly.

`rspfx dev:vite` is the same plugin with auto-scaffolding.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No vite.config found` before `dev:vite` | Run `rspfx dev:vite` — it generates the file |
| `ESM syntax in a file loaded as CommonJS` | `rspfx dev:vite` sets `type: module`; or rename to `vite.config.mts` |
| `Tsconfig not found .../includes/base.json` | Plugin stubs the base; use `--tsconfig` or run `rspfx migrate` to rewrite `tsconfig.json` |
| `Node 14 below required` | `nvm use 20` then `rspfx dev:vite` |
| `vite not installed` after scaffold | `bun install` / `npm install` then `vite` or `npm run dev:vite` |
| Cert `NET::ERR_CERT_AUTHORITY_INVALID` | `rspfx doctor --fix` and trust cert per `~/.rspfx/certs` instructions |

## Next steps

- `docs/guide/dev/dev-server.md` — local preview and workbench details
- `docs/guide/dev-plugin.md` — lean plugin API
- `docs/reference/commands.md#rspfx-devvite` — flag reference
- `docs/reference/compatibility.md` — Node/Vite/SPFx matrix
