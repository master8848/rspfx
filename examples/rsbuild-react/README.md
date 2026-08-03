# @mbsks/rspfx-example-rsbuild-react

The same React web part as `examples/react`, built with the **Rsbuild** plugin instead of Rspack.

## What it demonstrates

- Identical `rspfxRsbuild` options object — only the bundler config file changes
- `rsbuild.config.ts` configuration via `rspfxRsbuild` (framework, spfx target, dev/build settings)
- React web part with a `renderComponent()` hook (`ReactWebPart` from `@mbsks/rspfx-framework-react`)
- `rspfx build` spawns one `rsbuild build` for all web part bundles (AMD output, per-entry `define('id', …)`)
- `rspfx dev` spawns `rsbuild dev`; the plugin serves `/temp/manifests.js` and opens the workbench
- Manifest auto-discovery (`src/webparts/hello/hello.manifest.json` + `helloWebPart.ts`)

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start Rsbuild dev server + SharePoint workbench (port 4321) |
| `pnpm build` | Production build (dist + release) via Rsbuild |
| `pnpm package` | Build + package into `sharepoint/solution/*.sppkg` |
| `pnpm doctor` | Environment checks |
| `pnpm clean` | Remove build output |
| `pnpm typecheck` | `tsc --noEmit` |
