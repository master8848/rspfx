# Favicon and assets

New RSPFX projects scaffold `assets/favicon.svg` so the local preview and workbench do not show a broken favicon (`packages/templates/src/index.ts:94` `faviconSvg()`). The icon is a 32×32 SVG combining the Rspack cube (red `#ff3b30`/`#ff6b4a`), Vite lightning (yellow `#facc15` + purple `#a78bfa` stroke), and SPFx SharePoint `S` (blue `#0078d4`) on `#111827` with `rx=7`.

## Where the favicon lives

Scaffold adds `assets/favicon.svg` at the project root (`packages/templates/src/index.ts:83` `buildFiles`). The dev server serves it at `/assets/favicon.svg` (`packages/dev-runtime/src/serve.ts:260` `staticFolders` `assets → /assets`) and the local preview injects `<link rel="icon" type="image/svg+xml" href="${origin}/assets/favicon.svg">` (`packages/dev-runtime/src/local-page.ts:47`). `sharepoint/assets/.gitkeep` stays for the `.sppkg` asset convention (`docs/building-packages.md:86`), but the favicon is not packaged — it is dev-only (SharePoint chrome provides its own favicon in production).

## Why it exists

Without it, browsers request `/favicon.ico` and show a 404/broken icon, which users mistake for a build failure. The SVG is tiny (<1 KB), `type=image/svg+xml`, and works on `http://localhost:4321/` (local mode) and `https://localhost:4321/` (SharePoint mode).

## Replace the favicon

Replace the file `assets/favicon.svg` with any `image/svg+xml` or `image/png`/`image/x-icon`:

- SVG: overwrite `assets/favicon.svg` with your 32×32 `viewBox="0 0 32 32"` SVG. The dev server serves the new bytes after restart (`rspfx dev` watches `assets` via static proxy, but not via Rspack rebuild — restart or `touch assets/favicon.svg`).

- ICO/PNG: add `assets/favicon.ico` (or `.png`) and add a second link in `packages/dev-runtime/src/local-page.ts:47` — or, simpler, keep the SVG and add a PNG fallback `<link rel="icon" type="image/png" href="/assets/favicon.png">` by adding the file to `assets/`. The scaffold does not add PNG by default to keep the project minimal.

- Per-webpart icons: do not use the project favicon for web part UI — use `src/webparts/<name>/assets/` per web part (`packages/templates/src/index.ts:109` `src/webparts/<name>/assets/.gitkeep`). Shared branding belongs in `assets/` or `sharepoint/assets/`; per-webpart illustration belongs in the web part `assets/` folder and is imported via `import icon from './assets/icon.svg'` (asset pipeline `asset/source` `packages/compiler-rspack/src/config.ts:251`).

## Use the SharePoint favicon in production

Production SharePoint pages use the site's favicon (site settings → `Change the look` → or tenant theme), not `assets/favicon.svg`. `assets/favicon.svg` is not copied to `release/assets/` nor embedded in the `.sppkg` (`packages/sppkg-builder/src/sppkg-builder.ts:86` only auto-detects `teams/` and `sharepoint/Resources*.resx`). To ship a custom icon inside the `.sppkg` as a ClientSideAsset, import it from a web part bundle (`import fav from '../assets/favicon.svg'` → emitted to `dist/` → `release/assets/` → `ClientSideAssets/`) and reference it via the module path at runtime, not as a site favicon.

## Configure the dev favicon URL

The dev favicon URL is hardcoded to `${origin}/assets/favicon.svg` in `local-page.ts`. To disable, delete `assets/favicon.svg` — the link will 404 but the dev server still runs; to change the path, edit `packages/dev-runtime/src/local-page.ts:47` and `packages/dev-runtime/src/serve.ts:260` `staticFolders` prefix in a fork. The skill copies `assets/favicon.svg` when scaffolding or copying a project, so a copied project retains the icon without browsers showing a broken state.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Broken favicon in `http://localhost:4321/` | `assets/favicon.svg` missing — restore from `packages/templates/src/index.ts:94` `faviconSvg()` or copy any SVG to `assets/favicon.svg` and restart `rspfx dev` |
| 404 for `/assets/favicon.svg` | `packages/dev-runtime/src/serve.ts:260` not serving `assets` — verify the `assets` folder exists at `path.join(projectRoot, 'assets')` |
| Favicon not updating after edit | Browser cache — hard reload `Ctrl+Shift+R`, or `cache: no-store` already set for `local-page` but not `assets` static — restart dev server |
| Teams/Outlook still shows old icon | Teams caches `teams/<id>_color.png` separately — regenerate icons via `packages/templates/src/png.ts` `solidPng` or replace the two PNGs and repack |
