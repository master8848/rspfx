# @mbsks/rspfx-example-solid

A Solid web part demonstrating the RSPFx framework support.

## What it demonstrates

- Solid web part via `SolidWebPart` from `@mbsks/rspfx-framework-solid`
- Solid JSX typechecked via `jsx: react-jsx` + `jsxImportSource: solid-js` (the SPFx
  `@microsoft/sp-*` types load React's global JSX namespace, which is incompatible
  with `jsx: preserve`; the build itself uses `babel-preset-solid` and is unaffected)
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
