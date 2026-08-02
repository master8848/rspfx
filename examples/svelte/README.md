# @mbsks/rspfx-example-svelte

A Svelte web part demonstrating the RSPFX framework support.

## What it demonstrates

- Svelte web part via `SvelteWebPart` from `@mbsks/rspfx-framework-svelte`
- Single-file component (`Hello.svelte`) with native scoped styles
- `rspack.config.ts` configuration via the `RspfxPlugin` (framework, spfx target, dev/build/playground settings)
- Manifest auto-discovery (`src/webparts/hello/hello.manifest.json` + `helloWebPart.ts`)
- Property pane (`PropertyPaneTextField`) via `getPropertyPaneConfiguration`
- Standalone playground page (`playground/`) using a self-mounting playground entry + `createMockWebPartContext`

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start the dev server + SharePoint workbench (port 4321) |
| `pnpm dev:refresh` | Dev server with fast refresh |
| `pnpm playground` | Standalone playground page (port 3000) |
| `pnpm build` | Production build (dist + release) |
| `pnpm package` | Build + package into `sharepoint/solution/*.sppkg` |
| `pnpm analyze` | Build + bundle report |
| `pnpm doctor` | Environment checks |
| `pnpm clean` | Remove build output |
| `pnpm typecheck` | `tsc --noEmit` |
