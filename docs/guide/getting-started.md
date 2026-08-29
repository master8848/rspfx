# Getting started

TL;DR: You install the CLI, create a project, run the dev server on port 4321, and package a `.sppkg`. These four steps take you from zero to a working web part.

This guide uses Vite and React. You can swap the bundler or framework later. See [Choosing a framework](./frameworks/choosing-a-framework.md).

<Steps>

## Step 1: Install the CLI

Install Node 20 or later. Then install the RSPFx CLI with your package manager.

```sh
npm i -g @mbsks/rspfx-cli
rspfx --version
```

You can also use `pnpm add -g`, `yarn global add`, `bun add -g`, or `deno install -g`.

You do not need `@microsoft/sp-*` for most web parts. Install them only if your code imports that runtime, such as `@microsoft/sp-http`.

For flags, see [../reference/commands.md](../reference/commands.md).

## Step 2: Create a project

Create a Vite app, then add the RSPFx plugin. You can use any Vite starter.

```sh
npm create vite@latest my-app -- --template react-ts
cd my-app
npm i -D @mbsks/rspfx-plugin @mbsks/rspfx-cli
```

Add the plugin to `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default defineConfig({ plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.24' })] });
```

Add SPFx manifests: `src/webparts/<name>/<name>.manifest.json`, `src/webparts/<name>/<name>WebPart.ts`, and `config/package-solution.json`. See [../reference/project-structure.md](../reference/project-structure.md).

Other bundlers use the same pattern:

```ts
// rsbuild.config.ts
import { rspfxRsbuild } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxRsbuild({ name: 'my-app', framework: 'react', spfxVersion: '1.24' })] };
```

```ts
// rspack.config.ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';
export default { plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react', spfxVersion: '1.24' })] };
```

You can also scaffold with the CLI:

```sh
rspfx new my-app
rspfx new my-app --framework react --spfx-version 1.22 --yes
```

For existing Heft and gulp projects, add one file with `devTryMode: true` and install two packages to try dev without migrating. See [Try mode](./try-mode.md).

To migrate fully, run `rspfx migrate --dry-run` to preview changes. See [Migration from SPFx](./migration/migration-from-spfx.md).

## Step 3: Run the dev server

Start the dev server on port 4321:

```sh
rspfx dev
rspfx dev --refresh
```

RSPFx picks the mode based on tenant config:

| Mode | When | URL |
|---|---|---|
| Local preview | no tenant set | `http://localhost:4321/` |
| SharePoint workbench | tenant set | `https://localhost:4321` |

Local preview shows a list of web parts. It serves mock `/_api` data from `local/data.json` and bundles at `/dist/*`.

SharePoint workbench mode prints a URL like `https://<tenant>/_layouts/15/workbench.aspx?debugManifestsFile=https://localhost:4321/temp/manifests.js`. Open it to load your bundles in SharePoint.

Set the tenant with `dev.tenantUrl` in config, with `SPFX_SERVE_TENANT_DOMAIN`, or with `rspfx dev --tenant https://contoso.sharepoint.com`.

Use local preview for UI work. Use workbench mode for SharePoint APIs, property pane, or theme.

### Trust the cert for workbench mode

Workbench mode needs HTTPS. RSPFx creates a cert in `~/.rspfx/certs` on first run.

Trust it once per machine, then restart your browser:

```sh
# macOS
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.rspfx/certs/cert.pem
# Windows
certutil -addstore -user Root %USERPROFILE%\.rspfx\certs\cert.pem
# Linux: import ~/.rspfx/certs/cert.pem into your browser
```

If you see a blank page, check cert trust. Run `rspfx doctor` to verify. See [Dev server](./dev/dev-server.md) and [../reference/commands.md](../reference/commands.md).

Save a file to rebuild. Use `rspfx dev --refresh` to preserve state where supported. See [Fast refresh](./styling/fast-refresh.md).

## Step 4: Build and package

Build and package your solution:

```sh
rspfx build
rspfx package
```

`rspfx build` outputs `dist/` and `release/`. `rspfx package` creates `sharepoint/solution/<name>.sppkg`.

Upload the `.sppkg` to the app catalog or run `rspfx deploy` with a token. See [Deployment guide](./deployment-guide.md).

You can revert manifests with `rspfx migrate --revert` or `git restore`. Run `rspfx doctor` to validate Node, manifests, and cert.

</Steps>
