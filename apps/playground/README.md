# @mbsks/rspfx-playground

The in-repo smoke-test app for RSPFX.

## What it is

A small vanilla web part project (`src/webparts/demo`) plus a standalone
playground page (`playground/`). It is wired into the pnpm workspace like the
examples but lives under `apps/` because it exercises the toolchain on every
repo change: it is the quickest way to verify `rspfx build` / `rspfx dev` /
`rspfx playground` end-to-end without scaffolding a new project.

## What it demonstrates

- Vanilla web part: `DemoWebPart` extends `VanillaWebPart` and builds its DOM
  directly in `renderComponent()`
- Manifest auto-discovery (`src/webparts/demo/demo.manifest.json` +
  `demoWebPart.ts`)
- Property pane (`PropertyPaneTextField`) via `getPropertyPaneConfiguration`
- Standalone playground page that instantiates the web part with
  `createMockWebPartContext` from `@mbsks/rspfx-sharepoint-runtime`

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start the dev server + SharePoint workbench (port 4321) |
| `pnpm playground` | Standalone playground page (port 3000) |
| `pnpm build` | Production build (dist + release) |
| `pnpm package` | Build + package into `sharepoint/solution/*.sppkg` |
| `pnpm typecheck` | `tsc --noEmit` |
