# Try RSPFx in an existing project

TL;DR: Add one config file and install two packages. Run `rspfx dev` alongside your current gulp and Heft setup. No files change and no migration is needed to try.

You keep `gulp serve`, `gulp bundle`, and `heft build` working. RSPFx runs only for dev and leaves production untouched.

## When to use this

Use try mode when you want to evaluate RSPFx without committing to a migration.

Keep it when gulp and Heft still build your `.sppkg` for production.

Move to full migration only after dev works the way you want.

## How it works

Try mode uses `devTryMode: true` in your bundler config. It tells RSPFx to synthesize manifests from your `tryComponents` list instead of reading `config/config.json` bundles.

Your existing `config/config.json`, `config/package-solution.json`, and `*.manifest.json` stay as they are. Gulp and Heft continue to read them.

RSPFx dev reads `tryComponents` and builds synthetic manifests in memory. It generates deterministic IDs from component names and maps entries you specify.

## One file and two installs

You need one new file and two dev dependencies. Everything else stays as is.

### 1. Install two packages

Run this in your existing SPFx project root:

```sh
npm i -D @mbsks/rspfx-plugin @mbsks/rspfx-cli
```

Other managers work the same:

```sh
pnpm add -D @mbsks/rspfx-plugin @mbsks/rspfx-cli
bun add -D @mbsks/rspfx-plugin @mbsks/rspfx-cli
yarn add -D @mbsks/rspfx-plugin @mbsks/rspfx-cli
deno add -D npm:@mbsks/rspfx-plugin npm:@mbsks/rspfx-cli
```

### 2. Add one file — `vite.config.ts`

Create `vite.config.ts` at the project root:

```ts
import { defineConfig } from 'vite';
import { rspfxVite } from '@mbsks/rspfx-plugin';

export default defineConfig({
  plugins: [
    rspfxVite({
      name: 'my-project',
      framework: 'react',
      spfxVersion: '1.24',
      devTryMode: true,
      tryComponents: [
        { name: 'hello-world' },
        // add more when you have multiple web parts
        // { name: 'my-extension', entry: 'src/extensions/my-extension/MyExtension.ts' },
      ],
    }),
  ],
});
```

Replace `name`, `framework`, and `spfxVersion` with values that match your project. Check your `package.json` name and set `framework` to `react`, `vanilla`, or your current framework.

`tryComponents` lists the components you want RSPFx to serve:

- `name` is the folder name under `src/webparts/<name>` or `src/extensions/<name>`.
- `entry` is optional. Use it only when the entry file does not follow the convention (`<name>WebPart.ts`, `index.ts`, or framework variants). Example: `entry: 'src/webparts/hello-world/HelloWorldWebPart.ts'`.

RSPFx resolves the entry in this order:

1. `tryComponents[].entry` when set — file or directory, absolute or relative to project root.
2. Convention scan in `paths.webpartsDir/<name>/` — `index.ts`, `<name>WebPart.ts`, Pascal variants, then single `*.ts` fallback.
3. Fallback candidates like `src/webparts/<name>/<name>WebPart.ts`.

You can also set a shared start location:

```ts
rspfxVite({
  name: 'my-project',
  framework: 'react',
  spfxVersion: '1.24',
  devTryMode: true,
  paths: { webpartsDir: 'src/your/dir' },
  tryComponents: [{ name: 'hello-world' }],
})
```

### 3. Run the dev server

```sh
rspfx dev
```

Open the URL that prints:

- No tenant — `http://localhost:4321/` shows local preview with mock `/_api`.
- Tenant set — `https://localhost:4321` serves `https://<tenant>/_layouts/15/workbench.aspx?debugManifestsFile=https://localhost:4321/temp/manifests.js`.

Press `rspfx dev --tenant https://contoso.sharepoint.com` to test workbench mode without editing config.

Save a file to rebuild. RSPFx ticks `/__rspfx_hot.json` and reloads the page.

## What stays working

- `gulp serve`, `gulp bundle --ship`, and `gulp package-solution --ship` still run.
- `heft build`, `heft clean`, and `heft test` still run.
- Your CI that calls gulp or Heft still produces the same `.sppkg`.
- `config/config.json` and `src/*/*.manifest.json` are not touched.

Delete `vite.config.ts` to revert. No other cleanup is needed.

## What changes

- `rspfx dev` synthesizes manifests and serves bundles from `dist/` on port 4321.
- `rspfx build`, `rspfx package`, and `rspfx deploy` are not available in try mode. They require full migration because they need production manifests.
- Localized resources, `sp-*` externals, and tenant settings still apply from your existing config where relevant.

## When to move to full migration

Try mode is for dev only. Move to full migration when you want RSPFx to build and package.

Run `rspfx migrate --dry-run` to preview. Run `rspfx migrate` to apply. See [Migrating from gulp and Heft](./migration/migrating-from-gulp-heft.md).

You can keep try mode as long as you want. There is no deadline to migrate.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `entrypoint not found` for a `tryComponents` name | Check `src/webparts/<name>/` exists. Add `entry: 'src/webparts/<name>/<Name>WebPart.ts'` when the file name does not match the folder. |
| No web parts listed at `http://localhost:4321/` | Verify `tryComponents` has at least one entry and `devTryMode: true` is set. Check `rspfx doctor`. |
| Cert warning in workbench | Run `rspfx doctor --fix` and trust the cert in `~/.rspfx/certs`. See [Dev server](./dev/dev-server.md). |
| `tryComponents` validation error | `name` must be a non-empty string. `tryComponents` must be an array. See [Commands reference](../reference/commands.md). |

## Next steps

- See [Dev server](./dev/dev-server.md) for local preview and workbench modes.
- See [Migration overview](./migration/overview.md) for the full path from try to migrate.

