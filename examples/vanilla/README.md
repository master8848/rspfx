# @mbsks/rspfx-example-vanilla

A minimal RSPFx web part written in plain TypeScript — no UI framework.

## What it demonstrates

- Vanilla web part without a framework: `renderComponent()` returns the DOM element directly
- `rspack.config.ts` configuration via the `RspfxPlugin` (framework, spfx target, dev/build settings)
- Manifest auto-discovery (`src/webparts/hello/hello.manifest.json` + `helloWebPart.ts`)
- Property pane (`PropertyPaneTextField`) via `getPropertyPaneConfiguration`

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start the dev server + SharePoint workbench (port 4321) |
| `pnpm dev:refresh` | Dev server with fast refresh |
| `pnpm build` | Production build (dist + release) |
| `pnpm package` | Build + package into `sharepoint/solution/*.sppkg` |
| `pnpm analyze` | Build + bundle report |
| `pnpm doctor` | Environment checks |
| `pnpm clean` | Remove build output |
| `pnpm typecheck` | `tsc --noEmit` |
