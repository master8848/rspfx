# Styling

This is the styling reference: how CSS and SCSS are bundled for SPFx, what the defaults handle, and how to customize per bundler. For the build pipeline see [building-packages.md](building-packages.md); for scaffolding see [getting-started.md](getting-started.md); for the compiler surface see [internal-api.md](internal-api.md).

## Why SPFx inlines CSS

The `.sppkg` produced by `@mbsks/rspfx-sppkg-builder` (`packages/sppkg-builder/src/index.ts`) contains only JS under `ClientSideAssets/`; no external `.css` file is loaded at runtime. The loader in `release/manifests/*.manifest.json` references `loaderConfig.scriptResources` entries of `type: "path"` that point to `[name].js` bundles, and SharePoint does not fetch companion CSS. Every CSS import must be injected at runtime via JS.

Use `style-loader` in `packages/compiler-rspack/src/config.ts:182`, `output.injectStyles: true` via `tools.bundlerChain` in `packages/plugin/src/rsbuild.ts:319`, or `build.cssCodeSplit: false` in `packages/plugin/src/vite.ts:340`. Never use `type: "css"` or `CssExtractRspackPlugin`/`mini-css-extract-plugin` for SPFx bundles; that emits a separate `.css` file with no loader entry and the styles never apply. The only extract path in `packages/compiler-rspack/src/config.ts:176` is gated on `RSPFX_EXTRACT_CSS=1` and is not for `.sppkg` distribution.

## Default handling

`packages/compiler-rspack/src/config.ts:212` registers `test: /\.css$/` with `style-loader` + `css-loader` `modules: { auto: /\.module\.\w+$/i, namedExport: false, exportLocalsConvention: 'asIs' }` `importLoaders: hasPostcss && postcssLoader ? 1 : 0` and `test: /\.s[ac]ss$/i` with `style-loader` + `css-loader` `modules: { auto: /\.module\.\w+$/i, namedExport: false, exportLocalsConvention: 'asIs' }, importLoaders: (postcss ? 1 : 0) + 1` + `sass-loader` `api: "modern"`. `packages/plugin/src/vite.ts:340` sets `build.cssCodeSplit: false` and `css.modules: { localsConvention: 'asIs', scopeBehaviour: 'local' }` (`packages/plugin/src/vite.ts:330`). `packages/plugin/src/rsbuild.ts:398` registers the same `style-loader` + `css-loader` + `sass-loader` rules inside `modifyRspackConfig` and `packages/plugin/src/rspack.ts` inherits the compiler rules via `createRspackConfig`.

All three paths handle `.css`, `.scss`, `.sass`, and `*.module.*` without user config. Enable PostCSS by adding `postcss.config.js`, `postcss.config.cjs`, `postcss.config.mjs`, `postcss.config.ts`, `postcss.config.cts`, `postcss.config.mts`, or `postcss.config.json` at the project root; Vite and Rsbuild auto-detect `postcss.config.*`, and `packages/compiler-rspack/src/config.ts:37` plus `packages/compiler-rspack/src/helpers/css.ts:8` plus `packages/plugin/src/rsbuild.ts:70` apply `postcss-loader` only when the config file exists (`importLoaders` is `1` for CSS / `2` for SCSS when present, otherwise `0`/`1`). Enable SCSS by installing `sass` (`bun add -D sass`); `sass-loader` resolves against the project `node_modules` and is skipped when `sass` is absent. CSS Modules activate automatically for `*.module.css` and `*.module.scss` via `modules: { auto: /\.module\.\w+$/i, namedExport: false, exportLocalsConvention: 'asIs' }`; plain `.css`/`.scss` stay global.

Scope behaviour: `packages/plugin/src/vite.ts:330` sets `css.modules.scopeBehaviour: 'local'` explicitly with `localsConvention: 'asIs'`; `packages/compiler-rspack/src/config.ts:218` and `packages/compiler-rspack/src/helpers/css.ts:58` and `packages/plugin/src/rsbuild.ts:403` use `css-loader` `modules: { auto: /\.module\.\w+$/i, namedExport: false, exportLocalsConvention: 'asIs' }` without explicit `mode` — `css-loader` defaults to `mode: 'local'` when `auto` matches, so `*.module.*` is local and plain files are global; `:global{}` inside a module leaks to the global scope, so use it only intentionally.

## Bundler choice

Vite (`vite.config.ts` with `rspfxVite` from `@mbsks/rspfx-plugin` `packages/plugin/src/vite.ts:340`) is the recommended default and the most stable path for styling. Rsbuild (`rsbuild.config.ts` with `rspfxRsbuild` from `packages/plugin/src/rsbuild.ts:319`) is the second pick and matches Rspack semantics with less config. Rspack (`rspack.config.ts` with `RspfxPlugin` from `packages/plugin/src/rspack.ts`) requires manual webpack-like `module.rules` and is retained only when full Rspack control is needed.

Ranking is Vite > Rsbuild > Rspack per `skills/rspfx/SKILL.md`; switch with `rspfx new --bundler vite|rsbuild|rspack` or `rspfx migrate --bundler vite` (`apps/cli/src/commands/new.ts`, `apps/cli/src/commands/migrate.ts`). All three produce identical `dist/*.js` + `release/manifests/*.manifest.json` + `sharepoint/solution/*.sppkg` outputs.

## Per-bundler customization

User-owned styling config lives in the bundler file; the rspfx plugins do not overwrite user `css`/`tools` keys.

