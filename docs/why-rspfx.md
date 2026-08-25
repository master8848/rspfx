# Why RSPFX — how it beats the official SPFx toolchain

The official SharePoint Framework toolchain is a chain of four disconnected generations of tooling bolted together: gulp (task runner) orchestrating Heft (build system) driving webpack (bundler) through a config overlay (`sp-build-core-webpack`, `rush-stack-compiler-…`) — plus a maze of JSON config files.

RSPFX replaces all of it with one modern bundler and zero required config files.

## Zero config for standard layouts

Official SPFx projects need `gulpfile.js`, `tsconfig.json` (with Heft extends), `config/config.json`, `config/serve.json`, `config/write-manifests.json`, `config/package-solution.json` and a `.yo-rc.json` — and the build behavior is spread across all of them.

RSPFX: no manual bundler config needed for standard layouts. Your existing `config/config.json`, `config/package-solution.json`, and `src/*/*.manifest.json` work as-is — `rspfx build` / `bun run build` synthesize the same options and run Vite or Rspack internally.

When you want explicit control, one optional plugin in your bundler config is enough:

```ts
// rspack.config.ts (or vite.config.ts with rspfxVite) — optional
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

Everything else is auto-discovered: web part bundles from `src/webparts/*/`, externals, localized resources, debug manifests, `.sppkg` assembly. See [migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx](migrating-from-gulp-heft.md#same-manifest-for-heftgulp-and-rspfx) for the shared-manifest guarantee and revert via `rspfx migrate --revert`.

> **Tip:** You do not need to install `@microsoft/sp-*` for most web parts. The toolchain externalizes them and emits `"type": "component"` entries so SharePoint resolves its built-in copies. Install `sp-*` only if your code imports that runtime.

## Any modern bundler — not just webpack

| Bundler | Config | Status |
|---|---|---|
| **Vite** (default) | `vite.config.ts` + `rspfxVite` | ✅ build + dev (workbench) |
| **Rsbuild** | `rsbuild.config.ts` + `rspfxRsbuild` | ✅ build + dev (workbench) |
| **Rspack** | `rspack.config.ts` + `RspfxPlugin` | ✅ build + dev (workbench) |
| **Turbopack** | — | ❌ no webpack plugin API; tracked in `docs/roadmap.md` |

The official toolchain only does webpack 5. RSPFX lets you use Vite, Rsbuild, or Rspack.

## Every UI framework — not just React

| Framework | Official SPFx | RSPFX |
|---|---|---|
| React | ✅ | ✅ |
| Vanilla TS | ✅ | ✅ |
| Solid / Preact / Vue / Svelte | ❌ | ✅ |

Official SPFx templates ship React only; the other frameworks are left to community loaders fighting webpack config. RSPFX has first-class framework presets (`@mbsks/rspfx-framework-*`) that contribute their own loaders, refresh runtimes, and web part base classes (`VueWebPart`, `SolidWebPart`, …).

## Faster by construction

- **Vite / Rspack are fast** — 5–10× faster than webpack 5. Rspack caches to `.rspack-cache` between dev runs.
- **No task runner** — the official chain is gulp → Heft → webpack (three processes). RSPFX is `rspfx` → bundler directly.
- **SWC** — TypeScript via native SWC, not slow `ts-loader`.
- **Dev loop** — fast rebuilds, auto reload, fast refresh where supported.

See [performance.md](performance.md) for benchmark methodology.

## Modern by default

- **ESM-only packages** (official SPFx toolchain is CommonJS-era; Heft is deprecated by Microsoft itself)
- **Bring your own CSS tooling** — Tailwind (v2/v3/v4), UnoCSS, or anything else, configured directly in the bundler config when you have one, or via the synthesized defaults
- **Node ≥ 20**, no gulpfile, no Heft, no webpack configs needed in your project
- `rspfx doctor` validates node/ports/dependencies instead of cryptic gulp stack traces
- `rspfx migrate` automates the switch with `--dry-run` preview and `--revert` restore to `.rspfx/migrate-backup.json` (see [commands.md#rspfx-migrate](commands.md#rspfx-migrate))

## Still 100% SPFx-compatible

None of this breaks SharePoint:

- Byte-compatible AMD bundles (`define('<componentId>_<version>', …)`) with the official public-path semantics
- Same `config/config.json` bundle/externals/localized-resource contracts — shared between Heft/Gulp and RSPFX
- Debug manifests served at `/temp/manifests.js` for the real SharePoint workbench
- `.sppkg` packages validated against the same zip layout the app catalog expects, and deployable via `rspfx deploy` or manual upload

## Feature parity where it matters

| Capability | Official toolchain | RSPFX |
|---|---|---|
| Workbench dev server (`:4321` HTTPS) | gulp serve | `rspfx dev` (zero-config — synthesizes from manifests) |
| Web part + app manifests | Heft plugin | auto-generated |
| Localized resources | Heft | built-in (per-locale bundles) |
| `.sppkg` packaging | gulp bundle + package-solution | `rspfx package` (or `bun run build` zero-config) |
| App catalog deploy | manual / CI scripts | `rspfx deploy` (token) |
| Property pane, Teams hosts, full-page | runtime, unaffected | runtime, unaffected |
| Fast refresh | — | `rspfx dev --refresh` (react/preact/vue/svelte/solid; vanilla reloads) |
| Bundle analysis | webpack-bundle-analyzer setup | `rspfx analyze` |
| One-command project creation | `yo @microsoft/sharepoint` | `rspfx new` |
| Migrate existing project | manual edits | `rspfx migrate --dry-run` → `rspfx migrate` → `bun install` |
