# Reference

Reference gives you exact details for RSPFx imports, types, flags, and behavior.

You use it to look up a specific answer without reading a guide.

Each page describes current behavior and lists exact signatures and options.

Reference does not teach workflows; it records what the code does today.

## How to use reference

Search for the package, file, flag, or type you need.

Read the signature, options, and defaults on that page.

Check the linked source file when you need implementation details.

## What you find in each section

CLI reference lists commands, flags, and environment variables for `@mbsks/rspfx-cli`.

See `docs/commands.md` for flags such as `--dry-run`, `--tenant`, and `--refresh`.

It also documents `RSPFX_LOG_LEVEL`, `SPFX_SERVE_TENANT_DOMAIN`, `RSPFX_ACCESS_TOKEN`, and `RSPFX_APP_CATALOG_URL`.

Package API lists exports and types for `@mbsks/rspfx-core` and `@mbsks/rspfx-plugin`.

See `docs/internal-api.md` for package surfaces and import paths.

Pipeline reference describes the build pipeline and file responsibilities.

See `docs/architecture.md` for stages and the files that own them.

Compatibility reference lists the SPFx version matrix and support status.

See `docs/compatibility.md` for the version table.

Version history lives in `CHANGELOG.md` with one `## [X.Y.Z] - YYYY-MM-DD` section per version.

Each changelog section links to git tag `vX.Y.Z` and npm dist-tag `latest` or `next`.

## Reference versus guide

Use guides when you want to learn a task step by step.

Use reference when you want to confirm an import path, flag, or type.

Guides show the sequence; reference shows the contract.
