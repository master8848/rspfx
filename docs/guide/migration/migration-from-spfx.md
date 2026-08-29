# Migration from SPFx

TL;DR: You can move an existing SPFx project to RSPFx and keep your `src/`, manifests, and `package-solution.json`. Run `rspfx migrate` and rebuild.

This guide is the short path. For the full checklist, see [Migrating from gulp and Heft](./migrating-from-gulp-heft.md).

## What you keep

| Item | Status |
|---|---|
| `src/` | unchanged - classes, manifests, components, styles |
| `config/package-solution.json` | read directly |
| `config/serve.json` | read directly |
| `config/config.json` | honored - entrypoints rewritten from `./lib/` to `./src/` |
| `sharepoint/` | unchanged |
| `@microsoft/sp-*` | externalized - keep only if you import that runtime |

## What you remove

- `gulpfile.js` and Heft rig - `gulp serve`, `heft.json`, rig extends, `tsconfig` rig extends.
- Toolchain dev deps - `heft`, `spfx-heft-plugins`, `sp-build-web`, `gulp`, `webpack`, loaders.
- Heft configs - `config/rig.json`, `config/typescript.json`, `config/sass.json`, `config/deploy-azure-storage.json`.

<Steps>

## Step 1: Preview and migrate

Install the CLI, preview, then apply:

```sh
npm i -g @mbsks/rspfx-cli
rspfx migrate --dry-run
rspfx migrate
bun install
```

Pick a bundler with `--bundler vite`, `rspack`, or `rsbuild`. Default is Vite. The command backs up to `.rspfx/migrate-backup.json`.

You can run `rspfx dev` with no bundler file after migrate. RSPFx can synthesize config from manifests.

Commit before you migrate so `git diff` shows the changes. Dry run is safe to repeat.

## Step 2: Run dev

Start the dev server and check each web part:

```sh
rspfx dev
```

Trust the cert at `~/.rspfx/certs` once. See [Getting started](../getting-started.md) and [Dev server](../dev/dev-server.md).

Fix drift if needed:

- Externals: add missing `sp-*` entries to `externals` when production would bundle them.
- Version: keep `spfxVersion` equal to any installed `sp-*` pins.
- Localized resources: check `localizedPath` and `assets/` as before.

## Step 3: Package

Build and package:

```sh
rspfx package
```

This creates `sharepoint/solution/<name>.sppkg`. Upload it to the app catalog. See [Deployment guide](../deployment-guide.md).

You can run `bun run package` or the equivalent for your manager. Zero config works here too.

## Step 4: Revert if needed

Restore the backup or your git branch:

```sh
rspfx migrate --revert
```

Or:

```sh
git restore .
git clean -fd .rspfx
bun install
```

## Step 5: Upgrade SPFx target when ready

Change `spfxVersion: '1.24'` in your bundler config, then update:

```sh
bun update @mbsks/rspfx-plugin
```

Verify with `rspfx doctor`, `rspfx build`, and `rspfx package`. See [Upgrading SPFx version](./upgrading-spfx-version.md).

</Steps>

## Known gaps

- No gulp task ecosystem - use `plugin-api` hooks `compilerHooks` and `packageHooks` for scripting.
- Other frameworks need a preset - add a `FrameworkPreset` and `BaseWebPart` with `definePlugin` and `registerPlugin`. See [Custom framework guide](../frameworks/custom-framework-guide.md).
- React is bundled per web part - check for skew on older tenant pages.

For flags and behavior, see [../../reference/commands.md](../../reference/commands.md).
