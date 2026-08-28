# React 19

React 19 works with RSPFX — each web part bundles its own React — but Fluent UI is the limiter. See [frameworks.md](frameworks.md) and [compatibility.md](compatibility.md). See Microsoft docs: [SharePoint Framework overview](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/sharepoint-framework-overview) and [SPFx compatibility](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/compatibility).

## Status

| Layer | React 19 | Notes |
|---|---|---|
| RSPFX (`@mbsks/rspfx-framework-react`) | ✅ | `packages/framework-react/src/headless.ts:1` uses `react-dom/client` `createRoot` — same API in React 19. Bundles per web part; no Shared SPFx React. |
| Official SPFx (`@microsoft/sp-*`) | ❌ | SPFx 1.20–1.24 ships React 17 (generator pins `react@17.0.1`, `react-dom@17.0.1`). SharePoint does not provide React 19 at runtime. |
| `@fluentui/react` v8 (`@mbsks/rspfx-fluent-adapter` peer `^8.0.0`) | ⚠️ | Peer `react >=16.8.0 <19.0.0` — install fails or types break on React 19. Source `packages/fluent-adapter/src/index.ts:5` imports `ThemeProvider` from `@fluentui/react`. |
| `@fluentui/react-components` v9 (Fluent v9) | ⚠️ | All v9 packages peer `react >=16.8.0 <19.0.0` / `>=16.14.0 <19.0.0` (see `pnpm-lock.yaml` entries for `@fluentui/react-*`). No official React 19 support yet. |
| Other UI libs (shadcn, Tailwind, Radix) | ✅ | No React version ceiling — use instead of Fluent on React 19. See [styling.md](styling.md) and `examples/shadcn`. |

RSPFX `peerDependencies` in `packages/framework-react/package.json:47` is `react ^18.0.0` / `react-dom ^18.0.0` today. React 19 still runs — override the peer — but Fluent UI is the blocker, not RSPFX.

## When to use React 19

Use React 19 when you don't need `@fluentui/react` v8 or need React 19 features (Actions, `use()`, `useFormStatus`, ref as prop, improved hydration). Keep React 18 when you depend on Fluent v8 / `@fluentui/react-components` v9 or on `@pnp/spfx-controls-react` (which pulls Fluent v8).

If you need both Fluent UI and React 19, track Fluent's React 19 milestone and test in a branch — don't ship to production until Fluent's peers allow `>=19.0.0`.

## 1. Getting React 19 working with RSPFX (SPFx 1.23)

RSPFX externalizes none of `react` / `react-dom` — each web part bundles its own copy (`frameworks.md:108` tip). No SharePoint-provided React is used.

SPFx `1.23` is the target for all React 19 examples here — `spfxVersion: '1.23'` in `vite.config.ts` / `rspack.config.ts` / `rsbuild.config.ts` and matching `@microsoft/sp-*@~1.23.0`.

1. Scaffold or open a project (`rspfx new my-app --framework react --spfx-version 1.23 --bundler vite` or existing `vite.config.ts` with `framework: 'react'`, `spfxVersion: '1.23'`).

The demo below was scaffolded with `rspfx new --framework react --spfx-version 1.23 --bundler vite` and then extended — not hand-written.

2. Bump React:

```sh
bun add react@^19.0.0 react-dom@^19.0.0
bun add -D @types/react@^19.0.0 @types/react-dom@^19.0.0
```

Or `pnpm add` / `npm i` / `yarn add` — same spec.

3. If `bun install` / `pnpm install` errors on Fluent peers, either remove `@fluentui/react` or add an override:

```json
// package.json — only if you must keep @fluentui/react alongside React 19 for trial
{
  "overrides": { "react": "^19.0.0", "react-dom": "^19.0.0" },
  "pnpm": { "overrides": { "react": "^19.0.0", "react-dom": "^19.0.0" } }
}
```

Overrides silence the peer error but don't fix runtime breakage inside Fluent — test manually.

4. Keep `tsconfig.json` `jsx: "react-jsx"` (scaffold default) — no change needed. RSPFX's SWC transform (`packages/framework-react/src/index.ts` preset `jsc.transform.react.runtime: 'automatic'`) works with React 19 JSX.

5. Pin SPFx 1.23 deps:

