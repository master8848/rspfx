# Guides

TL;DR: Guides show you how to build, deploy, and migrate SharePoint Framework solutions with RSPFx. Follow them in order to go from install to production.

RSPFx replaces the SPFx toolchain with Vite, Rsbuild, or Rspack. You keep the same manifests and `.sppkg` output.

Use this page to find the right guide for your task.

## Start here

- [Why RSPFx](./why-rspfx.md) - understand what you gain with RSPFx.
- [Getting started](./getting-started.md) - create a project and run it in four steps.
- [Demos](./demos.md) - explore runnable examples by framework and bundler.

## Build and deploy

- [Dev server](./dev/dev-server.md) - run local preview and workbench on port 4321.
- [Lean dev plugin](./dev-plugin.md) - vite-first dev-only plugin without heavy deps.
- [Deployment guide](./deployment-guide.md) - build, package, and upload to the app catalog.
- [Styling](./styling/styling.md) - handle CSS, SCSS, Tailwind, and inlining.
- [Fast refresh](./styling/fast-refresh.md) - preserve state while you edit.

## Choose your stack

- [Choosing a framework](./frameworks/choosing-a-framework.md) - pick React, Vue, Svelte, or others.
- [React 19](./frameworks/react-19.md) - use React 19 and the compiler with RSPFx.
- [Custom framework guide](./frameworks/custom-framework-guide.md) - add your own framework preset.

## Migration

- [Migration overview](./migration/overview.md) - decide if and how you should migrate.
- [Migration from SPFx](./migration/migration-from-spfx.md) - move an existing project step by step.
- [Migrating from gulp and Heft](./migration/migrating-from-gulp-heft.md) - detailed checklist for gulp and Heft removal.
- [Migration case study](./migration/migration-case-study.md) - see how a large real project migrated.
- [Hybrid dev](./migration/hybrid-dev.md) - try RSPFx dev without changing your project.
- [Upgrading SPFx version](./migration/upgrading-spfx-version.md) - switch SPFx targets with one field.
- [Why not to migrate](./migration/why-not-to-migrate.md) - check blockers before you move.

## Project setup

- [Multi web part](./project-setup/multi-webpart.md) - ship several web parts in one package.
- [Favicon and assets](./project-setup/favicon-and-assets.md) - add icons and static files.
- [Teams and Outlook install](./project-setup/teams-outlook-install.md) - sync your solution to Teams and Outlook.

## Reference links

For exact flags, types, and file paths, see reference:

- [Commands](../reference/commands.md)
- [Architecture](../reference/architecture.md)
- [Compatibility](../reference/compatibility.md)
- [Reference index](../reference/index.md)
