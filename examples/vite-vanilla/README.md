# @mbsks/rspfx-example-vite-vanilla

The same minimal vanilla web part as `examples/vanilla`, built with the **Vite** plugin instead of Rspack.

## What it demonstrates

- Identical `rspfxVite` options object — only the bundler config file changes
- `vite.config.ts` configuration via `rspfxVite` (framework, spfx target, dev/build settings)
- `rspfx build` spawns one `vite build` per web part bundle (AMD output, per-entry `define('id', …)`)
- `rspfx dev` spawns `vite`; the plugin serves `/temp/manifests.js` and opens the workbench
- Manifest auto-discovery (`src/webparts/hello/hello.manifest.json` + `helloWebPart.ts`)
- Property pane (`PropertyPaneTextField`) via `getPropertyPaneConfiguration`

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start Vite dev server + SharePoint workbench (port 4321) |
| `pnpm build` | Production build (dist + release) via Vite |
| `pnpm package` | Build + package into `sharepoint/solution/*.sppkg` |
| `pnpm doctor` | Environment checks |
| `pnpm clean` | Remove build output |
| `pnpm typecheck` | `tsc --noEmit` |

> The `rspfx playground` command is Rspack-only for now — use one of the Rspack examples for the playground page.
