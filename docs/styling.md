# Styling

How CSS and SCSS are handled for SPFx. For the build pipeline see [building-packages.md](building-packages.md).

## Why CSS is inlined

SPFX loads only JS bundles (`[name].js` via `loaderConfig.scriptResources` `type: "path"`). No external `.css` is fetched, so all CSS must be injected by JS.

Keep CSS inlined:

- Rspack: `style-loader` (`packages/compiler-rspack/src/config.ts:182`)
- Rsbuild: `output.injectStyles: true` (`packages/plugin/src/rsbuild.ts:319`)
- Vite: `build.cssCodeSplit: false` (`packages/plugin/src/vite.ts:340`)

Never use `type: "css"` or `CssExtractRspackPlugin`. The only extract is `RSPFX_EXTRACT_CSS=1` (`packages/compiler-rspack/src/config.ts:176`) — not for `.sppkg`.

## Defaults

All three bundlers handle `.css`, `.scss`, `.sass`, and `*.module.*` out of the box.

- SCSS: install `sass` (`bun add -D sass`). `sass-loader` `api: "modern"` compiles it.
- PostCSS: add any `postcss.config.*` file (`js`, `cjs`, `mjs`, `ts`, `cts`, `mts`, or `json`) at the project root. Applied via `postcss-loader` only when the file exists (`packages/compiler-rspack/src/config.ts:37`).
- CSS Modules: `*.module.css` and `*.module.scss` are local (hashed names, import returns mapping). Plain `.css`/`.scss` are global. Config is `modules: { auto: /\.module\.\w+$/i, namedExport: false, exportLocalsConvention: 'asIs' }`.

## Pick your bundler

Vite is recommended. Rsbuild is second. Rspack is for full control only.

All three give the same `dist/*.js` + `release/` + `.sppkg`.

Ranking: Vite > Rsbuild > Rspack (see `skills/rspfx/SKILL.md`). Switch with `rspfx new --bundler vite|rsbuild|rspack` or `rspfx migrate --bundler vite`.

## Customize

Your bundler file owns styling. RSPFX doesn't overwrite `css`/`tools`.

**Rspack** — add `module.rules`. Prefer helpers over hand-written rules:

```ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';
import { rspfxCssInlineRule, rspfxSassRule } from '@mbsks/rspfx-compiler-rspack/helpers/css.js';
export default {
  plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react' })],
  module: { rules: [rspfxCssInlineRule(), rspfxSassRule()] }
};
```

Set `build: { css: false }` if you take full ownership.

**Rsbuild** — use `tools.postcss`/`tools.sass`, keep `output.injectStyles: true`.

```ts
import { defineConfig } from '@rsbuild/core';
import { rspfxRsbuild } from '@mbsks/rspfx-plugin';
export default defineConfig({
  plugins: [rspfxRsbuild({ name: 'my-app', framework: 'react' })],
  output: { injectStyles: true }
});
```

**Vite** — use `css.modules` + `postcss.config.*`. Keep `build.cssCodeSplit: false`.

```ts
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxVite({ name: 'my-app', framework: 'react' })] };
```

## Tailwind v4

Via PostCSS only. No special plugin.

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

Import `src/app.css` from a web part entry. Tailwind v3: use `content`, not `purge`.

## CSS Modules vs global

```scss
/* Hello.module.scss — hashed, import returns { hello } */
.hello { color: var(--helloColor); }

/* app.css — global, no mapping */
```

```ts
import styles from './Hello.module.scss';
<div className={styles.hello} />
```

SCSS needs `sass`. Plain CSS doesn't.

## Opt-out

`build: { css: false }` disables built-in handling. Add your own rules but keep inlining (`style-loader` / `output.injectStyles: true` / `build.cssCodeSplit: false`) — otherwise styles won't ship in the `.sppkg`.
