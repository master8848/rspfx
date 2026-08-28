# Styling

How CSS and SCSS are handled for SPFx. For the build pipeline see [building-packages.md](building-packages.md). See Microsoft docs: [CSS guidance](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/web-parts/guidance/css-guidance).

> **Tip:** Use Vite for the simplest CSS — PostCSS, CSS Modules, and SCSS work out of the box with no extra config. Rank: Vite > Rsbuild > Rspack.

## Why CSS is inlined

SPFx loads only JS bundles (`[name].js` via `loaderConfig.scriptResources` `type: "path"`). No external `.css` is fetched, so CSS must be injected by JS. All three bundlers inline by default — never extract CSS for `.sppkg` or styles won't ship.

> **Tip:** Blank or unstyled parts in the workbench usually mean CSS extraction was enabled — keep inlining on.

## Defaults

All three bundlers handle `.css`, `.scss`, `.sass`, and `*.module.*` out of the box:

- **SCSS:** `bun add -D sass` (or `pnpm add -D sass` / `npm i -D sass` / `yarn add -D sass`) — picked up automatically.
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

Your bundler file owns styling — RSPFx doesn't overwrite `css`/`tools`.

**Rspack** — prefer helpers:

```ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';
import { rspfxCssInlineRule, rspfxSassRule } from '@mbsks/rspfx-compiler-rspack/helpers/css.js';
export default { plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react' })], module: { rules: [rspfxCssInlineRule(), rspfxSassRule()] } };
```

Set `build: { css: false }` if you take full ownership.

**Rsbuild** — use `tools.postcss`/`tools.sass`, keep `output.injectStyles: true`.

**Vite** — use `css.modules` + `postcss.config.*`, keep `build.cssCodeSplit: false`.

## When default inlining fails

RSPFx inlines CSS by default, but custom `assetFileNames`, merged Vite configs, or extraction can break it and leave `dist/assets/*.css` that never loads in SharePoint.

Use the exported fallback plugin to guarantee inlining — it collects emitted `.css`, deletes the assets, and injects a `<style>` into every entry chunk.

### Vite (Vite 7 Rollup and Vite 8 Rolldown)

One plugin covers both — Vite 7 uses Rollup and Vite 8 uses Rolldown, but both emit the same `generateBundle` shape.

```ts
// vite.config.ts — Vite 7 and Vite 8, same import
import { defineConfig } from '@mbsks/rspfx-core';
import { rspfxVite, rspfxInlineCss } from '@mbsks/rspfx-plugin';

export default {
  plugins: [rspfxVite(defineConfig({ name: 'my-app', framework: 'react' as const })), rspfxInlineCss()],
  build: { cssCodeSplit: false }
};
```

Aliases are provided for docs separation:

```ts
import { rspfxVite7InlineCss, rspfxVite8InlineCss, rspfxViteInlineCss } from '@mbsks/rspfx-plugin';
// all three are the same plugin; pick one, or use rspfxInlineCss
```

Tool-agnostic import also available:

```ts
import { rspfxInlineCss } from '@mbsks/rspfx-core/inline-css.js';
```

For Rspack users who customized with Vite/Rolldown, the same plugin works — add `rspfxInlineCss()` as the last plugin (`enforce: 'post'` is built-in).

### Rsbuild

Keep `output.injectStyles: true` (default via `rspfxRsbuild`).

If extraction was enabled, restore with the Rspack helpers or the fallback plugin:

```ts
// rsbuild.config.ts — style-loader path (preferred)
import { rspfxCssInlineRule, rspfxSassRule } from '@mbsks/rspfx-compiler-rspack/helpers/css.js';
export default { plugins: [rspfxRsbuild(/* ... */)], tools: { rspack: { module: { rules: [rspfxCssInlineRule(), rspfxSassRule()] } } }, output: { injectStyles: true } };
```

Fallback asset inliner (when `output.injectStyles: false` leaked):

```ts
import { rspfxRsbuildInlineCss } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxRsbuild(/* ... */), rspfxRsbuildInlineCss()] };
```

### Rspack

Preferred — `style-loader` chain:

```ts
import { rspfxCssInlineRule, rspfxSassRule } from '@mbsks/rspfx-compiler-rspack/helpers/css.js';
export default { plugins: [new RspfxPlugin(/* ... */)], module: { rules: [rspfxCssInlineRule(), rspfxSassRule()] } };
```

Fallback when `CssExtractRspackPlugin` or custom extraction emitted `.css`:

```ts
import { rspfxRspackInlineCss } from '@mbsks/rspfx-plugin';
export default { plugins: [new RspfxPlugin(/* ... */), rspfxRspackInlineCss()] };
```

All helpers are zero-dependency and available from `@mbsks/rspfx-core/inline-css.js`, `@mbsks/rspfx-plugin`, and `@mbsks/rspfx-compiler-rspack/helpers/inline-css.js`.

## Tailwind and UnoCSS

Tailwind v2/v3/v4 and UnoCSS work via PostCSS — no special RSPFx plugin.

```sh
bun add -D tailwindcss @tailwindcss/postcss postcss   # or pnpm add -D / npm i -D / yarn add -D
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
