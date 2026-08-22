# Plan: Extension + Library Component Support

Goal: `rspfx new --component webpart|applicationcustomizer|fieldcustomizer|listviewcommandset|library` → `rspfx build` (rspack/vite/rsbuild) → `rspfx package` → valid `.sppkg` with `WebPart_*.xml` / `Extension_*.xml` / `Library_*.xml`, installable via app catalog. Optimize last — get compilation of all component types correct first (current approach: copied Microsoft toolchain logic).

Status: Extensions compile/discovery/local-preview done, `.sppkg` wiring landing; Library not supported (`docs/why-not-to-migrate.md:15`, `docs/roadblocks.md:49`). This plan makes both production-ready and parity-tested.

## 0. Ground Truth Harvest (blocks everything)

Why: `reference/FORMATS.md:1` is the single source of truth, never assume. Library and Extension exact XML/schema/layout must be captured from official 1.23.2 packages.

Tasks:
- 0.1 `yo @microsoft/generator-sharepoint@1.23.2` 4 fresh projects: `ext-appcustomizer`, `ext-fieldcustomizer`, `ext-commandset`, `library` (keep `src/` untouched webpart folder as control). On machine with Node 20+.
- 0.2 For each: run `gulp bundle --ship` / `gulp package-solution --ship` (or `heft` for 1.23), unzip `.sppkg` → list `zipEntries`, capture `AppManifest.xml`, `feature_<id>.xml`, `<featureId>/Extension_<id>.xml` or `Library_<id>.xml`, `ClientSideAssets/` when `includeClientSideAssets:true`, `config/package-solution.json`, `config/config.json`, `src/*/manifest.json` source + `release/manifests/<id>.manifest.json` built, `dist/<name>.js` head `define('<id>_<version>',...)`.
- 0.3 Commit to `reference/library/` + `reference/extensions/` ( alongside `reference/sp-component-ids.json` ) and update `reference/FORMATS.md` §1 (add `client-side-library-manifest.schema.json` example), §4 (add `Library_<id>.xml` row + note Library has no `<Module>`/no `Location`/`Instance`), §7 (add package-solution feature grouping for library).
- Acceptance: `reference/FORMATS.md` shows library manifest example + XML snippet with provenance line; `reference/library/*.xml` + `*.manifest.json` committed.

Files to create: `reference/library/*`, `reference/extensions/*`, `reference/FORMATS.md:8-179`.

## 1. Extension Close-Out (small, ship first)

Current: `packages/manifest-generator/src/component-manifests.ts:43-49` already scans `src/webparts` + `src/extensions`, `packages/compiler-rspack/src/config.ts:229-247` AMD name `<id>_<version>` identical, `packages/sppkg-builder/src/xml.ts:181-223` handles `Type=Extension` correctly, `packages/sharepoint-runtime/src/local-bootstrap.ts:383` + `extension-contexts.ts:103` local preview works. Gap is verification + minor polish.

Tasks:
- 1.1 `packages/dev-runtime/src/project.ts:791` `pickEntrypoint` — add `FormCustomizer` candidates (`${dirName}FormCustomizer.ts|tsx`) after `CommandSet` for completeness (SPFx 1.15+). Even if not scaffolded yet, discovery must not silently skip a FormCustomizer folder. Lines 791-816 candidate array.
- 1.2 `packages/templates/src/index.ts:7` add `formcustomizer` to `EXTENSION_TYPES`, `extensionSuffix()`/`extensionType()` map, `extensionEntry()` stub (BaseFormCustomizer). Keep CLI still vanilla-only — just unblock folder.
- 1.3 `packages/sppkg-builder/src/sppkg-builder.ts:340-361` fix auto-feature description for mixed projects: currently `first.componentType==='Extension' ? 'Extension' : 'WebPart'` — for mixed webpart+extension it mislabels. Change to detect all components: if any Extension and any WebPart → `Component` or join types. Update test `sppkg-builder/tests/extensions.test.ts:124-150`.
- 1.4 Parity: extend `packages/plugin/tests/parity.test.ts:12-205` with extension fixture (`alphaExt` ApplicationCustomizer + `betaExt` FieldCustomizer) — reuse `writeWebPart` helper but with `componentType:Extension` manifests and `*.ApplicationCustomizer.ts` entrypoints. Assert rspack/vite/rsbuild produce byte-equal `release/manifests/<id>.manifest.json`, `dist/*.js` heads `define('...`, no `.css`, `.rspfx/stats.json` counts.
- 1.5 Release: `packages/dev-runtime/src/release.ts:39-110` already writes `release/manifests/<id>.manifest.json` for extensions via `generateComponentManifests` — verify `release/assets` copy excludes maps but includes extension bundles; add assertion in `release.test.ts:37` extension case already exists, extend to check `internalModuleBaseUrls` release rewrite `HTTPS://SPCLIENTSIDEASSETLIBRARY/` for extensions.
- Acceptance: `pnpm test` parity passes for extensions; `rspfx new --component applicationcustomizer --yes && rspfx package` unzip shows `Extension_<id>.xml` with `Location=ClientSideExtension.ApplicationCustomizer` + `Instance` UUID + no `<Module>` (like `xml.ts:194-204`), mixed project shows both `WebPart_<id>.xml` + `Extension_<id>.xml` with correct rels.

