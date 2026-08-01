# Fast Refresh

## Design

Fast refresh in RSPFX mirrors the semantics of a modern HMR pipeline while
keeping the SharePoint workbench as the primary surface:

```
save → Rspack incremental rebuild → websocket refresh event → adapter re-mount
  ├─ framework runtime preserves component state where supported
  └─ otherwise → fallback: full page reload
```

- `dev-runtime` owns the refresh orchestration: it listens for rebuild events
  (via `compiler-rspack`'s `watch`/dev-server `onEmit`), regenerates
  `temp/manifests.js`, and pushes a refresh message over the websocket.
- `createRefreshRuntime(framework)` returns a per-framework `RefreshRuntime`
  (`preserveState()` / `restoreState()` / `dispose()`). The framework adapter's
  `supportsFastRefresh()` decides whether the runtime is state-preserving.
- **Fallback is mandatory and automatic**: if a framework runtime errors, or the
  framework has no runtime, the page does a full reload — the workbench must
  never sit blank.

The manifest server and workbench are unaffected by refresh mode; only the
client-side update path changes.

## Per-framework runtime notes

| Framework | Runtime | Behavior on save |
|---|---|---|
| React | `@rspack/plugin-react-refresh` | Component state preserved; hooks/effects replayed; props from `getComponentProps()` re-applied via `update()` |
| Preact | `@rspack/plugin-preact-refresh` | Same model as React — state-preserving re-render |
| Vue | `vue-loader` HMR (peer `@vue/compiler-sfc`) | Component tree patched in place; state kept |
| Svelte | `svelte-loader` `hotReload` (`svelte-hmr`) | Component instance re-created with preserved state |
| Solid | `babel-preset-solid` (+ solid-refresh in dev) | ⚠️ Partial — compiler support present, but refresh currently resolves to **full reload** |
| Vanilla | none (`RefreshRuntime` is a no-op) | Full reload |

Per-framework failure → full reload (automatic).

## `rspfx dev --refresh` vs `rspfx dev`

| | `rspfx dev` | `rspfx dev --refresh` |
|---|---|---|
| Config | `dev.fastRefresh` false (default) | `dev.fastRefresh` true / `--refresh` flag |
| Save → update | Rebuild → websocket event → reload path | Rebuild → websocket event → state-preserving refresh (framework runtime) |
| Frameworks affected | all | React/Preact/Vue/Svelte get state preservation; Solid and vanilla reload |
| Failure mode | full reload | full reload (same) |

`--refresh` is a superset: everything in plain `dev` still works; the framework
runtime is just an extra client-side layer. Use plain `dev` when you want maximal
predictability (e.g. debugging a property-pane or theme interaction), and
`--refresh` for component iteration.