Rspack (`rspack.config.ts`): add `module.rules` entries. The defaults in `packages/compiler-rspack/src/config.ts:212` and `packages/compiler-rspack/src/helpers/css.ts:38` are the reference; prefer helpers `rspfxCssInlineRule()`/`rspfxSassRule()` from `@mbsks/rspfx-compiler-rspack/helpers/css.js` over hand-written `style-loader` + `css-loader` + `sass-loader` + `postcss-loader` rules, and set `build: { css: false }` in `RspfxPlugin` options when taking full ownership via `packages/compiler-rspack/src/helpers/css.ts:38`.

```ts
// rspack.config.ts
import { RspfxPlugin } from '@mbsks/rspfx-plugin';
import { rspfxCssInlineRule, rspfxSassRule } from '@mbsks/rspfx-compiler-rspack/helpers/css.js';
export default {
  plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react' })],
  module: { rules: [rspfxCssInlineRule(), rspfxSassRule(), { test: /\.png$/, type: 'asset/resource' }] }
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
  css: { modules: { localsConvention: 'asIs' } }
});
```

## Tailwind CSS v4

Tailwind v4 integrates via PostCSS only; no bundler-specific plugin or patch is required.

Install `tailwindcss`, `@tailwindcss/postcss`, and `postcss` (`bun add -D tailwindcss @tailwindcss/postcss postcss`), add `postcss.config.mjs` at the project root, and import Tailwind once in `src/app.css`.

```js
// postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } };
```

```css
/* src/app.css */
@import "tailwindcss";
```

Import `src/app.css` from any web part entry or component (`src/webparts/<name>/<name>WebPart.ts` or `src/webparts/<name>/components/<Name>.tsx`). Vite and Rsbuild auto-detect `postcss.config.*` natively (`tools.postcss` for Rsbuild), and Rspack enables `postcss-loader` only when the config file exists (`packages/compiler-rspack/src/config.ts:37`, `packages/compiler-rspack/src/helpers/css.ts:8`, `packages/plugin/src/rsbuild.ts:70`); `postcss.config.json` plus `postcss.config.ts`/`cts`/`mts` are also supported alongside `postcss.config.js`/`cjs`/`mjs`. Do not add a `TailwindPostCSSPatch` or custom loader; the standard PostCSS detection handles Tailwind v4.

Tailwind v3 requires `content: ["./src/**/*.{js,ts,jsx,tsx,scss,css}"]` in `tailwind.config.js`; `purge: []` triggers a Tailwind 3.4 deprecation warning — use `content` instead.

## SCSS modules vs normal CSS vs global

Files ending in `*.module.css` and `*.module.scss` are CSS Modules: `css-loader` `modules: { auto: /\.module\.\w+$/i, namedExport: false, exportLocalsConvention: 'asIs' }` (implicit `mode: 'local'`) hashes class names and the import returns a mapping.

```ts
// src/webparts/hello/components/Hello.module.scss
.hello { color: var(--helloColor); }
```

```ts
import styles from './Hello.module.scss';
export const Hello = () => <div className={styles.hello}>Hello</div>;
```

Files named `*.css` and `*.scss` without `.module.` are global: selectors apply document-wide and the import has no mapping export. Use for resets, Tailwind entry (`src/app.css`), or third-party CSS.

SCSS requires `sass` (`bun add -D sass`); `sass-loader` `api: "modern"` in `packages/compiler-rspack/src/config.ts:245` and `packages/compiler-rspack/src/helpers/css.ts:95` and `packages/plugin/src/rsbuild.ts:426` compiles `@mixin`, `@include`, `@import`, and `@use`. Install `sass` when any `.scss` or `.sass` file exists; plain `.css` projects do not need it.

## Opt-out and fully custom CSS

Set `build.css: false` in the plugin options to disable the built-in CSS handling and take full ownership of styling.

```ts
// vite.config.ts
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxVite({ name: 'my-app', framework: 'react', build: { css: false } })] };
```

When `build.css: false`, no `style-loader`/`css-loader`/`sass-loader` rules are registered by `packages/compiler-rspack/src/config.ts` or `packages/plugin/src/rsbuild.ts`, and `packages/plugin/src/vite.ts` does not set `build.cssCodeSplit`. Add your own `module.rules` (Rspack), `tools.postcss`/`tools.sass` (Rsbuild), or `css`/`postcss` config (Vite). You remain responsible for inlining: keep `style-loader` or `output.injectStyles: true` or `build.cssCodeSplit: false` so the `.sppkg` has no external CSS dependency.

## Future-proofing

Import the shared helpers from `@mbsks/rspfx-plugin` when they are available: `rspfxCssInlineRule()` and `rspfxSassRule()` from `packages/compiler-rspack/src/helpers/css.ts:38` return the `style-loader` + `css-loader` (`modules: { auto: /\.module\.\w+$/i, namedExport: false, exportLocalsConvention: 'asIs' }`, implicit `mode: 'local'`) and SCSS (`+ sass-loader` `api: "modern"`) rule objects used by `packages/compiler-rspack/src/config.ts:212`; prefer them over hand-written rules to track future loader changes.

PostCSS detection is file-based: presence of `postcss.config.js`, `postcss.config.cjs`, `postcss.config.mjs`, `postcss.config.ts`, `postcss.config.cts`, `postcss.config.mts`, or `postcss.config.json` at the project root enables the transform for all bundlers (`packages/compiler-rspack/src/config.ts:37`, `packages/compiler-rspack/src/helpers/css.ts:8`, `packages/plugin/src/rsbuild.ts:70`); absence disables it with no stub. No `TailwindPostCSSPatch` or framework-specific Tailwind wiring is ever needed; Tailwind v4 is a standard PostCSS plugin via `@tailwindcss/postcss` as shown above.

