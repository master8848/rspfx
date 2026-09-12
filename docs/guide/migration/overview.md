# Migration overview

TL;DR: You can try RSPFx with one file and two installs, migrate with one command, or stay on the official toolchain. This guide helps you pick the path.

RSPFx reads the same `config/` and `src/` files as Heft and gulp. You can switch with little risk and revert when needed.

## Paths

| Path | What you do | When to use |
|---|---|---|
| Try mode (recommended) | add `vite.config.ts` with `devTryMode: true` + two installs | you want to try in an existing project without switching |
| Hybrid dev | run `rspfx dev` with no config | you want zero-file trial (experimental) |
| Full migrate | run `rspfx migrate` | you want to move builds to RSPFx |
| Stay official | keep gulp and Heft | you have blockers or want to wait |

All paths keep your `src/` code and `sharepoint/` assets intact.

## Try in an existing project (recommended)

Add one file and two dev dependencies. Run `rspfx dev` alongside gulp. Production stays on gulp and Heft.

This is the pushed way to try RSPFx in existing projects. See [Try mode](../try-mode.md).

## Migrate an existing project

Run `rspfx migrate --dry-run` to preview, then `rspfx migrate` to apply. The command rewrites configs, writes a bundler file, and backs up to `.rspfx/migrate-backup.json`.

Then run `bun install` and `rspfx package`. See [Migration from SPFx](./migration-from-spfx.md) and [Migrating from gulp and Heft](./migrating-from-gulp-heft.md).

## Check blockers

Review [Why not to migrate](./why-not-to-migrate.md) first. Do not migrate if you target SharePoint 2019 or on premises. Plan a preset if you need a framework RSPFx does not ship.

## Large project example

See [Migration case study](./migration-case-study.md) for a 42k line project that migrated with no `src/` edits.

## Upgrade SPFx version after migrate

Change `spfxVersion` in your bundler config and update `@mbsks/rspfx-plugin`. See [Upgrading SPFx version](./upgrading-spfx-version.md).

## Reference links

- [Commands](../../reference/commands.md)
- [Compatibility](../../reference/compatibility.md)
- [Architecture](../../reference/architecture.md)
