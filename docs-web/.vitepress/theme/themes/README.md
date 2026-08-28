# Extra shadcn themes — drop-in

Add a file `mytheme.css` here and it auto-appears in the theme switcher. No other file needs editing.

## 1. File name = theme id
`mytheme.css` → `html[data-theme="mytheme"]` must match the file name (without `.css`).
Prefix `_` is ignored (so `_example.css` does not register).

## 2. Wrap your shadcn tokens
Your shadcn-compatible file probably looks like:
```css
:root { --background: 0 0% 100%; --primary: 221 83% 53%; ... }
.dark { --background: 240 10% 3.9%; --primary: 217 91% 59%; ... }
```
Wrap it for RSPFx:
```css
/* theme-meta: label="My Theme" color="#2563eb" */
html[data-theme="mytheme"] { --background: ...; --primary: ...; }
html[data-theme="mytheme"].dark { --background: ...; --primary: ...; }
```
`color` is the dot in the switcher (hex of `--primary`). `label` is the menu text.
If you omit the `theme-meta` comment, `label` is title-cased from the file name and `color` is derived from `--primary`.

Optional but recommended — also set VitePress hero vars so the hero follows the theme:
```css
--vp-home-hero-name-background: linear-gradient(120deg, hsl(var(--primary)) 20%, ...);
--vp-home-hero-image-background-image: linear-gradient(135deg, hsl(var(--primary) / 0.12), ...);
```

## 3. Drop & run
```
cp mytheme.css docs-web/.vitepress/theme/themes/
bun run --filter docs-web dev   # or build
```
`docs-web/.vitepress/theme/index.ts` auto-imports `themes/*.css` via `import.meta.glob`.
`components/AccentSwitcher.vue` auto-discovers the same files via `?raw` and adds them under “Shadcn themes”.

## Bulk import (20 files)
```bash
node scripts/convert-shadcn-theme.mjs ./raw-themes/*.css --out docs-web/.vitepress/theme/themes/
```
The converter wraps `:root`/`.dark` → `html[data-theme="<name>"]` and copies `label`/`color` from the file name or first `--primary`.

## Notes
* Keep `paths: {}` empty — local imports must use `.js` not needed for CSS.
* Existing 13 built-in shadcn themes stay in `style.css`; extra files are additive.
* `docs-web/.vitepress/config.mts` head script already handles unknown `data-theme` values (no `shadcnMap` edit needed) for FOUC-free reloads.
