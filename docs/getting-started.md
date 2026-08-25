# Getting Started

Build SharePoint web parts without gulp + webpack. Same `.sppkg`, much faster.

## 1. Install

Node 20+ and Bun (npm/yarn/pnpm also work).

```sh
npm i -g @mbsks/rspfx-cli
rspfx --version
```

> You don't need `@microsoft/sp-*` for most web parts. They are externalized — SharePoint loads its copies. Install only if you import that runtime (e.g. `@microsoft/sp-http`).

## 2. Create a project

```sh
rspfx new my-app
```

Picks framework, language, SPFx version, then installs.

CI / non-interactive:

```sh
rspfx new my-app --framework react --spfx-version 1.22 --yes
rspfx new my-app --framework react --bundler vite --yes
```

`--no-install` skips install. `--bundler vite|rsbuild|rspack` picks the bundler (default `vite`).

### Layout

```
my-app/
├── vite.config.ts              # optional — omit for zero-config
├── package.json
├── src/webparts/<name>/
│   ├── <name>.manifest.json
│   ├── <name>WebPart.ts
│   ├── components/
│   └── styles/
├── config/
│   ├── package-solution.json
│   ├── serve.json
│   └── write-manifests.json
└── local/data.json             # optional — mock REST data for preview
```

All paths are defaults. Change them via `paths` in the plugin options. See [project-structure.md](project-structure.md).

### Bundler config is optional

For standard layouts, skip `vite.config.ts` / `rsbuild.config.ts` / `rspack.config.ts`. The CLI builds the config from `config/config.json` + `package.json` and runs Vite or Rspack directly.

When you want control, add one plugin:

```ts
// vite.config.ts — optional
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.23' })] };
```

If the file is missing, the same manifests drive the build. Run `rspfx migrate` to write it, or stay zero-config. See [hybrid-dev.md](hybrid-dev.md).

> `rspfx new` already writes the config. For an existing Heft/Gulp project run `rspfx migrate --dry-run` first.

## 3. Dev

```sh
rspfx dev
```

No tenant: `http://localhost:4321` — preview at `/`, bundles at `/dist/*`, manifests at `/temp/manifests.js`, mock `/_api`.

With tenant (`dev.tenantUrl`, `SPFX_SERVE_TENANT_DOMAIN`, or `--tenant`): `https://localhost:4321` + workbench.

`rspfx dev --refresh` enables fast refresh where supported. See [commands.md](commands.md) and [fast-refresh.md](fast-refresh.md).

### Workbench URL

```
<tenantUrl>/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=<encoded https://localhost:4321/temp/manifests.js>
```

SharePoint loads bundles from `https://localhost:4321/dist/*`.

Tell RSPFX your tenant via `dev.tenantUrl` in the config, `SPFX_SERVE_TENANT_DOMAIN`, or `rspfx dev --tenant https://contoso.sharepoint.com`.

### Cert trust (SharePoint mode only)

Local preview needs no cert. Workbench mode uses a self-signed cert in `~/.rspfx/certs` (825 days). Trust it once:

- macOS: Keychain Access → System → import → Always Trust.
- Windows: `certutil -addstore Root <cert>`.
- Chrome 142+: allow Local Network Access when prompted.

`rspfx doctor` checks the rest. See [getting-started.md#load-debug-scripts-dialog](getting-started.md#load-debug-scripts-dialog) for the cert file location.

### Load debug scripts

SharePoint shows it once per session (`sessionStorage` key `spfx-debug`). RSPFX reloads in the same tab so it doesn't reappear. Clear with `?reset=true` or close the tab.

If it shows every reload, check cert trust or Chrome Local Network Access.

### Editing

Save → rebuild → auto reload. Dev builds are unminified. `rspfx build` minifies.

## 4. Build and package

```sh
rspfx build      # → dist/ + release/
rspfx package    # → sharepoint/solution/<name>.sppkg
bun run build    # also works — same manifests
```

Upload the `.sppkg` to the app catalog, deploy, add to a site. `rspfx deploy` automates it; without a token it prints manual steps. See [deployment.md](deployment.md).

## 5. Same manifest for both toolchains

`config/config.json`, `config/package-solution.json`, `src/*/*.manifest.json` work for Heft/Gulp and RSPFX. Switch with `rspfx migrate --revert` or `git restore`. See [migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx](migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx).

## 6. Doctor

```sh
rspfx doctor
```

Checks Node 20+, manifests, framework, sp-* externals, bundles, port, outDir. Exit 1 on fail — use in CI.
