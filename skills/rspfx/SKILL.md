---
name: rspfx
description: Build SharePoint Framework (SPFx) web parts, libraries, and extensions with RSPFX. Use for scaffolding (rspfx new), dev server, and packaging .sppkg. Unofficial toolchain.
---

# RSPFX — Fast SPFx Toolchain

Builds `sharepoint/solution/*.sppkg` without Heft/webpack/gulp. Vite is the default bundler.

Supports SPFx 1.20, 1.21, 1.22, 1.23, 1.24 (default 1.23), Node 20+, React/Vue/Solid and more.

Any other framework works via `FrameworkPreset` — see `docs/custom-framework.md`.

Docs: https://rspfx.mbsks.me · Repo: https://github.com/master8848/rspfx

## Install

```sh
npm i -g @mbsks/rspfx-cli
rspfx --version
rspfx --help
```

## New project — plugin-first

RSPFX is a Vite/Rsbuild/Rspack plugin. Scaffold with your favorite starter, then add the plugin. Vite is default.

```sh
npm create vite@latest my-app -- --template react-ts
cd my-app
npm i -D @mbsks/rspfx-plugin @mbsks/rspfx-cli
```

Add to `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default defineConfig({ plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.24' })] });
```

Then create `src/webparts/<name>/*.manifest.json` + `config/package-solution.json` (see `docs/project-structure.md`).

**Other starters:** `better-t-stack`, TanStack Router, `create-rsbuild`, etc. — same plugin pattern: `rspfxVite` for Vite, `rspfxRsbuild` for Rsbuild, `RSpfxPlugin` for Rspack. No extra code needed; RSPFX already supports all three. See `docs/getting-started.md`, `docs/commands.md#bundler-plugin`, `docs/frameworks.md`.

**Shortcut:** `rspfx new my-app --yes` (also `rspfx new my-app --framework react --spfx-version 1.24 --yes`) scaffolds Vite + manifests + `git init` for you. See `docs/commands.md#rspfx-new-name` for all flags (`--framework`, `--language`, `--spfx-version`, `--pm`, `--component`, `--bundler vite|rsbuild|rspack`).

## Existing project — migrate from Heft/gulp

```sh
rspfx migrate --dry-run   # preview
rspfx migrate             # writes vite.config.ts
npm install
npm run dev
```

Commit before migrating. Keeps `config/package-solution.json` and `src/*/*.manifest.json`; `gulpfile.js` can stay for dual builds.

See `docs/migrating-from-gulp-heft.md`.

## Develop and build

```sh
npm run dev                                          # http://localhost:4321
npm run dev -- --tenant https://contoso.sharepoint.com
rspfx build; rspfx package                           # → sharepoint/solution/*.sppkg
rspfx doctor; rspfx doctor --fix                     # validate env + cert
```

Dev server is on `:4321`.

Set tenant in `vite.config.ts` (`dev.tenantUrl`), via `--tenant`, or `SPFX_SERVE_TENANT_DOMAIN` env var.

See `docs/getting-started.md` and `docs/commands.md`.

No `@microsoft/sp-*` install needed — `spfxVersion` externalizes them.

## Configuration — plugin for any starter

Vite is default (most popular). Any Vite starter works — `create-vite`, `better-t-stack`, TanStack Router — just add `rspfxVite()`.

```ts
import { defineConfig } from 'vite';
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default defineConfig({
  plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.24' })],
});
```

Rsbuild (`rspfxRsbuild` in `rsbuild.config.ts`) and Rspack (`RSpfxPlugin` in `rspack.config.ts`) are also supported — same options, same manifests. See `docs/commands.md#bundler-plugin`, `docs/getting-started.md`, `docs/frameworks.md`. No extra codebase changes needed — `packages/plugin/src/vite.ts`, `packages/plugin/src/rsbuild.ts`, `packages/plugin/src/rspack.ts` already ship all three.

## Styling

SPFx requires CSS bundled into JS.

```sh
npm add -D sass
```

Then import `*.scss`/`*.css` directly. See `docs/styling.md`.

## Query lists

```sh
npm add @pnp/sp @pnp/graph
```

In `onInit`: `spfi().using(SPFx(this.context))`, then `sp.web.lists.getByTitle("MyList").items()`.

See https://pnp.github.io/pnpjs/

## Teams, multi-webpart, assets

One `.sppkg` syncs `teams/manifest.json` for Teams/Outlook.

Multi-webpart: duplicate `src/webparts/<name>/` with a new `id` in `*.manifest.json` — see `docs/multi-webpart.md`.

## Tips

- 404 on dev → `config/config.json` bundle key doesn't match `src/webparts/<name>/` folder.
- Share tenant across projects: `export SPFX_SERVE_TENANT_DOMAIN=https://contoso.sharepoint.com` in `~/.zshrc`.