## 2. Library Support (core work)

Library semantics from `https://developer.microsoft.com/json-schemas/spfx/client-side-library-manifest.schema.json`: `componentType: Library`, `version:"*"`, `manifestVersion:2`, no `preconfiguredEntries`, no `extensionType`, `alias` is library name, loaderConfig same `entryModuleId/scriptResources` but Elements XML `Type="Library"` with no `<Module>`/no `Location`/`Instance`. Bundle is AMD same wrapper, loadable via `import('my-lib')` from webparts.

Tasks by file:
- 2.1 `packages/core/src/config.ts:25-92` add `librariesDir?: string` to `PathsConfig` + `configDefaults.paths.librariesDir = 'src/libraries'` + export `resolvePathDefaults` update. Single source of truth `SPFX_VERSIONS` unchanged.
- 2.2 `packages/dev-runtime/src/project.ts`:
  - `196-231` `discoverComponentId` include `paths.librariesDir` in dirs array.
  - `247-525` `ensureProjectConfigs` — no teams for libraries, but ensure `config/config.json` seed handles libraries if any.
  - `695-756` `discoverWebParts` add param `librariesDir='src/libraries'`, scan third dir `scanComponentDir(projectRoot, librariesDir)` after extensions (718-719). Rename internal `bundleMap: WebPartBundle[]` generic but keep alias `discoverComponents = discoverWebParts:787`. Throw message update to mention `src/libraries/<name>/<name>.manifest.json`.
  - `758-784` `scanComponentDir` unchanged.
  - `791-816` `pickEntrypoint` add `${dirName}.ts|tsx`, `${dirName}Library.ts|tsx` candidates (library entry is often `MyLibrary.ts` not `Library` suffix). Keep single-file fallback.
- 2.3 `packages/manifest-generator/src/types.ts:21-32` add `librariesDir?: string` to `ManifestContext`.
- 2.4 `packages/manifest-generator/src/component-manifests.ts:43-49` third `scanComponentsDir(ctx, manifests, spDependencies, ctx.librariesDir ?? 'src/libraries')`. Keep same `loaderConfig` logic (89-150) — library `scriptResources` same, `SP_COMPONENT_IDS` fallback covers `sp-loader` etc. Ensure `extensionType` not required.
- 2.5 `packages/compiler-rspack/src/config.ts:226-248` — no change needed; verify `computeUniqueName` + `entry.library.name='<id>_<version>'` works for Library (already verified in `packages/plugin/tests/rsbuild.test.ts:55` non-SP Library external). Add comment `Library uses same AMD wrapper`.
- 2.6 `packages/sppkg-builder/src/xml.ts:181-223` add Library branch documentation: after `if(componentType==='Extension')` add `else if(componentType==='Library') { /* Type=Library, no Module/Location/Instance, only ComponentManifest */ }`. Current `if(WebPart||AdaptiveCardExtension) push Module` already leaves Library without Module — just make it explicit and add test.
- 2.7 `packages/sppkg-builder/src/sppkg-builder.ts:340-361` update kind detection to handle Library: `const kind = components.every(c=>c.componentType==='Library') ? 'Library' : components.some(c=>c.componentType==='Extension') && components.some(c=>c.componentType==='WebPart') ? 'Component' : (first.componentType ?? 'WebPart')==='Extension' ? 'Extension' : first.componentType==='Library' ? 'Library' : 'WebPart'`.
- 2.8 `packages/templates/src/index.ts:6-684` add library scaffolding:
  - `LIBRARY` const, `libraryManifest(vars)` (`componentType:Library`, `alias:${Pascal}Library`, `$schema: client-side-library-manifest`, no `preconfiguredEntries`), `libraryEntry(vars)` (`export default class ${Pascal}Library { }` placeholder).
  - `buildFiles` branch `if(isLibrary)` similar to `isExtension:100-105` → `src/libraries/<name>/<name>.manifest.json` + `src/libraries/<name>/<Pascal>Library.ts`.
  - Keep `vanilla TS` only, no teams/fluent/framework.
- 2.9 `apps/cli/src/commands/new.ts:52-138` extend `COMPONENT_CHOICES` with `library`, allow `--component library` (currently `apps/cli/tests/new.test.ts:157` expects throw — flip to success), enforce vanilla TS for library like extensions (85-87), set `componentType` mapping.
- 2.10 `packages/dev-runtime/src/local-page.ts` + `packages/sharepoint-runtime/src/local-bootstrap.ts:321` — libraries not mountable; render separate `<section id="rspfx-libraries">` listing library ids with `window.__RSPFX_COMPONENTS__.filter(c=>c.componentType==='Library')`, show `dist/<lib>.js` loadable hint. Do not call `mountExtension`.
- 2.11 `scripts/migrate-to-rspfx.mjs:183,322` handle `src/libraries/*` bundle rename `lib/→src/` and remove `Library not supported` warn.
- Acceptance: `rspfx new --component library --yes && rspfx build` → `dist/<lib>.js` AMD + `release/manifests/<id>.manifest.json` `componentType:Library`; `rspfx package` → zip contains `Library_<id>.xml` with `Type="Library"` no `<Module>`, `buildElementsXml` single-quoted manifest, mixed webpart+library zip has both files.

