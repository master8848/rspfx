# Migrating an existing SPFx project to RSPFX

RSPFX intentionally mirrors official SPFx project conventions, so most of an
existing project carries over as-is.

> **Guides:** for the full step-by-step (including the automated migration
> script) see [migrating-from-gulp-heft.md](migrating-from-gulp-heft.md); a
> real migration of the PnP Modern Search solution is documented in
> [migration-case-study.md](migration-case-study.md); read
> [why-not-to-migrate.md](why-not-to-migrate.md) before you start —
> extensions, Angular, and library components are not supported yet.

## What's reused

| Item | Notes |
|---|---|
| `src/` | `src/webparts/<name>/` — web part classes, `*.manifest.json` component manifests, components, styles — moved unchanged |
| `config/package-solution.json` | Solution metadata: id, version, features, `includeClientSideAssets`, `paths.zippedPackage` — read directly |
| `config/serve.json` | `initialPage` (with `{tenantdomain}` token), `https`, `port`, `hostname` — read directly |
| `config/config.json` | `bundles` (entrypoint + manifest per web part) and `externals` maps are honored by the dev runtime |
| `sharepoint/` | Solution assets, including the `sharepoint/solution/` output location |
| `@microsoft/sp-*` dependencies | Stay as direct dependencies, pinned to your SPFx target |

## What's removed

- **`gulpfile.js`** — no more `gulp serve` / `gulp bundle` / `gulp package-solution`.
- **Heft rig** — `@microsoft/rush-stack-compiler-*`, `heft.json`, rig
  `tsconfig` extends; `tsconfig.json` becomes a plain Rspack/swc-driven config.
- **spfx-heft-* / sp-build-* dev dependencies** — `@microsoft/spfx-heft-plugins`,
  `@microsoft/sp-build-web`, `gulp`, `gulp-*` plugins, `webpack`/`webpack-*` if
  present.
- **`config/deploy-azure-storage.json`** (CDN deploy) — replaced by
  `config/write-manifests.json` `cdnBasePath` for release base URLs.
- **`rspfx.config.ts`** — the legacy project config file is removed; no legacy
  support. `config/config.json` keeps its official role (bundles/externals are
  still read from there).

## Steps

1. **Install the CLI**

   ```sh
   npm i -g @mbsks/rspfx-cli
   ```

2. **Remove gulp/Heft dependencies** from `package.json` and reinstall
   (`pnpm install`). Keep `@microsoft/sp-*` packages at your SPFx version.

3. **Add `rspack.config.ts` with the `RspfxPlugin`**

   ```ts
   import { RspfxPlugin } from '@mbsks/rspfx-plugin';

   export default {
     mode: 'development',
     plugins: [
       new RspfxPlugin({
         name: 'my-app',
         framework: 'react',
         spfxVersion: '1.22',
         dev: { tenantUrl: 'https://contoso.sharepoint.com' },
       }),
     ],
   };
   ```

   `@mbsks/rspfx-plugin` is a devDependency.

4. **Dev** — `rspfx dev`, trust the `~/.rspfx/certs` cert once, and iterate in
   the workbench exactly as with `gulp serve`. Fix any drift found:

   - **Externals drift:** if a sp-* package isn't in `config/config.json`
     `externals`, add it; production output must never bundle sp-* code.
   - **Config drift:** `spfxVersion` must match the installed `@microsoft/sp-*`
     versions; component-manifest `version: "*"` is replaced by the package.json
     version, and sp-* dependency ids/versions are harvested from node_modules.
   - **Localization/assets:** `localizedPath` resources and `assets/` folders are
     picked up from the manifest as before.

5. **Package** — `rspfx package` → `sharepoint/solution/<name>.sppkg` → upload to
   the app catalog → add to a page. See [building-packages.md](building-packages.md)
   for the artifact anatomy and CI usage.

## Known gaps

- **No gulp task ecosystem.** Arbitrary gulp tasks (custom bundling pipelines,
  release automation hooks) have no equivalent. RSPFX exposes compiler/package
  hooks via `plugin-api` (`compilerHooks`, `packageHooks`) for scriptable
  extensions.
- **Extensions deferred.** `ApplicationCustomizer` and `ListViewCommandSet`
  (application extensions) are out of scope while the web part path matures; the
  manifest/loaderConfig machinery is designed not to preclude them later.
- **Angular deferred.** Angular web parts need a separate AOT compiler pipeline
  and are not yet supported (see roadmap M6).
- **React 18/19 dual environment.** Bundle React per web part (official
  behavior); check for React version conflicts on legacy tenant pages.
