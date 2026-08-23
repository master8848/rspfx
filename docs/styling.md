# Styling

This is the styling reference: how CSS and SCSS are bundled for SPFx, what the defaults handle, and how to customize per bundler. For the build pipeline see [building-packages.md](building-packages.md); for scaffolding see [getting-started.md](getting-started.md); for the compiler surface see [internal-api.md](internal-api.md).

## Why SPFx inlines CSS

The `.sppkg` produced by `@mbsks/rspfx-sppkg-builder` (`packages/sppkg-builder/src/index.ts`) contains only JS under `ClientSideAssets/`; no external `.css` file is loaded at runtime. The loader in `release/manifests/*.manifest.json` references `loaderConfig.scriptResources` entries of `type: "path"` that point to `[name].js` bundles, and SharePoint does not fetch companion CSS. Every CSS import must be injected at runtime via JS.

Use `style-loader` in `packages/compiler-rspack/src/config.ts:182`, `output.injectStyles: true` via `tools.bundlerChain` in `packages/plugin/src/rsbuild.ts:319`, or `build.cssCodeSplit: false` in `packages/plugin/src/vite.ts:340`. Never use `type: "css"` or `CssExtractRspackPlugin`/`mini-css-extract-plugin` for SPFx bundles; that emits a separate `.css` file with no loader entry and the styles never apply. The only extract path in `packages/compiler-rspack/src/config.ts:176` is gated on `RSPFX_EXTRACT_CSS=1` and is not for `.sppkg` distribution.

## Default handling

`packages/compiler-rspack/src/config.ts:183` registers `test: /\.css$/` with `style-loader` + `css-loader` `modules: { auto: true }` and `test: /\.s[ac]ss$/i` with `style-loader` + `css-loader` `modules: { auto: true }, importLoaders: 1` + `sass-loader` `api: "modern"`. `packages/plugin/src/vite.ts:340` sets `build.cssCodeSplit: false` and relies on Vite's native CSS pipeline. `packages/plugin/src/rsbuild.ts:319` registers the same `style-loader` + `css-loader` + `sass-loader` rules inside `modifyRspackConfig` and `packages/plugin/src/rspack.ts` inherits the compiler rules via `createRspackConfig`.

All three paths handle `.css`, `.scss`, `.sass`, and `*.module.*` without user config. Enable PostCSS by adding `postcss.config.js` or `postcss.config.mjs` at the project root; Vite and Rsbuild auto-detect it, and `packages/compiler-rspack/src/config.ts` applies `postcss-loader` when the config file exists. Enable SCSS by installing `sass` (`pnpm add -D sass`); `sass-loader` resolves against the project `node_modules` and is skipped when `sass` is absent. CSS Modules activate automatically for `*.module.css` and `*.module.scss` via `modules: { auto: true }`; plain `.css`/`.scss` stay global.

## Bundler choice

Vite (`vite.config.ts` with `rspfxVite` from `@mbsks/rspfx-plugin` `packages/plugin/src/vite.ts`) is the recommended default and the most stable path for styling. Rsbuild (`rsbuild.config.ts` with `rspfxRsbuild` from `packages/plugin/src/rsbuild.ts`) is the second pick and matches Rspack semantics with less config. Rspack (`rspack.config.ts` with `RspfxPlugin` from `packages/plugin/src/rspack.ts`) requires the longest webpack-like `module.rules` block and is retained for cases that need full Rspack control.

Select the bundler at scaffold or migrate time with `rspfx new --bundler vite|rsbuild|rspack` or `rspfx migrate --bundler vite|rsbuild|rspack` (`apps/cli/src/commands/new.ts`, `apps/cli/src/commands/migrate.ts`). All three produce identical `dist/*.js` + `release/manifests/*.manifest.json` + `sharepoint/solution/*.sppkg` outputs.

## Per-bundler customization

User-owned styling config lives in the bundler file; the rspfx plugins do not overwrite user `css`/`tools` keys.

Rspack (`rspack.config.ts`): add `module.rules` entries. The defaults in `packages/compiler-rspack/src/config.ts:183` are the reference; override by pushing a rule before `createRspackConfig` merges framework contributions. Use `style-loader` + `css-loader` + `sass-loader` + optional `postcss-loader` with `modules: { auto: true }`.

```ts
// rspack.config.ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';
export default {
  plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react' })],
  module: {
    rules: [
      { test: /\.css$/, use: ['style-loader', { loader: 'css-loader', options: { modules: { auto: true } } }] }
    ]
  }
};
```

