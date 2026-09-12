# React 19

TL;DR: You can use React 19 with RSPFx today. Bundle React per web part, avoid Fluent UI on React 19, and use Vite for the React Compiler.

RSPFx bundles `react` and `react-dom` per web part. SharePoint does not provide React 19 at runtime. See [Choosing a framework](./choosing-a-framework.md).

## Status

| Layer | React 19 support | Notes |
|---|---|---|
| RSPFx framework React | yes | uses `createRoot` from `react-dom/client` |
| Official SPFx `sp-*` | no | ships React 17 |
| `@fluentui/react` v8 | no | peer caps at `<19.0.0` |
| `@fluentui/react-components` v9 | no | peer caps at `<19.0.0` |
| Other UI libs like shadcn | yes | no version ceiling |

RSPFx peers list `react ^18.0.0` today. React 19 runs if you override the peer, but Fluent UI stays the blocker.

## When to use React 19

Use React 19 when you need Actions, `use()`, ref as prop, or better hydration, and you do not need Fluent v8.

Stay on React 18 when you depend on Fluent v8, Fluent v9, or `spfx-controls-react`.

<Steps>

## Step 1: Scaffold with SPFx 1.23

Create a project with `spfxVersion: '1.23'`:

```sh
rspfx new my-app --framework react --spfx-version 1.23 --bundler vite --yes
```

## Step 2: Bump React to 19

Update React and its types:

```sh
bun add react@^19.0.0 react-dom@^19.0.0
bun add -D @types/react@^19.0.0 @types/react-dom@^19.0.0
```

Use the same spec with `pnpm add`, `npm i`, or `yarn add`.

## Step 3: Handle Fluent peers if needed

If install fails on Fluent peers, remove `@fluentui/react` or add an override for trial:

```json
{
  "overrides": { "react": "^19.0.0", "react-dom": "^19.0.0" },
  "pnpm": { "overrides": { "react": "^19.0.0", "react-dom": "^19.0.0" } }
}
```

Overrides hide the peer error. They do not fix runtime breaks inside Fluent. Test manually.

## Step 4: Pin SPFx 1.23 deps

Install SPFx 1.23 contracts if you import that runtime:

```sh
bun add @microsoft/sp-core-library@~1.23.0 @microsoft/sp-webpart-base@~1.23.0 @microsoft/sp-property-pane@~1.23.0
```

Keep `spfxVersion: '1.23'` in `vite.config.ts`. It is separate from your React version when you bundle React per web part.

```ts
import { defineConfig } from 'vite';
import { rspfxVite } from '@mbsks/rspfx-plugin';
export default defineConfig({ plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.23' })] });
```

## Step 5: Build and serve

Run the dev server and build:

```sh
rspfx dev
rspfx build
rspfx package
```

Fast refresh with `rspfx dev --refresh` still works on React 19. See [Fast refresh](../styling/fast-refresh.md).

</Steps>

## Fluent UI on React 19

Do not install `@mbsks/rspfx-fluent-adapter` or `@fluentui/react` on React 19. Both cap peers below 19. Controls that use `findDOMNode` or legacy `defaultProps` break on React 19.

Use headless UI like shadcn, Radix, or Tailwind on React 19. You can sync the SharePoint theme by forking the palette logic from `packages/fluent-adapter/src/index.ts`.

On React 18, keep the Fluent adapter:

```sh
bun add @mbsks/rspfx-fluent-adapter @fluentui/react
```

## React Compiler

Use Vite for the Compiler. Rspack and Rsbuild do not support it.

| Stack | Vite | Compiler plugin |
|---|---|---|
| Vite 8 | `^8.0.0` | `@vitejs/plugin-react@^6.1.0` with `react({ compiler: true })` |
| Vite 7 | `^7.3.0` | `@rolldown/plugin-babel` + `babel-plugin-react-compiler` |

Vite 8 uses Rust via Oxc and is faster. Vite 7 uses Babel as fallback.

**Vite 8 setup:**

```sh
bun add -D vite@^8.0.0 @vitejs/plugin-react@^6.1.0
```

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { rspfxVite } from '@mbsks/rspfx-plugin';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.23' }), react({ compiler: true })],
});
```

**Vite 7 setup:**

```ts
import { defineConfig } from 'vite';
import { rspfxVite } from '@mbsks/rspfx-plugin';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
export default defineConfig({
  plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.23' }), react(), babel({ presets: [reactCompilerPreset()] })],
});
```

Set `compiler: false` to disable it. Keep JSX intact before other transforms.

Verify with:

```sh
rspfx build
npx eslint --ext .ts,.tsx src/
```

## Example: React 19 + Tailwind + form + PnPjs

See `examples/vite-react19` for a full demo. It uses React 19, Vite 8, Tailwind v4, Valibot, TanStack Form, and PnPjs.

It posts to a SharePoint list named `Feedback`. Create that list with columns `Title`, `Email`, `Category`, `Message`, and `Rating` before you test writes.

```ts
import * as v from 'valibot';
const FeedbackSchema = v.object({
  title: v.pipe(v.string(), v.minLength(3)),
  email: v.pipe(v.string(), v.email()),
  category: v.picklist(['Bug','Feature','Question'] as const),
  message: v.pipe(v.string(), v.minLength(10)),
  rating: v.pipe(v.number(), v.minValue(1), v.maxValue(5))
});
```

Submit with PnPjs:

```ts
import { spfi, SPFx } from '@pnp/sp';
const sp = spfi().using(SPFx(props.context));
await sp.web.lists.getByTitle(props.listTitle).items.add({ Title: parsed.title, Email: parsed.email });
```

Run it with:

```sh
bun install
rspfx dev --tenant https://contoso.sharepoint.com
```

For exact types and flags, see [../../reference/react-19-reference.md](../../reference/react-19-reference.md) and [../../reference/commands.md](../../reference/commands.md).
