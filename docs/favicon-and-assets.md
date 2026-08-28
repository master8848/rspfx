# Favicon and assets

Projects scaffold `assets/favicon.svg` (32×32 SVG) so `http://localhost:4321/` shows no broken favicon. Served at `/assets/favicon.svg` and injected as `<link rel="icon">` in the local preview at `/`. Not packaged — production uses SharePoint chrome.

Replace: overwrite `assets/favicon.svg` (keep `viewBox="0 0 32 32"`), restart `rspfx dev`, hard-reload browser. For PNG/ICO add file to `assets/` and link. Per-webpart icons belong in `src/webparts/<name>/assets/`, not `assets/`.

To ship an icon inside `.sppkg`, import it from a bundle (`import icon from './assets/icon.svg'`) — it emits to `dist/` → `release/assets/` → `ClientSideAssets/`.

| Symptom | Fix |
|---|---|
| Broken favicon on `http://localhost:4321/` | Restore `assets/favicon.svg` and restart `rspfx dev` |
| 404 `/assets/favicon.svg` | Ensure `assets/` exists at project root |
| Not updating | Hard reload (`Ctrl+Shift+R`) |

> Tip: `assets/favicon.svg` is dev-only convenience. SharePoint pages ignore it — site favicon is set via site settings / tenant theme.
