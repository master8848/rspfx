# Fast Refresh

State-preserving hot updates for supported frameworks during `rspfx dev`. Vanilla JS falls back to a full reload.

> **Tip:** Use `rspfx dev` for maximal predictability (debugging property panes, themes). Use `rspfx dev --refresh` for fast component iteration — it's a superset that only adds HMR where available.

## How it works

```
save → incremental rebuild → manifest regeneration → websocket event → browser update
  ├─ --refresh enabled: framework HMR patches the component tree in place (state preserved)
  └─ otherwise: full page reload
```

Any failure in a framework's HMR runtime falls back to a full reload automatically — the workbench never sits blank.

## Framework support

| Framework | Fast refresh | Mechanism | Behavior on save |
|---|---|---|---|
| React | ✅ | `plugin-react-refresh` (from preset when `--refresh`) | Component state preserved; hooks replayed |
| Preact | ✅ | `plugin-preact-refresh` | State-preserving re-render |
| Vue | ✅ | `vue-loader` HMR (peer `@vue/compiler-sfc`) | Component tree patched in place |
| Svelte | ✅ | `svelte-loader` hotReload | Instance preserved via `$set` (Svelte 5: `mount`/`unmount`) |
| Solid | ✅ | `solid-refresh` babel plugin | Signals preserved via module registry |
| Vanilla | — | None | Full reload |

Enable with `rspfx dev --refresh` or `dev.fastRefresh: true` in your bundler config. See [commands.md#rspfx-dev](commands.md#rspfx-dev) and [frameworks.md#fast-refresh-support](frameworks.md#fast-refresh-support).

## `rspfx dev` vs `rspfx dev --refresh`

| | `rspfx dev` | `rspfx dev --refresh` |
|---|---|---|
| Save → update | Rebuild → reload | Rebuild → state-preserving refresh (where supported) |
| Frameworks affected | All reload | React/Preact/Vue/Svelte/Solid preserve state; vanilla reloads |
| Failure mode | Full reload | Full reload (same) |

## Comparison vs official

| Aspect | Official SPFx (`gulp serve`) | RSPFX |
|---|---|---|
| Hot update | Full reload only | State-preserving for react/preact/vue/svelte/solid with `--refresh` |
| Vanilla JS | Reload | Reload (same) |
| Failure handling | Reload | Reload (same, automatic) |

## Missing plugin → warning, not breakage

Fast refresh plugins are build-time dependencies. If the plugin package isn't installed, RSPFX logs a warning and falls back to full reload instead of failing the build:

```
[rspfx] fast-refresh plugin for react is not installed — HMR is disabled; fallback to full reload. Install @rspack/plugin-react-refresh to enable it.
```

Same for `@rspack/plugin-preact-refresh`, `vue-loader`, and `solid-refresh`. Install the missing peer to enable HMR.

> **Tip:** If you expected HMR but get full reloads, check the terminal for this warning — it's the source of truth for whether the plugin is wired up.
