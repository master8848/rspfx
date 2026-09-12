# Fast refresh

TL;DR: Run `rspfx dev --refresh` to keep component state on save. Supported frameworks patch in place. Vanilla and failures fall back to reload.

Use `rspfx dev` for the most predict state, such as when you debug property panes. Use `rspfx dev --refresh` for fast UI iteration.

## How it works

```
save -> incremental rebuild -> manifest regen -> websocket event -> browser update
  with --refresh: framework HMR patches the tree in place - state stays
  without: full page reload
```

Any HMR failure falls back to reload. The workbench never stays blank.

## Framework support

| Framework | Fast refresh | Mechanism | On save |
|---|---|---|---|
| React | yes | `plugin-react-refresh` | state stays, hooks replay |
| Preact | yes | `plugin-preact-refresh` | state stays |
| Vue | yes | `vue-loader` HMR | tree patched |
| Svelte | yes | `svelte-loader` hotReload | instance via `$set` |
| Solid | yes | `solid-refresh` | signals stay |
| Vanilla | no | none | reload |

Enable with flag or config:

```sh
rspfx dev --refresh
```

Or in bundler config set `dev.fastRefresh: true`.

See [Choosing a framework](../frameworks/choosing-a-framework.md).

## `rspfx dev` vs `rspfx dev --refresh`

|  | `rspfx dev` | `rspfx dev --refresh` |
|---|---|---|
| Save to update | rebuild then reload | rebuild then state patch where supported |
| Frameworks hit | all reload | React, Preact, Vue, Svelte, Solid keep state |
| Failure | reload | reload |

## Comparison with official

| Aspect | Official `gulp serve` | RSPFx |
|---|---|---|
| Hot update | reload only | state patch for five frameworks with `--refresh` |
| Vanilla | reload | reload |
| Failure | reload | reload |

## Missing plugin - warning not break

Fast refresh plugins are build deps. If a plugin is not installed, RSPFx warns and reloads instead of failing:

```
[rspfx] fast-refresh plugin for react is not installed - HMR is disabled
```

Same for `@rspack/plugin-preact-refresh`, `vue-loader`, and `solid-refresh`. Install the peer to enable HMR. Check your terminal if you expect HMR but get reloads.

For flag details, see [../../reference/commands.md](../../reference/commands.md).