## 3. Cross-Bundler Parity + Docs + Validation (finish line)

- 3.1 `packages/plugin/src/vite.ts:236-311` + `rsbuild.ts:278-383` — ensure `collectExternals` includes library names (localizedNames already, spDeps via `findSpDependencies`). No swc for Rsbuild (owns SWC) — library same.
- 3.2 Parity test matrix: `packages/plugin/tests/parity.test.ts` add `library` case alongside extension case — build same fixture through rspack/vite/rsbuild assert identical `release/manifests/*.manifest.json` bytes, asset sets, no `.css`, `.rspfx/stats.json` moduleCounts >0.
- 3.3 Unit tests: add fixtures `tests/fixtures/library/src/libraries/hello/hello.manifest.json` (`id: dddd`, `componentType:Library`) + `helloLibrary.ts`; update `manifest-generator/tests/component-manifests.test.ts:190` library assertion, `sppkg-builder/tests/sppkg-builder.test.ts:86` Library XML assertion, `templates/tests/scaffold.test.ts` library matrix, `dev-runtime/tests` library discovery.
- 3.4 Docs (per `docs/AGENTS.md` fact homes):
  - `docs/project-structure.md:34-88` add `src/libraries/<name>/` tree + table rows for library manifest/entry with schema link.
  - `docs/building-packages.md:87` add Library bullet (no Module/Instance).
  - `docs/compatibility.md:14` add `componentType: Library` guarantee row.
  - `docs/why-not-to-migrate.md:15` + `docs/roadblocks.md:49` flip Library from `❌` to `✅` (or `⚠️ Dev preview` until tenant gate passes).
  - `reference/FORMATS.md` updated in 0.3.
  - Word budgets: `docs/AGENTS.md:500`, `docs/wasm.md:1800` — keep edits one line per paragraph, blank line between paragraphs, no history narration.
- 3.5 Validation: `pnpm test` + `pnpm build` + `wc -w` + link verify per `docs/AGENTS.md` verification section. Then real-tenant gate `docs/real-tenant-validation.md:22` for mixed webpart+extension+library `.sppkg` (upload via `RSPFX_ACCESS_TOKEN` + `RSPFX_APP_CATALOG_URL:12`).

## 4. Execution Order (one task after another)

Take in this order, each is a PR with its tests:

1. Harvest 0.x → commit reference fixtures (unblocks all).
2. Extension polish 1.1-1.3 (tiny, no core path change).
3. Library core 2.1-2.5 (discovery+manifest+compiler).
4. Library packaging 2.6-2.7 + 3.3 sppkg tests.
5. Library scaffolding 2.8-2.9 + CLI prompts.
6. Parity tests 1.4 + 3.2 (rspack/vite/rsbuild).
7. Dev preview library listing 2.10.
8. Docs + roadblocks flip 3.4 (needs Agent Note per `docs/AGENTS.md` non-trivial change → `.agents/notes/implemented/<class>/YYYY-MM-DD-slug.md` with header `# Agent Note: <title>` line1 blank line2 `Status: implemented` line3).
9. Real-tenant validation + optimization pass (dedupe copied toolchain code, keep `paths: {}` empty `tsconfig.build.json`, `.js` imports).

Each step verify: `pnpm test` is the only gate (`docs/AGENTS.md`), `pnpm build` typecheck covers package surfaces.

## 5. Files to Touch Summary

`packages/core/src/config.ts` | `packages/dev-runtime/src/project.ts` + `release.ts` + `local-page.ts` | `packages/manifest-generator/src/types.ts` + `component-manifests.ts` + `data/component-ids.ts` | `packages/compiler-rspack/src/config.ts` (comment only) | `packages/sppkg-builder/src/xml.ts` + `sppkg-builder.ts` | `packages/plugin/src/rspack.ts` + `vite.ts` + `rsbuild.ts` + `tests/parity.test.ts` | `packages/sharepoint-runtime/src/local-bootstrap.ts` | `packages/templates/src/index.ts` + `tests/scaffold.test.ts` | `apps/cli/src/commands/new.ts` + `tests/new.test.ts` | `scripts/migrate-to-rspfx.mjs` | `reference/FORMATS.md` + `reference/sp-component-ids.json` | `docs/*` + `AGENTS.md:47` env vars unchanged.

After this, every SPFx component type webpart/extension/library compiles from most factories (vite/rspack/rsbuild) and packages identically — optimization can follow without format risk.
