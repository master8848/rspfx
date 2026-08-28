# Styling

How CSS and SCSS are handled for SPFx. For the build pipeline see [building-packages.md](building-packages.md). See Microsoft docs: [CSS guidance](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/web-parts/guidance/css-guidance).

> **Tip:** Use Vite for the simplest CSS — PostCSS, CSS Modules, and SCSS work out of the box with no extra config. Rank: Vite > Rsbuild > Rspack.

## Why CSS is inlined

SPFx loads only JS bundles (`[name].js` via `loaderConfig.scriptResources` `type: "path"`). No external `.css` is fetched, so CSS must be injected by JS. All three bundlers inline by default — never extract CSS for `.sppkg` or styles won't ship.

> **Tip:** Blank or unstyled parts in the workbench usually mean CSS extraction was enabled — keep inlining on.

## Defaults

All three bundlers handle `.css`, `.scss`, `.sass`, and `*.module.*` out of the box:

- **SCSS:** `bun add -D sass` — picked up automatically.
- **PostCSS:** add any `postcss.config.*` at the project root — applied automatically when present.
- **CSS Modules:** `*.module.css` / `*.module.scss` are local (hashed, import returns mapping). Plain `.css`/`.scss` are global.

## Pick your bundler

| Bundler | When to use | CSS inlining |
|---|---|---|
| **Vite** (recommended) | Default for new projects | Automatic (`cssCodeSplit: false`) |
| **Rsbuild** | Rspack compat with simpler config | Keep `output.injectStyles: true` |
| **Rspack** | Full bundler control | Keep `style-loader` |

Switch with `rspfx new --bundler vite|rsbuild|rspack` or `rspfx migrate --bundler vite`.

## Customize

Your bundler file owns styling — RSPFX doesn't overwrite `css`/`tools`.

**Rspack** — prefer helpers:

```ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';
import { rspfxCssInlineRule, rspfxSassRule } from '@mbsks/rspfx-compiler-rspack/helpers/css.js';
export default { plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react' })], module: { rules: [rspfxCssInlineRule(), rspfxSassRule()] } };
```

Set `build: { css: false }` if you take full ownership.

**Rsbuild** — use `tools.postcss`/`tools.sass`, keep `output.injectStyles: true`.

**Vite** — use `css.modules` + `postcss.config.*`, keep `build.cssCodeSplit: false`.

## Tailwind and UnoCSS

Tailwind v2/v3/v4 and UnoCSS work via PostCSS — no special RSPFX plugin.

```sh
bun add -D tailwindcss @tailwindcss/postcss postcss
```

```js
// postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } };
```

```css
/* src/app.css */
@import "tailwindcss";
```

Import `src/app.css` from a web part entry. For Tailwind v3 use `content`, not `purge`. UnoCSS is similar — add its PostCSS or Vite plugin and keep inlining enabled.

## CSS Modules vs global

```scss
/* Hello.module.scss — hashed */
.hello { color: var(--helloColor); }
/* app.css — global */
```

```ts
import styles from './Hello.module.scss';
<div className={styles.hello} />
```

## Opt-out

`build: { css: false }` disables built-in handling. If you take over, keep inlining enabled — otherwise styles won't ship in the `.sppkg`.
