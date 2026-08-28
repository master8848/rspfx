---
layout: home
title: RSPFX — SPFx-compatible build toolchain
titleTemplate: false
hero:
  name: RSPFX
  text: Build SharePoint web parts without the old toolchain
  tagline: No Heft, no webpack, no gulp. Vite by default — Rsbuild and Rspack ready. Same manifests, same .sppkg.
  image:
    src: /hero.svg
    alt: RSPFX
  actions:
    - theme: brand
      text: Get Started
      link: /docs/getting-started
    - theme: alt
      text: Why RSPFX?
      link: /docs/why-rspfx
    - theme: alt
      text: View on GitHub
      link: https://github.com/master8848/rspfx

features:
  - icon: ⚡
    title: Vite by default
    details: No config for standard projects — RSPFX reads config/config.json and your manifests. Add vite.config.ts only when you want more control.
    link: /docs/getting-started
    linkText: Quick start
  - icon: 🦀
    title: Rspack & Rsbuild
    details: Same pipeline, your choice of bundler. Swap the import — rspfxVite, rspfxRsbuild, or the Rspack wrapper — and keep going.
    link: /docs/frameworks
    linkText: Frameworks
  - icon: 🔄
    title: Works alongside gulp + Heft
    details: Keep gulpfile.js next to vite.config.ts. One set of manifests drives both toolchains — no fork, no rewrite.
    link: /docs/hybrid-dev
    linkText: Hybrid dev
  - icon: 🧩
    title: Any framework
    details: React, Vue, Svelte, Solid, Preact — or bring your own preset. The core has no dependencies.
    link: /docs/frameworks
    linkText: Supported frameworks
  - icon: 📦
    title: Real .sppkg, real workbench
    details: Dev server on http://localhost:4321. Build writes dist + release. Package creates sharepoint/solution/*.sppkg for the app catalog and Teams.
    link: /docs/building-packages
    linkText: Packaging
  - icon: 🩺
    title: Doctor & deploy
    details: rspfx doctor checks Node, certs, ports, and manifests. rspfx deploy uploads to the catalog or tells you what to click.
    link: /docs/commands
    linkText: Commands

---

<div class="rspfx-home-stats">
  <div class="rspfx-stat">
    <div class="rspfx-stat-value">1.20 – 1.23</div>
    <div class="rspfx-stat-label">SPFx targets</div>
  </div>
  <div class="rspfx-stat">
    <div class="rspfx-stat-value">0 deps</div>
    <div class="rspfx-stat-label">@mbsks/rspfx-core</div>
  </div>
  <div class="rspfx-stat">
    <div class="rspfx-stat-value">:4321</div>
    <div class="rspfx-stat-label">Workbench dev server</div>
  </div>
  <div class="rspfx-stat">
    <div class="rspfx-stat-value">1 line</div>
    <div class="rspfx-stat-label">spfxVersion switch</div>
  </div>
</div>

<div class="rspfx-home-code">

## Start in seconds

New project — one scaffold, one dev server.

```sh
npm i -g @mbsks/rspfx-cli
rspfx new my-app
cd my-app
rspfx dev          # http://localhost:4321 — no tenant needed
rspfx package      # → sharepoint/solution/my-app.sppkg
```

Existing SPFx project — RSPFX reads what you already have.

```sh
rspfx migrate --dry-run   # preview
rspfx migrate             # apply (backup in .rspfx/migrate-backup.json)
bun install
rspfx dev                 # same manifests, no config required
```

Optional config only when you need it.

```ts
// vite.config.ts — only when you need control
import { rspfxVite } from '@mbsks/rspfx-plugin'
export default { plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.23' })] }
```

> Tip: switch SPFx versions by changing one line — `spfxVersion: '1.20'` → `'1.23'` — then `bun update`. See [Compatibility](/docs/compatibility) and [Upgrading SPFx](/docs/upgrading-spfx-version).

</div>

<div class="rspfx-compare">

## How it compares

| | Official toolchain (Heft / gulp) | RSPFX |
|---|---|---|
| Bundler | webpack only | Vite (default), Rsbuild, Rspack |
| Frameworks | React, vanilla | React, Vue, Svelte, Solid, Preact, plus custom presets |
| SPFx version switch | new project / pin updates | one line `spfxVersion` + `bun update` |
| Dev server | `gulp serve` on :4321 | `rspfx dev` on :4321 — tenant optional, browser only with `--browser` |
| Package manager | npm / yarn / pnpm | npm, yarn, pnpm, Bun, Deno |
| Config required | rig + gulpfile required | zero-config from `config/config.json` + manifests |

</div>

<div class="rspfx-tip">

**Tip:** run `rspfx doctor` before your first `rspfx dev` — it catches Node version, cert trust, port 4321 conflicts, and missing manifests in one pass. Keep both toolchains during migration — `rspfx dev` and `gulp serve` share the same `config/` and `src/` manifests.

</div>

<div class="rspfx-home-code" style="margin-top: 28px;">

## Proven on a real app

`examples/modern-search` is PnP Modern Search — 4 web parts, ~178 files, Fluent UI 8 — migrated with no web part code changes. Read the [case study](/docs/migration-case-study).

</div>
