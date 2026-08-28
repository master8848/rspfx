# @mbsks/rspfx-example-vue

A Vue 3 web part demonstrating the RSPFx framework support.

## What it demonstrates

- Vue web part via `VueWebPart` from `@mbsks/rspfx-framework-vue`
- Single-file component (`Hello.vue`) with `<script setup lang="ts">` and scoped styles
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
