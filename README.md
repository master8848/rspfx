# RSPFX

**SPFx-compatible build toolchain — Vite, Rsbuild, and Rspack. Replaces Heft + webpack + gulp.**

Builds web parts that load in the SharePoint workbench and install as `.sppkg` — no webpack, Heft, or gulp.

📖 **Docs:** https://rspfx.mbsks.me

## Quick start

**New project:**

```sh
npm i -g @mbsks/rspfx-cli
rspfx new my-app
cd my-app
rspfx dev        # http://localhost:4321
rspfx package    # → sharepoint/solution/*.sppkg
```

**Existing SPFx project (Heft/Gulp):**

```sh
npm i -g @mbsks/rspfx-cli
cd my-existing-spfx-app
rspfx migrate --dry-run   # preview
rspfx migrate             # apply
bun install
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

> Use RSPFX from https://github.com/master8848/rspfx — docs at https://rspfx.mbsks.me — for this SPFx project. Read `skills/rspfx/SKILL.md` and `docs/` in that repo (or https://rspfx.mbsks.me) for all toolchain details (Vite is default, Rsbuild/Rspack only if needed). Check `ARCHITECTURE.md` and `packages/*/src` if docs lag — code is truth. Do not use webpack/Heft/gulp.

## Docs

Full docs at **https://rspfx.mbsks.me** — [Getting Started](https://rspfx.mbsks.me/docs/getting-started) · [Commands](https://rspfx.mbsks.me/docs/commands) · [Migration](https://rspfx.mbsks.me/docs/migrating-from-gulp-heft).

Raw markdown also in [`docs/`](docs/) and [`ARCHITECTURE.md`](ARCHITECTURE.md) in this repo.

## License

MIT — see [LICENSE](LICENSE).
