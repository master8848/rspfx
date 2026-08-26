# Migrating an existing SPFx project to RSPFX

RSPFX intentionally mirrors official SPFx project conventions, so most of an existing project carries over as-is.

> **Guides:** for the full step-by-step see [migrating-from-gulp-heft.md](migrating-from-gulp-heft.md); a real migration of the PnP Modern Search solution is documented in [migration-case-study.md](migration-case-study.md); read [why-not-to-migrate.md](why-not-to-migrate.md) before you start — extensions, Angular, and library components are not supported yet.

## What's reused

| Item | Notes |
|---|---|
| `src/` | `src/webparts/<name>/` — web part classes, `*.manifest.json` component manifests, components, styles — moved unchanged |
| `config/package-solution.json` | Solution metadata: id, version, features, `includeClientSideAssets`, `paths.zippedPackage` — read directly |
| `config/serve.json` | `initialPage` (with `{tenantdomain}` token), `https`, `port`, `hostname` — read directly |
| `config/config.json` | `bundles` (entrypoint + manifest per web part) and `externals` maps are honored by the dev runtime |
| `sharepoint/` | Solution assets, including the `sharepoint/solution/` output location |
| `@microsoft/sp-*` dependencies | Externalized and handled internally for most web parts — install only if your code imports that runtime |

## What's removed

- **`gulpfile.js`** — no more `gulp serve` / `gulp bundle` / `gulp package-solution`.
- **Heft rig** — `@microsoft/rush-stack-compiler-*`, `heft.json`, rig `tsconfig` extends; `tsconfig.json` becomes a plain Rspack/swc-driven config.
- **spfx-heft-* / sp-build-* dev dependencies** — `@microsoft/spfx-heft-plugins`, `@microsoft/sp-build-web`, `gulp`, `gulp-*` plugins, `webpack`/`webpack-*` if present.
- **`config/deploy-azure-storage.json`** (CDN deploy) — replaced by `config/write-manifests.json` `cdnBasePath` for release base URLs.

## Same manifest for Heft/Gulp and RSPFX

`config/config.json`, `config/package-solution.json`, and `src/*/*.manifest.json` are identical for both toolchains. See [migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx](migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx) for switching and revert (`rspfx migrate --revert` or `git restore` / `.rspfx/migrate-backup.json`).

## Steps

1. **Install the CLI**

   ```sh
   npm i -g @mbsks/rspfx-cli
   ```

2. **Migrate** — preview then apply (backs up to `.rspfx/migrate-backup.json`):

   ```sh
   rspfx migrate --dry-run
   rspfx migrate             # or rspfx migrate --bundler vite
   bun install
   ```

   Bundler config is optional — `rspfx migrate` writes `vite.config.ts` by default (or `rspack.config.ts` / `rsbuild.config.ts` with `--bundler rspack|rsbuild`), but you can also run zero-config where `bun run build` / `rspfx dev` synthesize the config from the manifests and run Vite/Rspack internally.

> **Quick way:** `rspfx migrate --dry-run` → `rspfx migrate` → `bun install` → `rspfx dev`. No hand-editing of configs.

> **Tip:** No manual `@microsoft/sp-*` install is needed for most web parts — the toolchain externalizes them and emits `"type": "component"` entries so SharePoint resolves its built-in copies. Install `sp-*` only if your code imports that runtime.

3. **Dev** — `rspfx dev`, trust the `~/.rspfx/certs` cert once, and iterate in the workbench exactly as with `gulp serve`. Fix any drift found:

   - **Externals drift:** if a sp-* package isn't in `config/config.json` `externals`, add it; production output must never bundle sp-* code (externalization is automatic — no manual install needed for it to take effect).
   - **Config drift:** `spfxVersion` must match any installed `@microsoft/sp-*` versions; component-manifest `version: "*"` is replaced by the `package.json` version, and sp-* dependency ids/versions are harvested from `node_modules` when present with fallback to `reference/sp-component-ids.json`.
   - **Localization/assets:** `localizedPath` resources and `assets/` folders are picked up from the manifest as before.

4. **Package** — `rspfx package` → `sharepoint/solution/<name>.sppkg` → upload to the app catalog → add to a page. See [building-packages.md](building-packages.md) for the artifact anatomy and CI usage. `bun run build` works identically zero-config.

5. **Revert if needed** — `rspfx migrate --revert` restores from `.rspfx/migrate-backup.json`, or `git restore .` if the branch was clean.

## Known gaps

- **No gulp task ecosystem.** Arbitrary gulp tasks (custom bundling pipelines, release automation hooks) have no equivalent. RSPFX exposes compiler/package hooks via `plugin-api` (`compilerHooks`, `packageHooks`) for scriptable extensions.
- **Extensions deferred.** `ApplicationCustomizer` and `ListViewCommandSet` (application extensions) are out of scope while the web part path matures; the manifest/loaderConfig machinery is designed not to preclude them later.
- **Angular not supported.** Angular web parts need a separate AOT compiler pipeline; it was removed from the roadmap and is not planned.
- **React 18/19 dual environment.** Bundle React per web part (official behavior); check for React version conflicts on legacy tenant pages.
