# Styling reference

This page lists the technical styling options for RSPFx: bundler handling, CSS inlining helpers per bundler, CSS Modules rules, PostCSS/SCSS detection, and opt-out.

For conceptual guidance see `docs/styling.md`; for pipeline see `docs/building-packages.md`.

## Why inlined

SPFx loads only JS bundles via `loaderConfig.scriptResources` `type: "path"` (`reference/FORMATS.md` §1). No external `.css` is fetched, so CSS must be injected by JS. All three bundlers inline by default — never extract CSS for `.sppkg`.

## Bundler handling

| Bundler | Plugin | CSS inlining flag | Default |
|---|---|---|---|
| **Vite** (recommended) | `rspfxVite()` from `@mbsks/rspfx-plugin` (`packages/plugin/src/vite.ts:299`) | `build.cssCodeSplit: false` | Automatic |
| **Rsbuild** | `rspfxRsbuild()` from `@mbsks/rspfx-plugin` (`packages/plugin/src/rsbuild.ts:354`) | `output.injectStyles: true` | `true` via preset |
| **Rspack** | `new RspfxPlugin()` from `@mbsks/rspfx-plugin` | `style-loader` chain | `rspfxCssInlineRule()` |

Switch: `rspfx new --bundler vite|rsbuild|rspack` or `rspfx migrate --bundler vite`.

## File type handling

| Input | Detection | Output |
|---|---|---|
| `.css` | Built-in | Inlined via `style-loader` / Vite css |
| `.scss` / `.sass` | `bun add -D sass` auto-detected | Compiled then inlined |
| `*.module.css` / `*.module.scss` | `*.module.*` pattern | CSS Modules (hashed, import returns mapping) |
| Plain `.css` / `.scss` | No `*.module.*` | Global |
| `postcss.config.*` at project root | File exists | Applied automatically |

## rspfxInlineCss helpers

Guarantees inlining by collecting emitted `.css` assets, deleting them, and injecting `<style>` into every entry chunk (`enforce: 'post'`).

| Bundler | Import | Helper | When to use |
|---|---|---|---|
| **Vite 7 + 8** (Rollup / Rolldown) | `import { rspfxInlineCss } from '@mbsks/rspfx-plugin'` | `rspfxInlineCss()` or aliases `rspfxViteInlineCss`, `rspfxVite7InlineCss`, `rspfxVite8InlineCss` | Custom `assetFileNames` or merged Vite configs emitted `dist/assets/*.css` |
| Agnostic | `import { rspfxInlineCss } from '@mbsks/rspfx-core/inline-css.js'` | `rspfxInlineCss()` | Same — tool-agnostic entry |
| **Rsbuild** fallback | `import { rspfxRsbuildInlineCss } from '@mbsks/rspfx-plugin'` | `rspfxRsbuildInlineCss()` | When `output.injectStyles: false` leaked |
| **Rspack** preferred | `import { rspfxCssInlineRule, rspfxSassRule } from '@mbsks/rspfx-compiler-rspack/helpers/css.js'` | `rspfxCssInlineRule()`, `rspfxSassRule()` | Keep `style-loader` chain |
| **Rspack** fallback | `import { rspfxRspackInlineCss } from '@mbsks/rspfx-plugin'` | `rspfxRspackInlineCss()` | When `CssExtractRspackPlugin` emitted `.css` |

All helpers are zero-dependency and available from `@mbsks/rspfx-core/inline-css.js`, `@mbsks/rspfx-plugin`, and `@mbsks/rspfx-compiler-rspack/helpers/inline-css.js`.

### Examples

**Vite 7 and 8 (same plugin):**

```ts
// vite.config.ts
import { defineConfig } from '@mbsks/rspfx-core';
import { rspfxVite, rspfxInlineCss } from '@mbsks/rspfx-plugin';
export default {
  plugins: [rspfxVite(defineConfig({ name: 'my-app', framework: 'react' as const })), rspfxInlineCss()],
  build: { cssCodeSplit: false }
};
```

**Rsbuild:**

```ts
// rsbuild.config.ts — preferred style-loader
import { rspfxCssInlineRule, rspfxSassRule } from '@mbsks/rspfx-compiler-rspack/helpers/css.js';
export default { plugins: [rspfxRsbuild({ name: 'my-app', framework: 'react' })], tools: { rspack: { module: { rules: [rspfxCssInlineRule(), rspfxSassRule()] } } }, output: { injectStyles: true } };
// fallback
import { rspfxRsbuildInlineCss } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxRsbuild({ name: 'my-app', framework: 'react' }), rspfxRsbuildInlineCss()] };
```

**Rspack:**

```ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';
import { rspfxCssInlineRule, rspfxSassRule } from '@mbsks/rspfx-compiler-rspack/helpers/css.js';
export default { plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react' })], module: { rules: [rspfxCssInlineRule(), rspfxSassRule()] } };
// fallback
import { rspfxRspackInlineCss } from '@mbsks/rspfx-plugin';
export default { plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react' }), rspfxRspackInlineCss()] };
```

## Tailwind and UnoCSS

Tailwind v2/v3/v4 and UnoCSS work via PostCSS — no RSPFx plugin.

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

Import `src/app.css` from a web part entry (`examples/shadcn/src/app.css:1`). For Tailwind v3 use `content`, not `purge`.

## Opt-out

| Config | Effect |
|---|---|
| `build: { css: false }` in `rspfxVite` / `RSpfxPlugin` options (`packages/core/src/config.ts:18`) | Disables built-in CSS handling; takes full ownership — keep inlining enabled or styles won't ship in `.sppkg` |

If you take over, keep inlining enabled — otherwise `.sppkg` will contain no `.css` and SharePoint will not load styles.
