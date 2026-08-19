# Why RSPFX — how it beats the official SPFx toolchain

The official SharePoint Framework toolchain is a chain of four disconnected generations of tooling bolted together: gulp (task runner) orchestrating Heft (build system) driving webpack (bundler) through a config overlay (`sp-build-core-webpack`, `rush-stack-compiler-…`) — plus a maze of JSON config files.

RSPFX replaces all of it with one modern bundler and one plugin.

## One file instead of five

Official SPFx projects need `gulpfile.js`, `tsconfig.json` (with Heft
extends), `config/config.json`, `config/serve.json`,
`config/write-manifests.json`, `config/package-solution.json` and a
`.yo-rc.json` — and the build behavior is spread across all of them.

RSPFX: one plugin in your bundler config:

```ts
// rspack.config.ts  (or vite.config.ts with rspfxVite)
import { RspfxPlugin } from '@mbsks/rspfx-plugin';

export default {
  mode: 'development',
  plugins: [
    new RspfxPlugin({
      name: 'my-app',
      version: '1.0.0',             // build-time version → AMD names + manifests
      spfxVersion: '1.22',          // which SPFx you target
      framework: 'react',           // vanilla · react · solid · preact · vue · svelte
      dev: {                        // which server, which host
        port: 4321,
        https: true,
        hostname: 'localhost',
        tenantUrl: 'https://contoso.sharepoint.com'
      },
      build: { minify: true }
    })
  ]
};
```

Everything else is auto-discovered: web part bundles from
`src/webparts/*/`, externals, localized resources, debug manifests,
`.sppkg` assembly.

## Any modern bundler — not just webpack

| Bundler | Config | Status |
|---|---|---|
| **Rspack** (Rust webpack successor) | `rspack.config.ts` + `RspfxPlugin` | ✅ default, fully supported |
| **Vite** (Rollup + esbuild) | `vite.config.ts` + `rspfxVite` | ✅ build + dev (workbench) |
| **Rsbuild** (Rspack-based build tool) | `rsbuild.config.ts` + `rspfxRsbuild` | ✅ build + dev (workbench) |
| **Turbopack** | — | ❌ not possible today — Turbopack has no webpack plugin API and no standalone CLI outside Next.js; tracked in `docs/roadmap.md` |

The official toolchain is hardwired to webpack 5. If you want Vite or Rspack,
you can't have SPFx.

## Every UI framework — not just React

| Framework | Official SPFx | RSPFX |
|---|---|---|
| React | ✅ | ✅ |
| Vanilla TS | ✅ | ✅ |
| Solid / Preact / Vue / Svelte | ❌ | ✅ |

Official SPFx templates ship React only; the other frameworks are left to
community loaders fighting webpack config. RSPFX has first-class framework
presets (`@mbsks/rspfx-framework-*`) that contribute their own loaders,
refresh runtimes, and web part base classes (`VueWebPart`, `SolidWebPart`, …).

## Faster by construction

- **Rspack is Rust-based** — 5–10× faster cold builds than webpack 5, with
  persistent caching between dev runs (`.rspack-cache`).
- **No task-runner hop**: gulp → Heft → webpack is three process
  generations; RSPFX is `rspfx` → Rspack/Vite directly.
- **TS/SWX**: TypeScript compiles through SWC (native), not
  `ts-loader`-style per-file transpiles.
- **Dev loop**: in-process dev server, `writeToDisk` bundles, regenerated
  `manifests.js`, fast refresh where the framework supports it.

See [docs/performance.md](performance.md) for benchmark methodology.

## Modern by default

- **ESM-only packages** (official SPFx toolchain is CommonJS-era; Heft is
  deprecated by Microsoft itself)
- **Bring your own CSS tooling** — Tailwind (v2/v3/v4), UnoCSS, or anything else, configured directly in the bundler config
- **Node ≥ 20**, no gulpfile, no Heft, no webpack configs anywhere in your
  project
- `rspfx doctor` validates node/ports/dependencies instead of cryptic
  gulp stack traces

## Still 100% SPFx-compatible

None of this breaks SharePoint:

- Byte-compatible AMD bundles (`define('<componentId>_<version>', …)`) with
  the official public-path semantics
- Same `config/config.json` bundle/externals/localized-resource contracts
- Debug manifests served at `/temp/manifests.js` for the real SharePoint
  workbench
- `.sppkg` packages validated against the same zip layout the app catalog
  expects, and deployable via `rspfx deploy` or manual upload

## Feature parity where it matters

| Capability | Official toolchain | RSPFX |
|---|---|---|
| Workbench dev server (`:4321` HTTPS) | gulp serve | `rspfx dev` |
| Web part + app manifests | Heft plugin | auto-generated |
| Localized resources | Heft | built-in (per-locale bundles) |
| `.sppkg` packaging | gulp bundle + package-solution | `rspfx package` |
| App catalog deploy | manual / CI scripts | `rspfx deploy` (token) |
| Property pane, Teams hosts, full-page | runtime, unaffected | runtime, unaffected |
| Fast refresh | — | `rspfx dev --refresh` (react/preact/vue/svelte/solid; vanilla reloads) |
| Bundle analysis | webpack-bundle-analyzer setup | `rspfx analyze` |
| One-command project creation | `yo @microsoft/sharepoint` | `rspfx new` |
