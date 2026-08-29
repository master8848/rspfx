# Migration overview

TL;DR: You can try RSPFx with no changes, migrate with one command, or stay on the official toolchain. This guide helps you pick the path.

RSPFx reads the same `config/` and `src/` files as Heft and gulp. You can switch with little risk and revert when needed.

## Paths

| Path | What you do | When to use |
|---|---|---|
| Hybrid dev | run `rspfx dev` only | you want to try without changing files |
| Full migrate | run `rspfx migrate` | you want to move builds to RSPFx |
| Stay official | keep gulp and Heft | you have blockers or want to wait |

All paths keep your `src/` code and `sharepoint/` assets intact.

## Try without migrating

Run `rspfx dev` inside an official SPFx project. Do not add a bundler config. RSPFx synthesizes config from manifests and serves on `https://localhost:4321`.

This mode changes no files and installs no deps. It is the lowest risk trial. See [Hybrid dev](./hybrid-dev.md).

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
