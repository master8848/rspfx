# Favicon and assets

TL;DR: RSPFx serves `assets/favicon.svg` on local preview to avoid a broken icon. Import assets from a bundle when you want them in the `.sppkg`.

Projects scaffold `assets/favicon.svg` as a 32 by 32 SVG. The dev server serves it at `/assets/favicon.svg` and injects `<link rel="icon">` at `/`. SharePoint pages ignore this file - it is for preview only.

<Steps>

## Step 1: Keep or replace the favicon

Keep `assets/favicon.svg` with `viewBox="0 0 32 32"`. To change it, overwrite the file:

```sh
cp my-icon.svg assets/favicon.svg
```

Restart `rspfx dev` and hard reload the browser with `Ctrl+Shift+R`.

For PNG or ICO, add the file to `assets/` and link it in preview if needed.

## Step 2: Add per web part assets

Put icons that belong to one web part in `src/webparts/<name>/assets/`. Keep shared branding in `assets/` or `sharepoint/assets/`.

## Step 3: Ship an asset inside the `.sppkg`

Import the file from your bundle so it goes through the bundler:

```ts
import icon from './assets/icon.svg';
```

The bundler emits to `dist/`, then `release/assets/`, then `ClientSideAssets/` in the `.sppkg`. This is the way to ship an image with your solution.

</Steps>

## Troubleshoot

| Symptom | Fix |
|---|---|
| Broken favicon on `http://localhost:4321/` | restore `assets/favicon.svg` and restart `rspfx dev` |
| 404 at `/assets/favicon.svg` | check `assets/` exists at project root |
| Icon not updating | hard reload with `Ctrl+Shift+R` |

Favicon is a dev only help. Site favicon is set in SharePoint site settings or tenant theme.

For file layout, see [../../reference/project-structure.md](../../reference/project-structure.md).
