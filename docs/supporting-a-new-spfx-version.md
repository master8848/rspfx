# Supporting a new SPFx version

RSPFX's output formats were reverse-engineered from Microsoft's official npm packages — `@microsoft/spfx-heft-plugins`, `@microsoft/sp-build-web`, `@microsoft/sp-webpart-base` and the sp-* runtime packages — captured as ground truth, then rewritten from scratch (Rspack compiler instead of webpack, own manifest generator, own sppkg builder, own dev server).

The rule is: never assume a format, never trust memory or a docs page — harvest it from the official artifacts and verify byte-level.

This page is the complete, repeatable process for adding a new SPFx target.
It is written for two audiences: RSPFX maintainers (who follow sections 1–12
as a checklist) and other companies/teams building their own SPFx-compatible
toolchains (the methodology in sections 2–5 and 13 is portable as-is).

## 1. How RSPFX tracks SPFx versions

The version matrix lives in ONE file: `packages/core/src/versions.ts`. It
exports `SPFX_VERSIONS` — an array of entries `{ target, npmVersion,
toolchain: 'gulp'|'heft', status: 'ga'|'preview', notes? }` — plus
`SPFX_DEFAULT_TARGET`, `SPFX_TARGETS`, `isSpfxTarget()`, and
`spfxNpmVersion()`. Every consumer derives from this matrix automatically:

- config default (`spfxVersion` in the `RspfxPlugin` / `rspfxVite` options)
- CLI prompt choices, `--spfx-version` validation, and help text
- `rspfx doctor` dependency-check prefix
- template sp-* dependency pins at scaffold time

Adding a target is a one-entry change in `packages/core/src/versions.ts:13`.

There are no scattered literals to miss; a forgotten target union would silently accept the new version without testing it, and tests pin the default so a wrong default can't slip in.

