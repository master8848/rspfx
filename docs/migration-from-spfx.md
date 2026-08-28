# Migrating an existing SPFx project to RSPFX

RSPFX mirrors official SPFx conventions, so most of an existing project carries over as-is. See Microsoft docs: [SharePoint Framework toolchain](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/sharepoint-framework-toolchain) and [SharePoint Framework overview](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/sharepoint-framework-overview).

> For the full step-by-step see [migrating-from-gulp-heft.md](migrating-from-gulp-heft.md); for a real example see [migration-case-study.md](migration-case-study.md); for blockers see [why-not-to-migrate.md](why-not-to-migrate.md).

## What's reused

| Item | Notes |
|---|---|
| `src/` | `src/webparts/<name>/` — classes, `*.manifest.json`, components, styles — unchanged |
| `config/package-solution.json` | `id`, `version`, `features`, `includeClientSideAssets`, `paths.zippedPackage` — read directly |
| `config/serve.json` | `initialPage` (with `{tenantdomain}`), `https`, `port`, `hostname` — read directly |
| `config/config.json` | `bundles`, `externals`, `localizedResources` — honored by dev and build |
| `sharepoint/` | Solution assets — unchanged |
| `@microsoft/sp-*` | Externalized — install only if your code imports that runtime |

## What's removed

- `gulpfile.js` — `gulp serve` / `bundle` / `package-solution` gone.
- Heft rig — `@rushstack/heft`, `heft.json`, rig `tsconfig` extends; `tsconfig.json` becomes plain swc config.
- Build devDependencies — `@microsoft/spfx-heft-plugins`, `@microsoft/sp-build-web`, `gulp`, `webpack` and loaders.
- `config/deploy-azure-storage.json` — replaced by `config/write-manifests.json` `cdnBasePath`.

## Same manifest for Heft/Gulp and RSPFX

`config/config.json`, `config/package-solution.json`, and `src/*/*.manifest.json` are identical for Heft/Gulp and RSPFX.

See [migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx](migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx) and [hybrid-dev.md](hybrid-dev.md) for switching and revert.

## Steps

### 1. Preview and migrate

```sh
npm i -g @mbsks/rspfx-cli   # or pnpm add -g / yarn global add / bun add -g / deno install -g
rspfx migrate --dry-run     # preview
rspfx migrate               # or --bundler vite | rspack | rsbuild — writes bundler config, backs up to .rspfx/migrate-backup.json
bun install      # or pnpm install / npm install / yarn / deno install
```

Bundler config is optional — without it `rspfx dev` and `rspfx build` synthesize config from manifests and run Vite, Rsbuild, or Rspack directly.

> **Tip:** No manual `@microsoft/sp-*` install for most web parts — externalized as `"type": "component"` so SharePoint resolves its built-in copies.

> **Tip:** Commit first so `git diff` shows exact changes; dry-run is safe to repeat.

### 2. Dev

```sh
rspfx dev   # workbench at https://localhost:4321 (SharePoint mode) or http://localhost:4321 (local preview)
```

Trust the cert at `~/.rspfx/certs` once — see [getting-started.md#cert-trust](getting-started.md#cert-trust).

Fix any drift:

- **Externals:** `sp-*` not in `config.json` `externals` → add it; production must never bundle `sp-*` (automatic, no install needed).
- **Version:** `spfxVersion` must match any installed `sp-*` pins; `version: "*"` in manifests is replaced by `package.json` version.
- **Localization:** `localizedPath` resources and `assets/` are picked up from the manifest as before.

### 3. Package

```sh
rspfx package   # → sharepoint/solution/<name>.sppkg → upload to app catalog → add to page
```

See [building-packages.md](building-packages.md) for outputs and [deployment.md](deployment.md) for catalog steps.

`bun run package` (or `pnpm` / `npm` / `yarn` `run package`) works identically (zero-config).

### 4. Revert if needed

```sh
rspfx migrate --revert   # or git restore . && git clean -fd .rspfx && bun install (or pnpm / npm / yarn)
```

### 5. Upgrade SPFx target (optional)

Change one field in the generated config and update:

```sh
# spfxVersion: '1.24' in vite.config.ts / rspack.config.ts / rsbuild.config.ts
bun update @mbsks/rspfx-plugin   # or pnpm update / npm update / yarn upgrade
```

See [upgrading-spfx-version.md](upgrading-spfx-version.md) — verify with `rspfx doctor`, `rspfx build`, `rspfx package`.

## Comparison vs official

| Area | Official | RSPFX |
|---|---|---|
| Config | Heft rig + `gulpfile.js` + webpack | One plugin in `vite.config.ts` / `rspack.config.ts` / `rsbuild.config.ts` (or zero-config) |
| Dev server | `gulp serve` on `:4321` + spfx-fast-serve | `rspfx dev` on `:4321` — `https://localhost:4321` (workbench) or `http://localhost:4321` (local preview) |
| Build | `gulp bundle --ship` | `rspfx build` |
| Package | `gulp package-solution --ship` | `rspfx package` |
| Manifests | Same files | Same files — no fork |

## Known gaps

- **No gulp task ecosystem** — arbitrary gulp tasks have no equivalent; use `plugin-api` hooks (`compilerHooks`, `packageHooks`) for scriptable extensions.
- **Other frameworks** — no built-in preset; any framework works via one-file `FrameworkPreset` + `BaseWebPart` registered with `definePlugin`/`registerPlugin` — no CLI fork — see [custom-framework.md](custom-framework.md).
- **React 18/19 dual environment** — React bundled per web part (official behavior); check for conflicts on legacy tenant pages.
