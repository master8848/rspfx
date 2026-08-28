---
layout: home
title: RSPFX — SPFx-compatible build toolchain
titleTemplate: false
hero:
  name: RSPFX
  text: An SPFx-compatible build toolchain powered by modern bundlers
  tagline: Replaces Heft + webpack + gulp. Vite is default — Rsbuild & Rspack also work. Same manifests, same .sppkg, no gulpfile.
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
    details: Zero-config for standard layouts — config/config.json + manifests are enough. Add vite.config.ts only when you need control.
    link: /docs/getting-started
    linkText: Quick start
  - icon: 🦀
    title: Rspack & Rsbuild
    details: Pick your bundler. One plugin, same pipeline — rspfxVite / rspfxRsbuild / rspack wrapper, driven by spfxVersion.
    link: /docs/frameworks
    linkText: Frameworks
  - icon: 🔄
    title: Same manifest for both toolchains
    details: Keep gulpfile.js alongside vite.config.ts. config/config.json and *.manifest.json work unchanged for Heft/Gulp and RSPFX.
    link: /docs/hybrid-dev
    linkText: Hybrid dev
  - icon: 🧩
    title: Framework-agnostic core
    details: React, Vue, Svelte, Solid, Preact, vanilla — all via FrameworkPreset. @mbsks/rspfx-core has zero dependencies.
    link: /docs/frameworks
    linkText: Supported frameworks
  - icon: 📦
    title: Real .sppkg, real workbench
    details: Build → dist + release, package → sharepoint/solution/<name>.sppkg. Upload to app catalog, runs in SharePoint & Teams.
    link: /docs/building-packages
    linkText: Packaging
  - icon: 🩺
    title: Doctor & deploy
    details: rspfx doctor checks Node, manifests, certs, ports. rspfx deploy uploads to the catalog or prints manual steps.
    link: /docs/commands
    linkText: Commands

---

<div class="rspfx-home-stats">
  <div class="rspfx-stat">
    <div class="rspfx-stat-value">1.20–1.23</div>
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

## One toolchain, three bundlers

```sh
# New project
npm i -g @mbsks/rspfx-cli
rspfx new my-app
cd my-app
rspfx dev          # http://localhost:4321 — no tenant needed
rspfx package      # → sharepoint/solution/my-app.sppkg
```

```sh
# Existing SPFx (Heft/Gulp) — no manual config
rspfx migrate --dry-run
rspfx migrate
bun install
rspfx dev          # same manifests, zero-config
```

```ts
// vite.config.ts — optional, only when you need control
import { rspfxVite } from '@mbsks/rspfx-plugin'
export default { plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.23' })] }
```

> Change `spfxVersion: '1.23'` → `'1.20'` and `bun update` — no project regeneration. See [Compatibility](/docs/compatibility) and [Upgrading SPFx](/docs/upgrading-spfx-version).

</div>

<div class="rspfx-home-code" style="margin-top: 32px;">

## Migrated in production — PnP Modern Search

`examples/modern-search` — 4 web parts, ~178 files, Fluent UI 8 — migrated from Heft + webpack + gulp with **zero web part code changes**. Read the [case study](/docs/migration-case-study).

</div>