```sh
bun add @microsoft/sp-core-library@~1.23.0 @microsoft/sp-webpart-base@~1.23.0 @microsoft/sp-property-pane@~1.23.0 @microsoft/sp-component-base@~1.23.0
```

Keep `vite.config.ts` `spfxVersion: '1.23'` — `packages/core/src/versions.ts:13` `SPFX_VERSIONS` is orthogonal to React version when you bundle React per web part.

6. Build and serve:

```sh
rspfx dev        # http://localhost:4321 or workbench https://localhost:4321
rspfx build      # → dist/ + release/
rspfx package    # → sharepoint/solution/*.sppkg
```

Fast refresh (`rspfx dev --refresh`) still uses `@vitejs/plugin-react` / `@rspack/plugin-react-refresh` — works on React 19. See [fast-refresh.md](fast-refresh.md).

## 2. Fluent UI on React 19

`@mbsks/rspfx-fluent-adapter` (`packages/fluent-adapter/package.json:30` peer `@fluentui/react ^8.0.0`) and `@fluentui/react` v8 itself have never declared React 19 support. Installing React 19 alongside `@fluentui/react@8.122.7` yields `EBADENGINE` / `ERESOLVE` or type errors (`Property 'children' is missing` from legacy `React.FC`).

Fluent v9 (`@fluentui/react-components@9.74.4` and all `@fluentui/react-*@9.x`) also caps peers at `<19.0.0` today — check `pnpm-lock.yaml:1857` (`@fluentui/react-calendar-compat` `react >=16.8.0 <19.0.0`) and siblings. This is not RSPFX-specific — upstream has not shipped a React 19-compatible release.

What breaks:

- `ThemeProvider` from `@fluentui/react` (`packages/fluent-adapter/src/index.ts:5`) — `createTheme` / `ThemeProvider` rely on `react <19` context internals.

- Controls that use `ReactDOM.findDOMNode` or legacy `defaultProps` — removed / deprecated in React 19.

- `@pnp/spfx-controls-react` — transitive Fluent v8 dependency — same ceiling.

What still works without Fluent:

- `ReactWebPart` / `createReactAdapter` from `@mbsks/rspfx-framework-react` (`packages/framework-react/src/headless.ts:7`).

- Any headless UI (shadcn/ui, Radix, Tailwind) — see `examples/shadcn` which already avoids Fluent and `examples/vite-react19` which uses Tailwind.

Recommendation:

- On React 19, don't install `@mbsks/rspfx-fluent-adapter` or `@fluentui/react`. Use Fluent v9 only when its peers allow `>=19.0.0`, or use non-Fluent UI and sync SharePoint theme manually (`context.serviceScope` palette) — see `packages/fluent-adapter/src/index.ts:43` `buildFluentTheme` for the palette mapping you can fork.

