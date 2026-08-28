# @mbsks/rspfx-example-shadcn

A React 18 web part demonstrating shadcn/ui components with Tailwind CSS v4, built with RSPFx (no Fluent UI).

## What it demonstrates

- `ReactWebPart` from `@mbsks/rspfx-framework-react`
- Tailwind CSS v4 CSS-first styling — CSS tooling is user-owned: `tailwindcss` is a direct dependency here and `globals.css` imports it; wire your own PostCSS/Tailwind/UnoCSS pipeline in the bundler config
- CSS-variable theme tokens (`globals.css`: `:root` variables + `@theme inline` mapping, shadcn convention classes like `bg-background`, `text-muted-foreground`)
- Hand-written shadcn/ui components (`components/ui/*` + `components/lib/utils.ts` with `cn()`)
- Interactive component state (`useState`), property pane

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
