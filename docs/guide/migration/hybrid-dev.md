# Hybrid dev

TL;DR: Run `rspfx dev` in an official SPFx project without changing any file. You get fast dev on port 4321 and keep Heft for production until you migrate.

Use this mode to trial RSPFx with zero risk. Dev uses RSPFx. Prod stays on Heft and gulp until `rspfx migrate`.

## When hybrid mode runs

Hybrid mode starts when all three are true:

- `config/config.json` exists.
- A file like `gulpfile.js`, `heft.json`, or `.yo-rc.json` exists.
- No RSPFx bundler config exists, such as `vite.config.ts` or `rspack.config.ts`.

If a bundler config exists, hybrid detection does not run.

When no config is found, `rspfx dev` builds one from `config/config.json` and `package.json`. You add no file by hand.

## What you can do in hybrid mode

| Command | Result |
|---|---|
| `rspfx dev` | serves workbench at `https://localhost:4321` or local preview at `http://localhost:4321` |
| `rspfx dev --refresh` | fast refresh where your framework supports it |
| `build`, `package`, `deploy`, `analyze` | refused - run `rspfx migrate` first |

Dev settings come from your files - `config/serve.json`, web parts from `src/webparts/*` or `config/config.json` bundles, and `sp-*` IDs from `node_modules`.

Synthesized config:

| Field | Source |
|---|---|
| `name` | `package.json` `name` |
| `version` | `package.json` `version` |
| `spfxVersion` | `@microsoft/sp-core-library` version or `1.24` default |
| `framework` | probe `react`, then `vue`, `svelte`, `preact`, `solid-js`, then `vanilla` |
| `language` | `typescript` |

## Try it now

Run from your official project:

```sh
rspfx dev
```

Compare `gulp serve` and `rspfx dev`. Both serve manifests on port 4321 and print a workbench URL.

No files are written. No deps change.

## Move to full RSPFx when ready

When you want builds via RSPFx:

```sh
rspfx migrate --dry-run
rspfx migrate
bun install
rspfx build
```

Same manifests drive both toolchains. See [Migrating from gulp and Heft](./migrating-from-gulp-heft.md).

Revert with `rspfx migrate --revert` or `git restore .`.

## Errors before migrate

- `OFFICIAL_TOOLCHAIN_BUILD` - prod commands are refused in hybrid mode.
- `OFFICIAL_SPFX_VERSION_UNSUPPORTED` - `sp-core-library` version not in [../../reference/compatibility.md](../../reference/compatibility.md).
- `OFFICIAL_SPFX_VERSION_UNKNOWN` - no `sp-core-library` dep.
- `OFFICIAL_DEPS_NOT_INSTALLED` - `node_modules/@microsoft/` missing.

## Limits

- No plugin options - dev uses `config/serve.json` and CLI flags only.
- Local preview bundles real `sp-*` if installed. Else it is externalized.

Install `sp-*` only if your code imports that runtime.

For cert help, see [Dev server](../dev/dev-server.md). For flags, see [../../reference/commands.md](../../reference/commands.md).