Current matrix: see [docs/compatibility.md#spfx-version-matrix](compatibility.md#spfx-version-matrix) and `packages/core/src/versions.ts:13` (default `1.23`, patch 1.23.2).

SPFx 1.24 is in public preview (beta.1, July 8 2026) with GA expected September 2026 — it is the next candidate target.

## 2. Detect a new release

| Signal | Where |
|---|---|
| npm dist-tags | `npm dist-tag ls @microsoft/generator-sharepoint` — `@latest` = GA, `@next` = preview |
| Release notes | `https://learn.microsoft.com/sharepoint/dev/spfx/release-<v>` (e.g. `release-1.24`) |
| Roadmap announcements | The SharePoint blog / SPFx community calls around GA dates |
| Open-source repo | `github.com/SharePoint/spfx` (since 1.23) — spfx-cli + templates, another official source to inspect |

**Wait for GA before adding a target.** A preview entry is possible in the
matrix (`status: 'preview'`), but it is risky: the scaffold pins sp-* deps to
the `npmVersion` at install time, and a preview sp-* version may not exist on
npm yet or may drift between previews. GA is the safe point.

## 3. Read the release notes for format-relevant signals

Most release-note content is irrelevant to RSPFX (features, bug fixes). What
matters:

- **New component types** — e.g. SharePoint Copilot Apps in 1.24. Each new
  component type means a new manifest shape and possibly new packaging
  elements. RSPFX only supports web parts today (see
  [why-not-to-migrate.md](why-not-to-migrate.md)); a new type still changes
  the manifest schema machinery to account for.
- **Manifest schema additions/changes** — check the official JSON schemas
  (`developer.microsoft.com/json-schemas/spfx/...`) for new fields.
- **Deprecations** — e.g. SPFx 1.23 deprecated the hosted workbench
  (retires December 1 2026; the SPFx Debug Toolbar replaces it). This changes
  the workbench URL you open in `rspfx dev`, not the bundle formats.
- **React / Fluent version changes** — affects template pins, not formats.
- **Toolchain transitions** — since 1.23 new official projects use the Heft
  toolchain (gulp is legacy, critical fixes only; from 1.24 officially
  unsupported). **This has no format impact for RSPFX** — RSPFX *is* the
  toolchain replacement — but it changes what official scaffolding deps look
  like, which matters when harvesting (section 4).

## 4. Harvest the official artifacts (the core methodology)

1. Create a scratch directory (gitignored) and `npm pack` (or install into a
   temp project):
   - the generator/build plugins: `@microsoft/spfx-heft-plugins@<v>`,
     `@microsoft/sp-build-web@<v>`, `@microsoft/sp-webpart-base@<v>`
   - all runtime packages: `@microsoft/sp-*@<v>` (core-library,
     webpart-base, loader, page-context, lodash-subset, ...)
2. Extract ground truth:
   - **Component IDs, `version` fields, `preloadComponents`** from
     `node_modules/@microsoft/sp-*/dist/*.manifest.json`
   - **Formats** (manifest builder, AMD bundle wrapper, manifests.js template,
     .sppkg zip layout, workbench URL construction) from the build-plugin
     packages
3. Record provenance — the exact package versions harvested — in
   `reference/FORMATS.md` (per section, like the existing
   `@microsoft/spfx-heft-plugins@1.23.2` header).
4. On any discrepancy with what RSPFX emits, verify against an **unzipped
   official `.sppkg`** before changing anything.

Never trust memory or docs pages alone. RSPFX exists because the official
format was captured from the packages, not from documentation.

## 5. Diff old vs new

Compare the harvested target against the current reference:

- component IDs (are they stable? — they have been across 1.20–1.23)
- manifest schema (new/renamed/removed fields)
- bundle wrapper: `define('<componentId>_<version>', ["@microsoft/sp-core-library", ...], ...)` and `chunkLoadingGlobal`
- manifests.js template
- .sppkg zip layout
- `config/package-solution.json` semantics

Then update the reference files:

- `reference/FORMATS.md` — add a section (or amend) with the new provenance
- `reference/sp-component-ids.json` — extend the fallback table
- `packages/manifest-generator/src/data/component-ids.ts` — this is a
  **compiled copy** of the ID table; keep it in sync with `reference/` (see
  AGENTS.md)

## 6. Add the version in code

One entry in `packages/core/src/versions.ts`:

```ts
{ target: '1.24', npmVersion: '1.24.0', toolchain: 'heft', status: 'ga', notes: '...' }
```

- `target` — the user-facing value for `--spfx-version` / config
- `npmVersion` — the sp-* version pinned at scaffold time
- `toolchain` — what official scaffolding for this version looks like
  (`'heft'` for 1.23+); informational only, RSPFX never runs gulp/Heft
- `status` — `'ga'` or `'preview'`; only GA should be a default candidate

Everything downstream — config default, CLI prompt/validation/help text,
doctor check, template dep pins — derives automatically. That is the whole
point: adding a version is a ~30-minute change, not a multi-file hunt.

## 7. Update tests

- core config default assertions (the default-target test pins the current
  default)
- templates scaffold sp-* dep-pin assertions for the new target
- CLI `new`/`config` tests exercising the new flag value

Then from the repo root:

```sh
bun run typecheck
bun run test
```

`bun run test` is the only gate (no lint, no CI).

## 8. Update docs

- `docs/compatibility.md` — the version matrix table
- `docs/commands.md` — the `--spfx-version` flag table
- `docs/why-not-to-migrate.md` — the supported-version row
- `docs/roadmap.md` — milestone status if the gate status changed
- `ARCHITECTURE.md` — non-negotiables section if formats changed
- `skills/rspfx/SKILL.md` — the same list that lives in `compatibility.md` as
  the pointer

## 9. Verify

1. `rspfx new <app> --spfx-version <v> --yes`, then `rspfx build` and
   `rspfx package` in the scaffolded project.
2. Byte-check the production bundle header:
   `define('<componentId>_<version>', ["@microsoft/sp-core-library", ...])`
   preceded by the currentScript capture line
   (`(function(){window["__rspfx_script_url_<name>"]=...`) — see
   `compiler-rspack/src/public-path.ts`.
3. Diff the `.sppkg` zip against the harvested reference (entry list,
   byte-equal entries).
4. **Final gate: real-tenant install** via app catalog → site collection →
   workbench (the M1 gate). Real-tenant CI across all targets is planned for
   M7; until then this is a manual step per release.

## 10. What tends to stay stable vs change

| | Stays stable | Tends to change |
|---|---|---|
| Component IDs | Stable across versions (1.20–1.23) — and harvested from `node_modules` at build time anyway, so **never hardcode them** | — |
| Bundle wrapper | `define('<id>_<version>', [...])` + `chunkLoadingGlobal` | — |
| manifests.js template | Same shape | — |
| .sppkg zip layout | Same structure | New feature types, new asset categories |
| sp-* dependency versions | — | Bump every version (harvested, never hardcoded) |
| Manifest schema | — | Additive changes; new component types (e.g. Copilot Apps) |

## 11. Gotchas

- **npm cannot re-publish an unpublished version** (E400 — e.g. the `0.0.1`
  incident). Never yank a published version and re-publish it; bump instead.
- **`examples/*` intentionally stay on an older target (1.22)** to exercise
  the matrix — version drift vs. package deps (1.23.2) is intentional, don't
  "fix" it while adding a target.
- **1.24 is the next candidate when it GAs** (expected September 2026):
  `status: 'ga'`, `npmVersion: '1.24.0'`. A `'preview'` entry is possible but
  risky for scaffold pins (section 2).
- **The hosted workbench is retiring** (December 1 2026); SPFx Debug Toolbar
  replaces it — affects dev-mode URLs, not formats.
- Since 1.23, official scaffolding is Heft-only; `github.com/SharePoint/spfx`
  (spfx-cli + templates) is open source — harvest from it too when it's the
  freshest source.

## 12. Timeline validating the process

- **1.20–1.22** — supported from the start of RSPFX.
- **1.23** — formats harvested from `@microsoft/sp-*@1.23.2` packages
  (including the spfx-heft-plugins / sp-build-web pair) *before* the target
  was added; the harvest drove the format implementation, not the other way
  around. This is the intended order (section 4).
- **1.24** — with the matrix centralized in `packages/core/src/versions.ts`,
  adding it is a one-entry + tests + docs change.

## 13. Porting this methodology to another toolchain

The process is: **capture into reference → implement → byte-verify →
tenant-gate.**

- `npm pack` the official packages at the exact target version; never guess a
  format from docs or memory.
- Unzip a real `.sppkg` produced by official tooling — the zip layout is
  ground truth.
- Compare byte-level (bundle header prefix, zip entries), not visually.
- Keep a `reference/` directory with provenance (exact package versions,
  dates) so every format decision is auditable.
- Make the final gate a real install in the real product (app catalog →
  site → workbench), not just a diff.

## Checklist

- [ ] Release is GA (npm dist-tag `@latest` on `@microsoft/generator-sharepoint`)
- [ ] Release notes read for new component types / schema changes / deprecations / toolchain shift
- [ ] Official packages at the target version packed into a scratch dir
- [ ] Component IDs, versions, preloadComponents harvested from `node_modules/@microsoft/sp-*/dist/*.manifest.json`
- [ ] Formats harvested from build-plugin packages; provenance recorded in `reference/FORMATS.md`
- [ ] Diff vs. old target; discrepancies verified against an unzipped official `.sppkg`
- [ ] `reference/sp-component-ids.json` and `packages/manifest-generator/src/data/component-ids.ts` in sync
- [ ] One entry added to `packages/core/src/versions.ts` (target / npmVersion / toolchain / status)
- [ ] Tests updated (core default, template dep pins, CLI)
- [ ] `bun run typecheck` && `bun run test` green from repo root
- [ ] Docs updated: compatibility.md, commands.md, why-not-to-migrate.md, roadmap.md, ARCHITECTURE.md, skills/rspfx/SKILL.md
- [ ] Scaffolded project at the new target: bundle header + currentScript line byte-checked, .sppkg diffed
- [ ] Real-tenant install through the M1 gate (app catalog → site → workbench)
