# Migration case study: PnP Modern Search

TL;DR: A large SPFx solution with four web parts migrated to RSPFx with no `src/` edits and one SCSS fix. Build time dropped from minutes to about two seconds.

This case tracks [PnP Modern Search](https://github.com/microsoft-search/pnp-modern-search) v4.23.3 as seen in `examples/modern-search`. See [Migrating from gulp and Heft](./migrating-from-gulp-heft.md).

## Why this project

It is one of the largest open SPFx solutions. It tests the limits:

- 4 web parts, 178 TS files, 24 SCSS modules, about 42k lines.
- React 17, Fluent UI 8, PnPjs, Handlebars, Adaptive Cards, react-ace.
- 14 locales via `localizedResources`.
- Lazy chunks with `React.lazy` and `webpackChunkName`.
- Custom `spfx-customize-webpack.js` with 5 aliases.
- 16 Graph scopes in `webApiPermissionRequests`.
- One `pkg:@fluentui/...` SCSS import.

It has web parts only. Extensions and libraries also work in RSPFx now.

## Steps taken

<Steps>

### Step 1: Clone upstream

Clone `pnp-modern-search` at `search-parts` v4.23.3 with Heft rig and SPFx 1.23.0.

### Step 2: Run migration

- Drop 25 toolchain dev deps - Heft, rig, webpack, loaders.
- Rewrite `config/config.json` entrypoints from `./lib/...` to `./src/...` and rename bundle keys to folder names.
- Rewrite the one `pkg:` SCSS import to a relative `node_modules` path.
- Delete rig, sass, typescript, and customize-webpack configs.
- Write `rspack.config.ts` with `RspfxPlugin` and a plain `tsconfig.json`.

### Step 3: Install

Run `bun install`. Warm cache install took about 52 seconds.

### Step 4: Build

Run `rspfx build`. It handled:

- `*.html` imports as `asset/source`.
- Localized strings via `localizedResources` with `en-us` default.
- `pkg:` imports and module SCSS.

### Step 5: Package

Run `rspfx package`. It produced a valid `.sppkg` on first try with 213 entries, `AppManifest.xml` with 16 permissions, 4 `WebPart_<id>.xml` files, and `ClientSideAssets/` with bundles.

### Step 6: Serve

Run `rspfx dev`. Workbench at `https://localhost:4321` served 4 web parts. Bundles use AMD `define('<id>_<version>', …)`.

</Steps>

## Numbers

| Metric | Value |
|---|---|
| Source | 178 TS/TSX, 24 SCSS, about 42k lines |
| Toolchain dev deps removed | 25 |
| `src/` files edited | 0 |
| Prod build cold | about 2.1 s |
| `.sppkg` size | 2.7 MiB, 213 entries |
| Clone to green build | about 1 hour |

## Gaps found

| Gap | Fix |
|---|---|
| Multi locale switching | per locale AMD modules with `?locale=` preview |
| `pkg:` SCSS import | one line rewrite |
| Bundle name constraint | rename bundle keys to folder names |
| `spfx-customize-webpack.js` | 5 aliases not needed under Rspack |

## What stayed the same

- `src/webparts/**` - zero edits.
- `config/package-solution.json`, `config/serve.json`, `config/write-manifests.json` - read as is.
- `sharepoint/assets` and `teams/` - untouched.
- `@microsoft/sp-*` - kept at upstream versions.

## Replay

```sh
git clone https://github.com/microsoft-search/pnp-modern-search.git
cd pnp-modern-search/search-parts
node <rspfx-repo>/scripts/migrate-to-rspfx.mjs .
bun install
rspfx build && rspfx package
```

Or open `examples/modern-search` directly. It is the same source with RSPFx toolchain.

## Takeaway

For web part solutions with standard `config/` layout, migration is mechanical. You change config and add one bundler file. Build time drops by an order of scale.

See limits in [Why not to migrate](./why-not-to-migrate.md). For output details, see [../../reference/architecture.md](../../reference/architecture.md).
