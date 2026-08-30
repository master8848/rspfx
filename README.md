# RSPFx

**SPFx-compatible build toolchain — Vite, Rsbuild, and Rspack. Replaces Heft + webpack + gulp.**

SPFx development shouldn't be frustrating. RSPFx dev server runs in seconds with modern tooling (Vite, Rsbuild, Rspack) — not minutes waiting on Heft and webpack. Built with agents in mind. 

Builds web parts that load in the SharePoint workbench and install as `.sppkg` — no webpack, Heft, or gulp.

📖 **Docs:** https://rspfx.mbsks.me

## Quick start

RSPFx is a Vite/Rsbuild/Rspack plugin — scaffold with your favorite starter, then add the plugin. Vite is the default. Any starter works (`create-vite`, `better-t-stack`, TanStack Router, etc.).

**New project (bring your own scaffold — recommended):**

```sh
npm create vite@latest my-app -- --template react-ts   # or pnpm create vite@latest / yarn create vite@latest / bun create vite@latest / deno run -A npm:create-vite@latest
cd my-app
npm i -D @mbsks/rspfx-plugin @mbsks/rspfx-cli           # or pnpm add -D / yarn add -D / bun add -D / deno add -D
# add rspfxVite() to vite.config.ts, add src/webparts/*/*.manifest.json + config/package-solution.json
vite dev --port 4321   # dev: vite handles HMR/serve, plugin adds /temp/manifests.js + reload + workbench URL via configureServer
rspfx package    # → sharepoint/solution/*.sppkg (vite build alone does not generate .sppkg)
```

**Lean dev only (Vite users):** for `vite dev` without build/package deps, use the lean plugin (no `@rspack/core`, `sass`, or framework installs):

```sh
npm i -D @mbsks/rspfx-plugin-dev @mbsks/rspfx-cli      # or pnpm add -D / yarn add -D / bun add -D / deno add -D
# vite.config.ts: import { rspfxDevPlugin } from '@mbsks/rspfx-plugin-dev' (or '@mbsks/rspfx-plugin-dev/vite')
```

`@mbsks/rspfx-plugin` = full build + dev + package (`rspfxVite`/`rspfxRsbuild`/`RSpfxPlugin`). `@mbsks/rspfx-plugin-dev` = lean dev-only `configureServer` (`rspfxViteDev`/`rspfxDevPlugin`), vite peer optional, reuses `@mbsks/rspfx-dev-runtime`; both serve `vite dev --port 4321`. `rspfx dev` is an optional CLI alternative using the same runtime. See [lean dev plugin guide](https://rspfx.mbsks.me/docs/guide/dev-plugin).

**Shortcut (scaffold via CLI):**

```sh
npm i -g @mbsks/rspfx-cli   # or pnpm add -g / yarn global add / bun add -g / deno install -g
rspfx new my-app # same as above, but CLI writes Vite + manifests for you
cd my-app
vite dev --port 4321   # or rspfx dev (optional CLI alternative, same runtime)
```

**Existing SPFx project (Heft/Gulp) — try without migrating (recommended):**

One file `vite.config.ts` with `devTryMode: true` and two dev deps. Keep `gulp serve` for production.

```sh
cd my-existing-spfx-app
npm i -D @mbsks/rspfx-plugin @mbsks/rspfx-cli   # or: @mbsks/rspfx-plugin-dev for lean vite-only dev
# add vite.config.ts — see docs at https://rspfx.mbsks.me/docs/guide/try-mode
vite dev --port 4321   # http://localhost:4321 — gulp/heft stay, delete vite.config.ts to revert (or rspfx dev as alternative)
```

Full migrate when ready: `rspfx migrate --dry-run` → `rspfx migrate` → `bun install` → `vite dev --port 4321`.

Requires Node 20+.

## Skill for AI agents

```sh
npx skills add https://github.com/master8848/rspfx --skill rspfx
```

Installs `skills/rspfx/SKILL.md` — the agent guide for building SPFx with RSPFx.

## Agent prompt

Copy-paste to your agent:

> Use RSPFx from https://github.com/master8848/rspfx — docs at https://rspfx.mbsks.me — for this SPFx project. Read `skills/rspfx/SKILL.md` and `docs/` in that repo (or https://rspfx.mbsks.me) for all toolchain details. Scaffold with Vite by default (`npm create vite@latest -- --template react-ts` / `pnpm create vite@latest` / `yarn create vite@latest` / `bun create vite@latest` / `deno run -A npm:create-vite@latest` then add `@mbsks/rspfx-plugin` `rspfxVite()`), or use any starter the user prefers (better-t-stack, Rsbuild, Rspack, TanStack Router, etc.) — RSPFx is just a plugin (`rspfxVite`/`rspfxRsbuild`/`RSpfxPlugin`). Use `rspfx new` only as a shortcut. For existing Heft/gulp projects try without migrating: one file `vite.config.ts` with `devTryMode: true` + `tryComponents: [{ name: 'hello-world' }]` and two installs `npm i -D @mbsks/rspfx-plugin @mbsks/rspfx-cli` then `vite dev --port 4321` (or `rspfx dev` as alternative) — see `docs/guide/try-mode.md`. Dev uses `vite dev` with `rspfxViteDev()` via `configureServer`; `rspfx build`/`rspfx package` remain required for `.sppkg` (vite build alone does not generate it). Check `ARCHITECTURE.md` and `packages/*/src` if docs lag — code is truth. Do not use webpack/Heft/gulp.

## Docs

Full docs at **https://rspfx.mbsks.me** — [Getting Started](https://rspfx.mbsks.me/docs/getting-started) · [Commands](https://rspfx.mbsks.me/docs/commands) · [Migration](https://rspfx.mbsks.me/docs/migrating-from-gulp-heft).

Raw markdown also in [`docs/`](docs/) and [`ARCHITECTURE.md`](ARCHITECTURE.md) in this repo.

## License

MIT — see [LICENSE](LICENSE).
