# Getting Started

Build SharePoint web parts without gulp + webpack. Same `.sppkg`, much faster. See Microsoft docs: [SharePoint Framework overview](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/sharepoint-framework-overview) and [Set up your development environment](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/set-up-your-development-environment).

## 1. Install

Node 20+ and your package manager — bun, pnpm, npm, yarn, or deno.

```sh
npm i -g @mbsks/rspfx-cli   # or pnpm add -g @mbsks/rspfx-cli / yarn global add @mbsks/rspfx-cli / bun add -g @mbsks/rspfx-cli / deno install -g npm:@mbsks/rspfx-cli
rspfx --version
```

> **Tip:** You don't need `@microsoft/sp-*` for most web parts — RSPFx externalizes them. Install only if you import that runtime (e.g. `@microsoft/sp-http`).

## 2. Create a project

RSPFx is a plugin — scaffold with your favorite starter, then add the plugin. Vite is the default (most popular), Rsbuild/Rspack also work. Any Vite starter is fine (`create-vite`, `better-t-stack`, TanStack Router, etc.) — just add `rspfxVite()`.

**Recommended — bring your own scaffold (Vite):**

```sh
npm create vite@latest my-app -- --template react-ts   # or pnpm create vite@latest / yarn create vite@latest / bun create vite@latest / deno run -A npm:create-vite@latest
cd my-app
npm i -D @mbsks/rspfx-plugin @mbsks/rspfx-cli           # or pnpm add -D / yarn add -D / bun add -D / deno add -D
```

Add the plugin to `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default defineConfig({ plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.24' })] });
```

Then add SPFx manifests (`src/webparts/<name>/<name>.manifest.json`, `src/webparts/<name>/<name>WebPart.ts`, `config/package-solution.json`). See [project-structure.md](project-structure.md).

**Other starters:** same idea — scaffold with `better-t-stack`, `create-rsbuild`, or any Vite/Rsbuild/Rspack starter, then add the corresponding plugin:

```ts
// Rsbuild: rsbuild.config.ts
import { rspfxRsbuild } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxRsbuild({ name: 'my-app', framework: 'react', spfxVersion: '1.24' })] };
// Rspack: rspack.config.ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';
export default { plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react', spfxVersion: '1.24' })] };
```

See [commands.md#bundler-plugin](commands.md#bundler-plugin) and [project-structure.md](project-structure.md).

**Shortcut — CLI scaffold:**

```sh
rspfx new my-app                # interactive
rspfx new my-app --framework react --spfx-version 1.22 --yes  # CI
```

`rspfx new` is a convenience wrapper that does the same (writes `vite.config.ts` + manifests). Flags: `--bundler vite|rsbuild|rspack` (default `vite`), `--yes` accepts defaults. See [commands.md#rspfx-new-name](commands.md#rspfx-new-name).

For existing Heft/Gulp projects, preview with `rspfx migrate --dry-run`. See [hybrid-dev.md](hybrid-dev.md).

## 3. Dev server on :4321

```sh
rspfx dev
rspfx dev --refresh   # state-preserving refresh where supported
```

Port `4321` is the single dev port. Mode is picked by whether a tenant is configured:

| Mode | When | URL | Cert |
|---|---|---|---|
| **Local preview** | No tenant | `http://localhost:4321/` | None (HTTP) |
| **SharePoint workbench** | Tenant set | `https://localhost:4321` | Self-signed in `~/.rspfx/certs` |

Local preview: browse `http://localhost:4321/` — lists every web part, mock `/_api` from `local/data.json`, bundles at `/dist/*`, manifests at `/temp/manifests.js`.

Workbench: RSPFx prints `https://<tenant>/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=<encoded https://localhost:4321/temp/manifests.js>` — SharePoint loads bundles from `https://localhost:4321/dist/*`. See Microsoft docs: [Serve your web part in a workbench](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/web-parts/get-started/serve-your-web-part-in-a-workbench) and [Use the Workbench](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/tools/workbench).

Set tenant via `dev.tenantUrl` in config, `SPFX_SERVE_TENANT_DOMAIN` env var, or `rspfx dev --tenant https://contoso.sharepoint.com`. See [commands.md#rspfx-dev](commands.md#rspfx-dev).

> **Tip:** Put `tenantUrl` in `vite.config.ts` (`dev: { tenantUrl: 'https://contoso.sharepoint.com' }`) so teammates don't need flags.

> **Tip:** Use local preview for rapid UI work (no cert, no tenant). Switch to workbench only for real SharePoint APIs, property pane, or theme.

### Cert trust (SharePoint mode only)

Workbench mode needs HTTPS. `rspfx dev` auto-generates a cert in `~/.rspfx/certs` on first run. If untrusted, the workbench shows `NET::ERR_CERT_AUTHORITY_INVALID` or a blank page.

Trust once per machine, then restart the browser:

- macOS: `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.rspfx/certs/cert.pem`
- Windows: `certutil -addstore -user Root %USERPROFILE%\.rspfx\certs\cert.pem`
- Linux: import `~/.rspfx/certs/cert.pem` into the browser store.

Chrome 142+ also prompts for Local Network Access — allow it. Verify with `rspfx doctor` / fix with `rspfx doctor --fix`. See [commands.md#rspfx-doctor](commands.md#rspfx-doctor).

### Editing

Save → rebuild → auto-reload. Dev builds are unminified; `rspfx build` minifies. See [fast-refresh.md](fast-refresh.md).

> **Tip:** If `Load debug scripts` reappears every reload, check cert trust or Local Network Access — it should show once per session.

## 4. Build and package

```sh
rspfx build      # → dist/ + release/
rspfx package    # → sharepoint/solution/<name>.sppkg
```

Upload the `.sppkg` to the app catalog or use `rspfx deploy` (needs token). See [deployment.md](deployment.md) and Microsoft docs: [Package and deploy SPFx solutions](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/toolchain/package-and-deploy).

`config/config.json`, `config/package-solution.json`, and manifests work for both toolchains — revert with `rspfx migrate --revert` or `git restore`. See [migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx](migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx).

Run `rspfx doctor` to validate Node 20+, manifests, `sp-*` externals, and cert. See [commands.md#rspfx-doctor](commands.md#rspfx-doctor).
