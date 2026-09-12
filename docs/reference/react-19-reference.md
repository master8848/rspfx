# React 19 reference

This page lists the technical status, package map, and compiler stack for React 19 with RSPFx.

For tutorial steps see `docs/react-19.md`; for mount semantics see `docs/frameworks.md` and version matrix `docs/compatibility.md`.

## Status

| Layer | React 19 | Notes | Source |
|---|---|---|---|
| RSPFx (`@mbsks/rspfx-framework-react`) | ✅ | `createRoot` from `react-dom/client` — same API in React 19; bundles per web part, no Shared SPFx React | `packages/framework-react/src/headless.ts:1` |
| Official SPFx (`@microsoft/sp-*`) | ❌ | SPFx 1.20–1.24 ships React 17 (`react@17.0.1`, `react-dom@17.0.1`); SharePoint does not provide React 19 | `packages/core/src/versions.ts:13` |
| `@fluentui/react` v8 (`@mbsks/rspfx-fluent-adapter` peer `^8.0.0`) | ⚠️ | Peer `react >=16.8.0 <19.0.0` — install fails or types break on React 19 | `packages/fluent-adapter/src/index.ts:5` `ThemeProvider` |
| `@fluentui/react-components` v9 | ⚠️ | All v9 peers `react >=16.8.0 <19.0.0` / `>=16.14.0 <19.0.0`; no React 19 support | `pnpm-lock.yaml` entries for `@fluentui/react-*` |
| Other UI libs (shadcn, Tailwind, Radix) | ✅ | No React ceiling — use instead of Fluent on React 19 | `examples/shadcn`, `examples/vite-react19` |

`packages/framework-react/package.json:47` peers are `react ^18.0.0` / `react-dom ^18.0.0` today; React 19 runs with override but Fluent is blocker.

## Compiler stack

Use Vite for the Compiler — Rspack and Rsbuild have no Compiler support.

| Stack | Vite | TypeScript | Compiler plugin | Transform |
|---|---|---|---|---|
| Vite 8 (recommended) | `^8.0.0` | `^7.0.0` | `import react from '@vitejs/plugin-react@^6.1.0'` with `react({ compiler: true })` | Rust (Oxc), official |
| Vite 7 (fallback) | `^7.3.0` | `^5.7.0` | `import react, { reactCompilerPreset } from '@vitejs/plugin-react'` + `import babel from '@rolldown/plugin-babel'` with `babel-plugin-react-compiler` | Babel |

Vite 8 uses Rolldown; RSPFx converts ES to AMD via `packages/plugin/src/vite.ts:314` `esToAmd`.

### Vite 8 config (Rust)

```ts
// vite.config.ts — RSPFx + React 19 + Compiler (Vite 8, SPFx 1.23)
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

`react({ compiler: true })` runs Compiler + JSX + fast refresh in one Rust pass. If two `react()` instances conflict, pin `@vitejs/plugin-react` to `^6.1.0`.

### Vite 7 fallback (Babel)

```ts
// vite.config.ts — RSPFx + React 19 + Compiler (Vite 7)
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

Lint: `bun add -D eslint-plugin-react-compiler` + `npx eslint --ext .ts,.tsx src/`.

## Package map — React 19 example (SPFx 1.23)

Demo: `examples/vite-react19` (`vite.config.ts:8` `spfxVersion: '1.23'`).

| Package | Kind | Version | Why |
|---|---|---|---|
| `react` / `react-dom` | `dependencies` | `^19.0.0` | React 19 runtime — bundled per web part (`packages/framework-react/src/headless.ts:1` `createRoot`) |
| `@types/react` / `@types/react-dom` | `devDependencies` | `^19.0.0` | Types for `jsx: "react-jsx"` (`tsconfig.json:7`) |
| `@microsoft/sp-core-library` / `sp-webpart-base` / `sp-property-pane` / `sp-component-base` | `dependencies` | `~1.23.0` | SPFx 1.23 contracts — externalized (`packages/plugin/src/vite.ts:299` `externals`) — must match `spfxVersion: '1.23'` (`packages/core/src/versions.ts:13`) |
| `valibot` | `dependencies` | `^1.1.0` | Schema validator (`examples/vite-react19/src/webparts/feedback/components/FeedbackForm.tsx:7`) |
| `@tanstack/react-form` | `dependencies` | `^1.19.0` | Headless form state (`useForm` + `form.Field`) |
| `@pnp/sp` / `@pnp/logging` / `@pnp/queryable` | `dependencies` | `^4.0.0` | PnPjs v4 — `spfi().using(SPFx(context)).web.lists` |
| `tailwindcss` / `@tailwindcss/postcss` / `postcss` | `devDependencies` | `^4.1.12` / `^8.5.0` | Tailwind v4 — `postcss.config.mjs:2`; CSS inlined via `build.cssCodeSplit: false` (`packages/plugin/src/vite.ts:282`) |
| `vite` / `@vitejs/plugin-react` | `devDependencies` | `^8.0.0` / `^6.1.0` with `react({ compiler: true })` | Vite 8 + Rust compiler |
| `typescript` | `devDependencies` | `^7.0.0` | `tsc --noEmit` + `swc` via `packages/compiler-rspack/src/config.ts:149` |

RSPFx externalizes none of `react`/`react-dom` — each web part bundles its own copy (`docs/frameworks.md` tip).

Pin SPFx 1.23 deps:

```sh
bun add react@^19.0.0 react-dom@^19.0.0
bun add -D @types/react@^19.0.0 @types/react-dom@^19.0.0
bun add @microsoft/sp-core-library@~1.23.0 @microsoft/sp-webpart-base@~1.23.0 @microsoft/sp-property-pane@~1.23.0 @microsoft/sp-component-base@~1.23.0
```

Override Fluent peer only for trial:

```json
{ "overrides": { "react": "^19.0.0", "react-dom": "^19.0.0" }, "pnpm": { "overrides": { "react": "^19.0.0", "react-dom": "^19.0.0" } } }
```

## Verification

```sh
bun run build   # tsc builds packages/framework-react with React 19 types
rspfx doctor    # checks Node 20+, manifests, sp-* externals, cert
rspfx build && rspfx package
```

If `rspfx build` warns on `@fluentui/react` peer, remove Fluent or revert to React 18 (`bun add react@^18.3.1 react-dom@^18.3.1`).
