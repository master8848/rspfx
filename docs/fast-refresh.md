# Fast Refresh

## What is real today

Fast refresh in RSPFX mirrors the semantics of a modern HMR pipeline while
keeping the SharePoint workbench as the primary surface:

```
save → Rspack incremental rebuild → onEmit → manifest regeneration → websocket refresh event → web part re-render
  ├─ fast refresh enabled: framework HMR plugin (react/preact/vue/svelte/solid) patches the component tree in place
  └─ otherwise: fallback → full page reload
```

### Refresh cycle (dev-runtime)

- `startServe` creates one `RefreshRuntime` per serve session — but **only when
  fast refresh is enabled** (`--refresh` or `dev.fastRefresh`). Without the
  flag, no runtime exists and nothing extra happens.
- The runtime is wired into the manifest-regeneration cycle: `preserveState()`
  fires before `temp/manifests.js` is regenerated, `restoreState()` after
  (including on failure), and `dispose()` when the server closes. `epoch`
  counts completed regeneration cycles since serve started.
- The runtime is **framework-agnostic bookkeeping**. It does not snapshot
  component state: per-framework state preservation happens in the browser via
  the framework's HMR plugin (see table below). The `framework` argument and
  the `onPreserve`/`onRestore` option callbacks exist so a future integration
  (e.g. a push over the dev-server websocket) can hook into the cycle — nothing
  consumes them yet.

### Fast refresh in the browser

| Framework | Browser-side refresh | Behavior on save |
|---|---|---|
| React | `@rspack/plugin-react-refresh` (added by the preset when `fastRefresh`) | Component state preserved; hooks/effects replayed |
| Preact | `@rspack/plugin-preact-refresh` | Same model as React — state-preserving re-render |
| Vue | `vue-loader` HMR (peer `@vue/compiler-sfc`) | Component tree patched in place; state kept |
| Svelte | `svelte-loader` `hotReload` (`svelte-hmr`) + `mount`/`unmount` (Svelte 5) | Component instance preserved via `$set`, Svelte 5 via `mount`/`unmount` |
| Solid | `solid-refresh` (babel plugin `solid-refresh/babel` with `bundler: 'rspack-esm'` + the runtime it injects, `cacheDirectory:true`) | Component signals preserved; patched via the module registry (`hot.data`-based patch or decline → reload) |
| Vanilla | none | Full reload |

Per-framework failure → full reload (automatic). The workbench never sits blank.

### Missing plugin → loud fallback

The refresh plugins are build-time-only imports. When the real package is not
installed in the project, rspack resolves them to an empty stub instead of
failing the build — the stub logs a warning on the terminal:

```
[rspfx] fast-refresh plugin for react is not installed in this project — HMR
fast refresh is disabled; fallback to full reload. Install
@rspack/plugin-react-refresh to enable it.
```

(same for `@rspack/plugin-preact-refresh`, `vue-loader`, and `solid-refresh` —
see below for how solid differs). The class shapes of the react/preact/vue
stubs are byte-identical to the real plugins' usage (`ReactRefreshRspackPlugin`,
`PreactRefreshRspackPlugin`, `VueLoaderPlugin`), so bundle output is unchanged
when the real package is present — the stub only ever loads when it is not.

Solid differs slightly: the babel plugin is build-time only (a `solid-refresh`
dependency of the preset package), but the *runtime* it injects (`$$registry`,
`$$component`, `$$refresh`, …) is imported by the transformed component modules
in the browser bundle. So for solid the stub is conditional — it is added to
the resolve aliases only when `solid-refresh` cannot be resolved from the
project's `node_modules` walk-up (the rspack path), and it exports no-op
helpers instead of a class, so instrumented modules still evaluate normally.
Either way the outcome is the same: the warning above, no HMR, full reload.

### Not implemented (out of scope)

- Server-side state snapshotting / restore: `preserveState()`/`restoreState()`
  track the cycle; they do not capture component state. Vanilla JS state
  preservation hooks are not implemented.
- A refresh event pushed over the websocket: the dev server exposes `onEmit`;
  the client update path is the framework plugin's own HMR client.

## `rspfx dev --refresh` vs `rspfx dev`

| | `rspfx dev` | `rspfx dev --refresh` |
|---|---|---|
| Config | `dev.fastRefresh` false (default) | `dev.fastRefresh` true / `--refresh` flag |
| Save → update | Rebuild → websocket event → reload path | Rebuild → websocket event → state-preserving refresh (framework runtime) |
| Frameworks affected | all | React/Preact/Vue/Svelte/Solid get state preservation; vanilla reloads |
| RefreshRuntime | not created | tracks the regeneration cycle (preserve/restore/dispose) |
| Failure mode | full reload | full reload (same) |

`--refresh` is a superset: everything in plain `dev` still works; the framework
runtime is just an extra client-side layer. Use plain `dev` when you want maximal
predictability (e.g. debugging a property-pane or theme interaction), and
`--refresh` for component iteration.

Fast refresh is a per-package **compiler contribution** only (the react/preact/
vue/svelte/solid presets add their HMR plugin when `fastRefresh` is enabled;
vanilla has none — nothing runtime). It does not mean the plugin package is
installed; the stub warning above is the source of truth for the actual wiring.
