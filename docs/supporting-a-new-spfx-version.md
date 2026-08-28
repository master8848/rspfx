# Supporting a new SPFx version — maintainer-only

Process for adding a new `spfxVersion` target. Formats are harvested from official npm packages, not docs or memory — verify byte-level. See Microsoft docs: [SPFx compatibility](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/compatibility) and [Release 1.23](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.23).

## Source of truth

Single file `packages/core/src/versions.ts:13` (`SPFX_VERSIONS`, `SPFX_DEFAULT_TARGET`, `SPFX_TARGETS`, `spfxNpmVersion()`). All consumers derive from it: config default, CLI prompts/validation, `rspfx doctor`, scaffold pins. Adding a target is one entry. Current matrix → [compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix).

## Detect a new release

| Signal | Where |
|---|---|
| npm dist-tags | `npm dist-tag ls @microsoft/generator-sharepoint` (`@latest`=GA, `@next`=preview) |
| Release notes | [SPFx releases](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.23) — replace `1.23` with target version (`1.22`, `1.21`, …) |
| Repo | `github.com/SharePoint/spfx` (open since 1.23) |

Wait for GA. Preview risks drifting scaffold pins.

## Release notes — what matters

| Signal | Impact |
|---|---|
| New component type (e.g. Copilot Apps) | New manifest shape, possibly new packaging elements |
| Schema changes | Check [SPFx schemas](https://developer.microsoft.com/json-schemas/spfx/client-side-web-part-manifest.schema.json) and [write-manifests schema](https://developer.microsoft.com/json-schemas/spfx-build/write-manifests.schema.json) |
| Deprecations (e.g. 1.23 workbench) | Dev URL, not bundle format |
| Toolchain shift (Heft since 1.23) | Official scaffold shape, not RSPFX format |

## Harvest (core methodology)

1. In scratch dir `npm pack` the official packages at target version: `@microsoft/spfx-heft-plugins`, `@microsoft/sp-build-web`, `@microsoft/sp-webpart-base`, and all `@microsoft/sp-*` runtimes.
2. Extract: component IDs/`version`/`preloadComponents` from `node_modules/@microsoft/sp-*/dist/*.manifest.json`; formats (manifest builder, AMD wrapper, `manifests.js`, `.sppkg` layout, workbench URL) from build plugins.
3. Record provenance in `reference/FORMATS.md` per section (exact versions harvested).
4. On discrepancy verify against an unzipped official `.sppkg` before changing code.

## Diff & update references

Compare IDs, manifest schema, bundle wrapper, `manifests.js`, `.sppkg` layout, `package-solution.json` semantics vs current. Update `reference/FORMATS.md`, `reference/sp-component-ids.json`, and its compiled copy `packages/manifest-generator/src/data/component-ids.ts` in sync.

## Add version

```ts
{ target: '1.24', npmVersion: '1.24.0', toolchain: 'heft', status: 'ga' }
```

Fields: `target` (user-facing), `npmVersion` (scaffold pin), `toolchain` (informational), `status` (`ga`/`preview`). Downstream updates are automatic.

## Tests & docs

Tests: core default assertion, template dep pins, CLI `new`/`config` flag values. Then `bun run typecheck && bun run test`.

Docs to update:

| File | What |
|---|---|
| `compatibility.md` | Version matrix |
| `commands.md` | `--spfx-version` flag |
| `why-not-to-migrate.md` | Supported row |
| `ARCHITECTURE.md` | Non-negotiables if formats changed |

History lives only in `CHANGELOG.md`.

## Verify

1. `rspfx new --spfx-version <v> --yes && rspfx package`
2. Bundle header starts with capture line then `define('<id>_<version>', …)`
3. Diff `.sppkg` entry list vs harvested reference
4. Real-tenant install (app catalog → site → workbench)

## Checklist

- [ ] GA (`@latest` on generator)
- [ ] Notes read for component types / schema / deprecations
- [ ] Packages packed, IDs and formats harvested, provenance recorded
- [ ] `reference/` and compiled IDs in sync
- [ ] Entry added to `versions.ts`
- [ ] Tests + `bun run test` green
- [ ] Docs updated
- [ ] Scaffold build + bundle header + sppkg diff checked
- [ ] Real-tenant gate passed

## Gotchas

| Gotcha | Detail |
|---|---|
| Never re-publish yanked version | npm `E400` after unpublish — bump instead |
| `examples/*` stay on 1.22 | Intentional matrix coverage, don't "fix" |
| Workbench retiring Dec 1 2026 | Debug Toolbar replaces it — affects dev URLs |
| Harvest from spfx-cli repo when freshest | Since 1.23 it's open source |

> Tip: after harvest, unzip an official `.sppkg` and byte-compare `define('<id>_<version>'` header and zip entry order — visual diff misses layout bugs.
