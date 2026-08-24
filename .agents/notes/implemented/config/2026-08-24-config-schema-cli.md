# Agent Note: Config Schema & CLI

Status: implemented

`packages/core/src/config.ts` adds `tryResolveConfig`/`parseRSPFXConfig` with strict unknown-key rejection and branded `CONFIG_VALIDATION_FAILED` `Issue[]`.

`packages/diagnostics/src/codes.ts` adds `CONFIG_VALIDATION_FAILED` and `MIGRATE_BACKUP_EXISTS`.

`apps/cli/src/config.ts` uses `projectRoot` cache path, `await` factory, `tryResolveConfig` and `createRSPFX`.

`apps/cli/src/cli.ts` handles exhaustive `RspfxErrorCode` including new codes.

`apps/cli/src/commands/migrate.ts` adds `--to`, backup guard and codemods (contributions→rspack, as const, satisfies).

`apps/cli/src/commands/doctor.ts` adds `--fix` via `ensureProjectConfigs`.

Templates emit `defineConfig` with `as const`.

Docs updated: `docs/internal-api.md`, `docs/commands.md`, `docs/architecture.md`.