- On React 18, keep `@mbsks/rspfx-fluent-adapter` + `@fluentui/react@^8.0.0` as documented in [frameworks.md#fluent-ui](frameworks.md#fluent-ui). `bun add @mbsks/rspfx-fluent-adapter @fluentui/react` stays the supported path.

## 3. React Compiler

React Compiler auto-memoizes components and hooks.

Use Vite for the Compiler — Rspack and Rsbuild have no Compiler support.

### Pick your stack

| Stack | Vite | TypeScript | Compiler plugin |
|---|---|---|---|
| Vite 8 (recommended) | `^8.0.0` | `^7.0.0` | `@vitejs/plugin-react@^6.1.0` with `react({ compiler: true })` — Rust (Oxc), official |
| Vite 7 (fallback) | `^7.3.0` | `^5.7.0` | `@rolldown/plugin-babel` + `babel-plugin-react-compiler` — Babel |

Vite 8 uses the official Rust-based plugin — faster, no Babel. Vite 7 uses the Babel fallback.

`examples/vite-react19` uses Vite 8 + TypeScript 7 + Rust.

Requirements: `react`/`react-dom` `^19.0.0` (`packages/framework-react/src/headless.ts:1` `createRoot`), `spfxVersion` `1.23` (`examples/vite-react19/vite.config.ts:8`).

To enable the Compiler, add it in `vite.config.ts` alongside `rspfxVite()` — keep the framework preset.

`reactCompiler: false` disables it. The Compiler must see original JSX before other transforms.

### Install — Vite 8 (recommended, Rust)

```sh
bun add -D vite@^8.0.0 @vitejs/plugin-react@^6.1.0
```

### Install — Vite 7 fallback (Babel)

```sh
bun add -D @rolldown/plugin-babel babel-plugin-react-compiler
```

### Configure `vite.config.ts` — Vite 8 (Rust)

```ts
// vite.config.ts — RSPFX + React 19 + Compiler (Vite 8, SPFx 1.23)
import { defineConfig } from 'vite';
import { rspfxVite } from '@mbsks/rspfx-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.23' }),
    react({ compiler: true }),
  ],
});
```

`react({ compiler: true })` runs Compiler + JSX + fast refresh in one Rust pass.

If two `react()` instances conflict (preset `4.7` vs project `6.1`), pin `@vitejs/plugin-react` to `^6.1.0`.

### Configure `vite.config.ts` — Vite 7 fallback (Babel)

```ts
// vite.config.ts — RSPFX + React 19 + Compiler (Vite 7)
import { defineConfig } from 'vite';
import { rspfxVite } from '@mbsks/rspfx-plugin';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

export default defineConfig({
  plugins: [
    rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.23' }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
```

### Lint and verify

```sh
bun add -D eslint-plugin-react-compiler
rspfx build
npx eslint --ext .ts,.tsx src/
```

Remove manual `memo`/`useMemo`/`useCallback` after verifying the build still passes.

Fast refresh stays compatible.

See `github.com/vitejs/vite-plugin-react/releases/tag/plugin-react%406.1.0`.

## 4. End-to-end example — Tailwind + Valibot + TanStack Form → SharePoint list (React 19 + Vite + Compiler, SPFx 1.23)

Demo project at `examples/vite-react19` — scaffolded via `rspfx new my-app --framework react --spfx-version 1.23 --bundler vite` then extended with Tailwind, Valibot, TanStack Form, PnPjs, and Ox Compiler.

Clone only the example (sparse checkout):

```sh
git clone --filter=blob:none --sparse https://github.com/master8848/rspfx.git
cd rspfx
git sparse-checkout set examples/vite-react19
cd examples/vite-react19
bun install   # or pnpm install / npm install / yarn
```

Full clone alternative: `git clone https://github.com/master8848/rspfx.git && cd rspfx/examples/vite-react19`.

### SharePoint list requirement

Create list `Feedback` on the target site before testing writes — the form posts via PnPjs `sp.web.lists.getByTitle('Feedback').items.add()`.

| Column | Type | Required | Notes |
|---|---|---|---|
| `Title` | Single line of text | Yes | Default title field |
| `Email` | Single line of text | Yes | `Email` internal name |
| `Category` | Choice | Yes | Choices: `Bug`, `Feature`, `Question` — default `Feature` |
| `Message` | Multiple lines of text (plain) | Yes | `Message` internal name |
| `Rating` | Number (1–5) | No | `Rating` internal name, min 1 max 5 |

Create via UI: Site contents → New → List → Blank list → Name `Feedback` → Create → Settings → List settings → Add columns.

Or via PnP CLI / m365:

```sh
m365 spo list add --webUrl https://contoso.sharepoint.com/sites/demo --title Feedback --baseTemplate GenericList
m365 spo field add --webUrl https://contoso.sharepoint.com/sites/demo --listTitle Feedback --xml '<Field DisplayName="Email" Name="Email" Type="Text" Required="TRUE" />'
m365 spo field add --webUrl https://contoso.sharepoint.com/sites/demo --listTitle Feedback --xml '<Field DisplayName="Category" Name="Category" Type="Choice" Required="TRUE"><CHOICES><CHOICE>Bug</CHOICE><CHOICE>Feature</CHOICE><CHOICE>Question</CHOICE></CHOICES><Default>Feature</Default></Field>'
m365 spo field add --webUrl https://contoso.sharepoint.com/sites/demo --listTitle Feedback --xml '<Field DisplayName="Message" Name="Message" Type="Note" Required="TRUE" />'
m365 spo field add --webUrl https://contoso.sharepoint.com/sites/demo --listTitle Feedback --xml '<Field DisplayName="Rating" Name="Rating" Type="Number" Required="FALSE" Min="1" Max="5" />'
```

Grant at least `Edit` on the site to users submitting — `sp.web.lists` add needs `AddListItems`.

### Scaffold and install

```sh
rspfx new feedback-app --framework react --spfx-version 1.23 --bundler vite
cd feedback-app
bun add react@^19.2.0 react-dom@^19.2.0 valibot@^1.1.0 @tanstack/react-form@^1.19.0 @pnp/sp@^4.0.0 @pnp/logging@^4.0.0 @pnp/queryable@^4.0.0
bun add -D @types/react@^19.2.0 @types/react-dom@^19.2.0 tailwindcss@^4.1.12 @tailwindcss/postcss@^4.1.12 postcss@^8.5.0 vite@^8.0.0 @vitejs/plugin-react@^6.1.0 typescript@^7.0.0
```

Package map — why each package:

| Package | Kind | Why |
|---|---|---|
| `react` / `react-dom` `^19.2.0` | `dependencies` | React 19 runtime — bundled per web part via `rspfxVite` (`packages/framework-react/src/headless.ts:1` `createRoot`). |
| `@types/react` / `@types/react-dom` `^19.2.0` | `devDependencies` | TypeScript types for React 19 — `tsconfig.json:7` `jsx: "react-jsx"` needs matching types. |
| `@microsoft/sp-core-library` / `sp-webpart-base` / `sp-property-pane` / `sp-component-base` `~1.23.0` | `dependencies` | SPFx 1.23 contracts — externalized (`packages/plugin/src/vite.ts:299` `externals`) — version must match `spfxVersion: '1.23'` (`packages/core/src/versions.ts:13`). |
| `valibot` `^1.1.0` | `dependencies` | Schema validator — `FeedbackSchema` in `examples/vite-react19/src/webparts/feedback/components/FeedbackForm.tsx:7` — runs on submit. |
| `@tanstack/react-form` `^1.19.0` | `dependencies` | Headless form state — `useForm` + `form.Field` — no UI coupling, works with Tailwind. |
| `@pnp/sp` / `@pnp/logging` / `@pnp/queryable` `^4.0.0` | `dependencies` | PnPjs v4 — `spfi().using(SPFx(context)).web.lists.getByTitle().items.add()` — handles digest, headers, batching. |
| `tailwindcss` `^4.1.12` / `@tailwindcss/postcss` `^4.1.12` / `postcss` `^8.5.0` | `devDependencies` | Tailwind v4 — `postcss.config.mjs:2` `@tailwindcss/postcss` — CSS inlined via `vite.config.ts:8` `rspfxVite` (`build.cssCodeSplit: false` + `packages/plugin/src/vite.ts:282` `assetFileNames`). |
| `vite` `^8.0.0` / `@vitejs/plugin-react` `^6.1.0` with `react({ compiler: true })` | `devDependencies` | Vite 8 + Rust compiler (Oxc) — fast refresh + React Compiler in one pass. Vite 8 uses Rolldown; RSPFX converts ES to AMD via `packages/plugin/src/vite.ts:314` `esToAmd`. |
| `typescript` `^7.0.0` | `devDependencies` | `tsc --noEmit` — `rspfx build` also runs `swc` via `packages/compiler-rspack/src/config.ts:149`. |

Tailwind setup — `postcss.config.mjs` and `src/app.css` already in `examples/vite-react19`:

```js
// postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } };
```

```css
/* src/app.css */
@import "tailwindcss";
```

Import once in `src/webparts/feedback/components/FeedbackForm.tsx:6` — `import '../../../app.css'` — `examples/vite-react19/src/app.css:1` is the Tailwind entry.

`vite.config.ts` is `examples/vite-react19/vite.config.ts:1` — `rspfxVite` with `spfxVersion: '1.23'` + `react({ compiler: true })` (Vite 8 Rust path).

Vite 7 fallback: `vite@^7.3.6` + `@vitejs/plugin-react@^4.7.0` + `@rolldown/plugin-babel` + `babel-plugin-react-compiler` with `react()` + `babel({ presets: [reactCompilerPreset()] })` — see `## 3. React Compiler` Vite 7 section.

Set `compiler: false` or remove the Babel plugin to run without Compiler and compare.

### Form code (Valibot + TanStack Form + Tailwind + PnPjs)

`src/webparts/feedback/feedbackWebPart.ts:1` passes `WebPartContext` to the component — PnPjs uses `SPFx(context)` so no manual `SPHttpClient` fetch.

`src/webparts/feedback/components/FeedbackForm.tsx:7` defines `FeedbackSchema` with `valibot`:

```ts
import * as v from 'valibot';
import { useForm } from '@tanstack/react-form';
import { spfi, SPFx } from '@pnp/sp';
import '@pnp/sp/webs'; import '@pnp/sp/lists'; import '@pnp/sp/items';

const FeedbackSchema = v.object({
  title: v.pipe(v.string(), v.minLength(3), v.maxLength(100)),
  email: v.pipe(v.string(), v.email()),
  category: v.picklist(['Bug','Feature','Question'] as const),
  message: v.pipe(v.string(), v.minLength(10)),
  rating: v.pipe(v.number(), v.minValue(1), v.maxValue(5))
});
```

Submit via PnPjs — not `SPHttpClient` or `curl`:

```ts
onSubmit: async ({ value }) => {
  const parsed = v.parse(FeedbackSchema, value);
  const sp = spfi().using(SPFx(props.context));
  await sp.web.lists.getByTitle(props.listTitle).items.add({
    Title: parsed.title, Email: parsed.email, Category: parsed.category, Message: parsed.message, Rating: parsed.rating
  });
}
```

Full file is `examples/vite-react19/src/webparts/feedback/components/FeedbackForm.tsx:1` — Tailwind classes handle UI, `useForm` + `valibot` handle validation, React Compiler auto-memoizes the component (no manual `useMemo`).

`examples/vite-react19/src/webparts/feedback/feedback.manifest.json:1` uses `supportedHosts` including `SharePointWebPart` and `TeamsTab` — `config/package-solution.json:8` is `includeClientSideAssets: true`.

### Run

```sh
bun install
rspfx dev --tenant https://contoso.sharepoint.com   # https://localhost:4321 + workbench
rspfx dev                                           # http://localhost:4321 local preview (no list writes)
rspfx build && rspfx package                        # → sharepoint/solution/*.sppkg
```

Open the workbench URL printed by `rspfx dev` — add web part `Feedback (React 19)` → submit → verify item in `https://contoso.sharepoint.com/sites/demo/Lists/Feedback`.

Local preview shows the form without SharePoint context — submit will error until list exists and tenant is configured.

Compiler verification: toggle `react({ compiler: true })` ↔ `compiler: false` in `vite.config.ts:14` — build should succeed both ways, Compiler removes manual memo code.

## Verifying

```sh
bun run build   # tsc builds packages/framework-react with React 19 types
rspfx doctor    # checks Node 20+, manifests, sp-* externals, cert
rspfx build && rspfx package
```

If `rspfx build` emits `peer dep` warnings for `@fluentui/react`, you've mixed React 19 + Fluent v8 — remove Fluent or revert to React 18.

## Migrating back to React 18

```sh
bun add react@^18.3.1 react-dom@^18.3.1
bun add -D @types/react@^18.3.0 @types/react-dom@^18.3.0
bun add @fluentui/react@^8.0.0 @mbsks/rspfx-fluent-adapter
```

No `spfxVersion` change needed — `packages/core/src/versions.ts:13` `SPFX_VERSIONS` is orthogonal to React version when you bundle React per web part. Keep `spfxVersion: '1.23'` unless you change SPFx target.

## See also

- [frameworks.md](frameworks.md) — adapter contract, mount semantics, Fluent adapter install.

- [compatibility.md](compatibility.md) — SPFx version matrix (`packages/core/src/versions.ts:13`).

- [styling.md](styling.md) — CSS inlining for Tailwind/shadcn on React 19.

- [internal-api.md](internal-api.md) — `@mbsks/rspfx-framework-react` exports (`/headless`, `/webpart`).

- Microsoft docs: [SPFx compatibility](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/compatibility) and Fluent UI: [Fluent UI React v8](https://developer.microsoft.com/en-us/fluentui#/controls/web) / [Fluent UI React v9](https://react.fluentui.dev/).

- Demo: `examples/vite-react19` — `vite.config.ts:8` `spfxVersion: '1.23'` + React 19 + Tailwind + Valibot + TanStack Form + PnPjs + Ox Compiler.