Rsbuild (`rsbuild.config.ts`): use `tools.postcss`, `tools.sass`, and Rsbuild output flags. Keep `output.injectStyles: true` so CSS stays inlined. Set `output.disableCssExtract: true` or `output.injectStyles` depending on Rsbuild version; do not enable `CssExtractRspackPlugin`.

```ts
// rsbuild.config.ts
import { defineConfig } from '@rsbuild/core';
import { rspfxRsbuild } from '@mbsks/rspfx-plugin';
export default defineConfig({
  plugins: [rspfxRsbuild({ name: 'my-app', framework: 'react' })],
  tools: {
    postcss: { postcssOptions: { plugins: [require('@tailwindcss/postcss')] } },
    sass: { sassOptions: {} }
  },
  output: { injectStyles: true }
});
```

Vite (`vite.config.ts`): use `css.modules` and `postcss.config.mjs`. Vite reads `postcss.config.*` at the project root automatically; `css.modules.auto` is not needed when `*.module.*` is used. Keep `build.cssCodeSplit: false` (set by `packages/plugin/src/vite.ts:340`; do not override to `true`).

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default defineConfig({
  plugins: [rspfxVite({ name: 'my-app', framework: 'react' })],
  css: { modules: { localsConvention: 'camelCaseOnly' } }
});
```

## Tailwind CSS v4

Tailwind v4 integrates via PostCSS only; no bundler-specific plugin or patch is required.

Install `tailwindcss`, `@tailwindcss/postcss`, and `postcss` (`pnpm add -D tailwindcss @tailwindcss/postcss postcss`), add `postcss.config.mjs` at the project root, and import Tailwind once in `src/app.css`.

```js
// postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } };
```

```css
/* src/app.css */
@import "tailwindcss";
```

Import `src/app.css` from any web part entry or component (`src/webparts/<name>/<name>WebPart.ts` or `src/webparts/<name>/components/<Name>.tsx`). Vite loads `postcss.config.mjs` natively. Rsbuild loads it via `tools.postcss`. Rspack loads it via `postcss-loader` when the config file exists. Do not add a `TailwindPostCSSPatch` or custom loader; the standard PostCSS detection handles Tailwind v4.

## SCSS modules vs normal CSS vs global

Files ending in `*.module.css` and `*.module.scss` are CSS Modules: `css-loader` `modules: { auto: true }` hashes class names and the import returns a mapping.

```ts
// src/webparts/hello/components/Hello.module.scss
.hello { color: var(--helloColor); }
```

```ts
import styles from './Hello.module.scss';
export const Hello = () => <div className={styles.hello}>Hello</div>;
```

Files named `*.css` and `*.scss` without `.module.` are global: selectors apply document-wide and the import has no mapping export. Use for resets, Tailwind entry (`src/app.css`), or third-party CSS.

SCSS requires `sass` (`pnpm add -D sass`); `sass-loader` `api: "modern"` in `packages/compiler-rspack/src/config.ts:192` and `packages/plugin/src/rsbuild.ts:327` compiles `@mixin`, `@include`, `@import`, and `@use`. Install `sass` when any `.scss` or `.sass` file exists; plain `.css` projects do not need it.

## Opt-out and fully custom CSS

Set `build.css: false` in the plugin options to disable the built-in CSS handling and take full ownership of styling.

```ts
// vite.config.ts
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxVite({ name: 'my-app', framework: 'react', build: { css: false } })] };
```

When `build.css: false`, no `style-loader`/`css-loader`/`sass-loader` rules are registered by `packages/compiler-rspack/src/config.ts` or `packages/plugin/src/rsbuild.ts`, and `packages/plugin/src/vite.ts` does not set `build.cssCodeSplit`. Add your own `module.rules` (Rspack), `tools.postcss`/`tools.sass` (Rsbuild), or `css`/`postcss` config (Vite). You remain responsible for inlining: keep `style-loader` or `output.injectStyles: true` or `build.cssCodeSplit: false` so the `.sppkg` has no external CSS dependency.

## Future-proofing

Import the shared helpers from `@mbsks/rspfx-plugin` when they are available: `rspfxCssInlineRule()` and `rspfxSassRule()` return the `style-loader` + `css-loader` (`modules: { auto: true }`) and SCSS (`+ sass-loader` `api: "modern"`) rule objects used by `packages/compiler-rspack/src/config.ts:183`; prefer them over hand-written rules to track future loader changes.

PostCSS detection is file-based: presence of `postcss.config.js`, `postcss.config.cjs`, or `postcss.config.mjs` at the project root enables the transform for all bundlers; absence disables it with no stub. No `TailwindPostCSSPatch` or framework-specific Tailwind wiring is ever needed; Tailwind v4 is a standard PostCSS plugin via `@tailwindcss/postcss` as shown above.

