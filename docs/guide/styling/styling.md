# Styling

TL;DR: Use Vite for the simplest CSS setup. Keep CSS inlined in JS so styles ship in the `.sppkg`. Add SCSS, PostCSS, or Tailwind with no extra RSPFx plugin.

SharePoint loads only JS bundles via `loaderConfig.scriptResources` type path. No external `.css` is fetched. RSPFx inlines CSS by default so it always ships.

## Pick your bundler

| Bundler | When to use | How CSS is inlined |
|---|---|---|
| Vite | default | `build.cssCodeSplit: false` |
| Rsbuild | Rspack with simpler config | `output.injectStyles: true` |
| Rspack | full bundler control | `style-loader` |

Use Vite unless you need Rspack features. Switch with `rspfx new --bundler vite|rsbuild|rspack`. See [Choosing a framework](../frameworks/choosing-a-framework.md).

## Defaults

RSPFx handles `.css`, `.scss`, `.sass`, and `*.module.*` out of the box:

- SCSS: add `sass` with `bun add -D sass`. It is picked up at once.
- PostCSS: add any `postcss.config.*` at project root. It is applied at once.
- CSS Modules: `*.module.css` and `*.module.scss` are local and hashed. Plain `.css` and `.scss` are global.

Keep inlining on. Blank or unstyled parts often mean CSS extraction was turned on by mistake.

## Customize

Your bundler file owns styling. RSPFx does not overwrite `css` or `tools`.

**Rspack:**

```ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';
import { rspfxCssInlineRule, rspfxSassRule } from '@mbsks/rspfx-compiler-rspack/helpers/css.js';
export default { plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react' })], module: { rules: [rspfxCssInlineRule(), rspfxSassRule()] } };
```

Set `build: { css: false }` if you take full control.

**Rsbuild:** use `tools.postcss` or `tools.sass` and keep `output.injectStyles: true`.

**Vite:** use `css.modules` and `postcss.config.*` and keep `build.cssCodeSplit: false`.

## When inlining fails

Custom `assetFileNames`, merged Vite configs, or extraction can emit `dist/assets/*.css` that never loads. Use the fallback plugin to collect those `.css` files, delete them, and inject a `<style>` into each entry chunk.

**Vite - Vite 7 and Vite 8 same plugin:**

```ts
// vite.config.ts
import { defineConfig } from '@mbsks/rspfx-core';
import { rspfxVite, rspfxInlineCss } from '@mbsks/rspfx-plugin';
export default {
  plugins: [rspfxVite(defineConfig({ name: 'my-app', framework: 'react' as const })), rspfxInlineCss()],
  build: { cssCodeSplit: false }
};
```

Aliases all point to the same plugin:

```ts
import { rspfxVite7InlineCss, rspfxVite8InlineCss, rspfxViteInlineCss } from '@mbsks/rspfx-plugin';
```

You can also import from:

```ts
import { rspfxInlineCss } from '@mbsks/rspfx-core/inline-css.js';
```

**Rsbuild - style loader path:**

```ts
import { rspfxCssInlineRule, rspfxSassRule } from '@mbsks/rspfx-compiler-rspack/helpers/css.js';
export default { plugins: [rspfxRsbuild()], tools: { rspack: { module: { rules: [rspfxCssInlineRule(), rspfxSassRule()] } } }, output: { injectStyles: true } };
```

Fallback asset inliner for Rsbuild:

```ts
import { rspfxRsbuildInlineCss } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxRsbuild(), rspfxRsbuildInlineCss()] };
```

**Rspack - style loader or fallback:**

```ts
import { rspfxCssInlineRule, rspfxSassRule } from '@mbsks/rspfx-compiler-rspack/helpers/css.js';
export default { plugins: [new RspfxPlugin()], module: { rules: [rspfxCssInlineRule(), rspfxSassRule()] } };
```

```ts
import { rspfxRspackInlineCss } from '@mbsks/rspfx-plugin';
export default { plugins: [new RspfxPlugin(), rspfxRspackInlineCss()] };
```

All helpers are zero dep and exported from `@mbsks/rspfx-core/inline-css.js` and `@mbsks/rspfx-plugin`.

## Tailwind and UnoCSS

Tailwind v2, v3, v4 and UnoCSS work via PostCSS. No RSPFx plugin is needed.

Install Tailwind v4:

```sh
bun add -D tailwindcss @tailwindcss/postcss postcss
```

Add PostCSS config:

```js
// postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } };
```

Add Tailwind entry:

```css
/* src/app.css */
@import "tailwindcss";
```

Import `src/app.css` from your web part entry. For Tailwind v3 use `content`, not `purge`.

## CSS Modules vs global

```scss
/* Hello.module.scss - hashed */
.hello { color: var(--helloColor); }
```

```ts
import styles from './Hello.module.scss';
<div className={styles.hello} />
```

Plain `.css` is global. Module files are local.

## Opt out

Set `build: { css: false }` to disable built in handling. If you take over, keep inlining on or styles will not ship in the `.sppkg`.

For build details, see [../../reference/architecture.md](../../reference/architecture.md). For flags, see [../../reference/commands.md](../../reference/commands.md).
