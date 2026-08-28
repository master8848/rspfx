---
layout: home
title: RSPFX — SPFx-compatible build toolchain
titleTemplate: false
hero:
  name: RSPFX
  text: Ship SharePoint web parts without the legacy toolchain
  tagline: SPFx development shouldn't be frustrating. RSPFX dev server runs in seconds with modern tooling (Vite, Rsbuild, Rspack) — not minutes waiting on Heft and webpack.
  image:
    src: /hero.svg
    alt: RSPFX — build SharePoint web parts with Vite
  actions:
    - theme: brand
      text: Get started
      link: /docs/getting-started
    - theme: alt
      text: Why RSPFX?
      link: /docs/why-rspfx
    - theme: alt
      text: View on GitHub
      link: https://github.com/master8848/rspfx

features:
  - title: Zero-config to start
    details: No vite.config.ts required. RSPFX reads config/config.json and your manifests — add config only when you need control.
    link: /docs/getting-started
    linkText: Quick start
  - title: One pipeline, three bundlers
    details: Vite is default. Switch to Rsbuild or Rspack with a single plugin — rspfxVite or rspfxRsbuild, same manifests.
    link: /docs/frameworks
    linkText: Frameworks
  - title: Any framework
    details: React, Vue, Svelte, Solid, Preact — or bring your own preset. @mbsks/rspfx-core has zero dependencies.
    link: /docs/frameworks
    linkText: Supported frameworks
  - title: Doctor & deploy built in
    details: rspfx doctor validates Node, certs, ports and manifests. rspfx deploy publishes straight to the catalog.
    link: /docs/commands
    linkText: Commands
---

<div class="rspfx-proof">
  <div class="rspfx-proof-inner">
    <span class="rspfx-proof-item"><strong>1.20 – 1.24</strong> SPFx targets</span>
    <span class="rspfx-proof-sep" aria-hidden="true">·</span>
    <span class="rspfx-proof-item"><strong>0 deps</strong> core</span>
    <span class="rspfx-proof-sep" aria-hidden="true">·</span>
    <span class="rspfx-proof-item"><strong>Vite · Rsbuild · Rspack</strong></span>
    <span class="rspfx-proof-sep" aria-hidden="true">·</span>
    <span class="rspfx-proof-item"><strong>1 line</strong> <code>spfxVersion</code> switch</span>
  </div>
</div>

<div class="rspfx-home-code">

## Start in seconds

::: code-group

```sh [new project]
npm i -g @mbsks/rspfx-cli
rspfx new my-app
cd my-app
rspfx dev          # http://localhost:4321 — no tenant needed
rspfx package      # → sharepoint/solution/my-app.sppkg
```

```sh [existing project]
# in your existing Heft/gulp SPFx project
rspfx migrate --dry-run   # preview
rspfx migrate             # apply (backup → .rspfx/migrate-backup.json)
bun install               # or pnpm / npm / yarn
rspfx dev                 # same manifests, no config required
```

```ts [only when you need control]
// vite.config.ts — optional
import { rspfxVite } from '@mbsks/rspfx-plugin'
export default { plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.24' })] }
```
:::

> Switch SPFx versions with one line — `spfxVersion: '1.20'` → `'1.24'` — then update your package. See [Compatibility](/docs/compatibility) and [Upgrading SPFx](/docs/upgrading-spfx-version).

</div>

<div class="rspfx-compare">

## How it compares

<div class="rspfx-compare-table">

| | Official toolchain (Heft / gulp) | RSPFX |
|---|---|---|
| Bundler | webpack only | Vite (default), Rsbuild, Rspack |
| Frameworks | React, vanilla | React, Vue, Svelte, Solid, Preact + custom presets |
| SPFx switch | new project / pin updates | one line `spfxVersion` + package manager update |
| Dev server | `gulp serve` :4321 | `rspfx dev` :4321 — tenant optional |
| Package manager | npm / yarn / pnpm | npm · pnpm · yarn · bun · deno |
| Config required | rig + gulpfile required | zero-config from `config/config.json` + manifests |

</div>

</div>

<div class="rspfx-tip">
  <span class="rspfx-tip-kicker">Before first dev</span>
  Run <code>rspfx doctor</code> — it checks Node version, cert trust, port conflicts and missing manifests in one pass.
</div>
