# RSPFX

**SPFx-compatible build toolchain — Vite, Rsbuild, and Rspack. Replaces Heft + webpack + gulp.**

SPFx development shouldn't be frustrating. RSPFX dev server runs in seconds with modern tooling (Vite, Rsbuild, Rspack) — not minutes waiting on Heft and webpack. Built with agents in mind. 

Builds web parts that load in the SharePoint workbench and install as `.sppkg` — no webpack, Heft, or gulp.

📖 **Docs:** https://rspfx.mbsks.me

## Quick start

RSPFX is a Vite/Rsbuild/Rspack plugin — scaffold with your favorite starter, then add the plugin. Vite is the default. Any starter works (`create-vite`, `better-t-stack`, TanStack Router, etc.).

**New project (bring your own scaffold — recommended):**

```sh
npm create vite@latest my-app -- --template react-ts   # or pnpm create vite@latest / yarn create vite@latest / bun create vite@latest / deno run -A npm:create-vite@latest
cd my-app
npm i -D @mbsks/rspfx-plugin @mbsks/rspfx-cli           # or pnpm add -D / yarn add -D / bun add -D / deno add -D
# add rspfxVite() to vite.config.ts, add src/webparts/*/*.manifest.json + config/package-solution.json
rspfx dev        # http://localhost:4321
rspfx package    # → sharepoint/solution/*.sppkg
```

**Shortcut (scaffold via CLI):**

```sh
npm i -g @mbsks/rspfx-cli   # or pnpm add -g / yarn global add / bun add -g / deno install -g
rspfx new my-app # same as above, but CLI writes Vite + manifests for you
cd my-app
rspfx dev
```

**Existing SPFx project (Heft/Gulp):**

```sh
npm i -g @mbsks/rspfx-cli   # or pnpm add -g / yarn global add / bun add -g / deno install -g
cd my-existing-spfx-app
rspfx migrate --dry-run   # preview
rspfx migrate             # apply
bun install      # or pnpm install / npm install / yarn / deno install
rspfx dev
```

Requires Node 20+.

## Skill for AI agents

```sh
npx skills add https://github.com/master8848/rspfx --skill rspfx
```

Installs `skills/rspfx/SKILL.md` — the agent guide for building SPFx with RSPFX.

## Agent prompt

Copy-paste to your agent:

> Use RSPFX from https://github.com/master8848/rspfx — docs at https://rspfx.mbsks.me — for this SPFx project. Read `skills/rspfx/SKILL.md` and `docs/` in that repo (or https://rspfx.mbsks.me) for all toolchain details. Scaffold with Vite by default (`npm create vite@latest -- --template react-ts` / `pnpm create vite@latest` / `yarn create vite@latest` / `bun create vite@latest` / `deno run -A npm:create-vite@latest` then add `@mbsks/rspfx-plugin` `rspfxVite()`), or use any starter the user prefers (better-t-stack, Rsbuild, Rspack, TanStack Router, etc.) — RSPFX is just a plugin (`rspfxVite`/`rspfxRsbuild`/`RSpfxPlugin`). Use `rspfx new` only as a shortcut. Check `ARCHITECTURE.md` and `packages/*/src` if docs lag — code is truth. Do not use webpack/Heft/gulp.

## Docs

Full docs at **https://rspfx.mbsks.me** — [Getting Started](https://rspfx.mbsks.me/docs/getting-started) · [Commands](https://rspfx.mbsks.me/docs/commands) · [Migration](https://rspfx.mbsks.me/docs/migrating-from-gulp-heft).

Raw markdown also in [`docs/`](docs/) and [`ARCHITECTURE.md`](ARCHITECTURE.md) in this repo.

## License

MIT — see [LICENSE](LICENSE).
