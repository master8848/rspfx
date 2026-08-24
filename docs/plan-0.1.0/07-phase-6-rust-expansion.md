# Phase 6 — Rust Expansion (15d, can overlap Phase 5) — Expanded

> **Scope guard:** NO CI CHANGES. No `.github/workflows`, `scripts/check-rust.mjs`, `Cargo.toml` CI hooks, or `type-coverage`/`depcruise` gates. Rust is verified locally via `cargo fmt --check` / `cargo clippy` / `cargo test`.

## Phase 6 — Rust Expansion

### 6.1 Detailed Goal & Rationale

**Goal:** Move hot-path, correctness-sensitive, and allocation-heavy code to native Rust crates behind a Node-API (`napi-rs`) boundary, with a pure-TS fallback so every install works without a compiled artifact. Keep the public TS API shape identical; only the *internals* of `sppkg-builder`, `manifest-generator`, and two `compiler-rspack` plugins become Rust.

**Rationale:**

| Current pain | Rust fix | Evidence in repo |
|---|---|---|
| `fflate` JS ZIP (`/Volumes/New Volume/code/spfx/packages/sppkg-builder/src/zip.ts:22`) builds entirely in JS-heap, single-threaded, CRC via JS; `zipSync(record,{level:9})` dominates `bench/bench.mjs:59` `build 315ms` | `zip` crate + `flate2/zlib-ng` uses SIMD CRC, `zlib-ng` compression, parallel `rayon` when packaging assets; <200ms on `examples/shadcn` (4 entries) target | `zip.ts:14-23` `writeZip`, `readZipEntries`, `validateSppkg` |
| `quick-xml` style string-concat in `/Volumes/New Volume/code/spfx/packages/sppkg-builder/src/xml.ts:48` `serializeXml` + ad-hoc `escapeXml*` + RESX regex `/Volumes/New Volume/code/spfx/packages/sppkg-builder/src/resx.ts:1` `<data name...>` is locale-sensitive and quadratic on long strings | `quick-xml` with `escape` + `memchr` scanning is zero-copy, validates well-formedness, catches mismatched `CultureName` at build time | `xml.ts:30-78`, `resx.ts:11`, `lcid.ts:60-107` |
| Manifest traversal is sync `fs.readdirSync` + `fs.readFileSync` serial walk (`/Volumes/New Volume/code/spfx/packages/manifest-generator/src/component-manifests.ts:55` `scanComponentsDir`, `sp-dependencies.ts:36` `findSpDependencies`) — stalls event loop on 20+ webparts | `tokio::fs` + `walkdir` + `rayon` parallelizes at IO level; `serde_json` + `schemars` validates schema once; `askama` template for `generateManifestsJs` avoids JS string interpolation bugs | `component-manifests.ts:68-157`, `sp-dependencies.ts:36-68`, `manifests-js.ts` |
| `SpfxPublicPathPlugin` (`/Volumes/New Volume/code/spfx/packages/compiler-rspack/src/public-path.ts:79`) and `SpfxLocalizedResourcesPlugin` (`/Volumes/New Volume/code/spfx/packages/compiler-rspack/src/localized-resources.ts:12`) touch every asset via `compilation.update_asset` with JS string `src.includes(SPFX_PUBLIC_PATH_SENTINEL)` — per-asset JS clone | Rust `rspack_core::Plugin` with `Arc<dyn Source>` is zero-copy, runs inside Rspack's Rust compilation graph; removes Node→Rust string boundary per chunk | `public-path.ts:86-116`, `localized-resources.ts:19-44` |
| Future `crates/rspfx-dev` (`axum`+`notify`+`tokio-tungstenite`+`rcgen`) will replace ad-hoc `ws` + `https` cert handling but is explicitly *optional* — not required for 0.1.0 | Keeps `dev-runtime` TS for now; Rust dev crate lands as experimental behind feature flag | `packages/compiler-rspack/src/dev-server.ts:67`, `packages/dev-runtime/src/serve.ts:246`, `packages/manifest-server/src/index.ts` `ensureCertificates` |

**Non-goal:** No new bundler, no wasm, no `pnpm-workspace.yaml` mutation except `Cargo.toml` addition. Keep `pnpm-workspace.yaml:1-14` intact (still `packages/*`, `apps/*`, `examples/*`); `Cargo.toml` lives at repo root *alongside* it — `pnpm` ignores `crates/`.

**Relationship to Phase 5:** Kernel extraction (`packages/plugin/src/kernel.ts`) must finish first so Rust plugins have a single injection point (`createKernel` → `compilerOptions`). Phase 6 can start in parallel once `KernelOpts` type is frozen, but merges after Phase 5.

### 6.2 Breaking Changes

**Contract:** No breaking public API. All changes are internal with optional native acceleration. The only observable change is performance and stricter validation (which is *intended* break: malformed RESX/XML now throws `RspfxError('INVALID_RESX')` instead of silently returning `{}`).

Before / After — TS facade stays, Rust behind `tryRequire`:

```ts
// BEFORE — /Volumes/New Volume/code/spfx/packages/sppkg-builder/src/zip.ts:14
import { zipSync } from 'fflate';
export async function writeZip(outputPath: string, entries: ZipFileEntry[]): Promise<void> {
  const record: Record<string, Uint8Array> = {};
  for (const e of entries) { record[e.name] = e.buffer; }
  await writeFile(outputPath, zipSync(record, { level: 9 }));
}

// AFTER — /Volumes/New Volume/code/spfx/packages/sppkg-builder/src/zip.ts:14
import { writeFile } from 'node:fs/promises';
export interface ZipFileEntry { name: string; buffer: Uint8Array; }
let native: { buildPackage(entries: ZipFileEntry[], opts: {level:number}): Buffer } | undefined;
try { native = require('../../crates/rspfx-sppkg/index.node'); } catch {}
export async function writeZip(outputPath: string, entries: ZipFileEntry[]): Promise<void> {
  if (native) {
    const buf = native.buildPackage(entries, { level: 9 });
    await writeFile(outputPath, buf);
    return;
  }
  const { zipSync } = await import('fflate'); // fallback, lazy
  const record: Record<string, Uint8Array> = {};
  for (const e of entries) { if (e.name in record) throw new Error(`Duplicate ...`); record[e.name] = e.buffer; }
  await writeFile(outputPath, zipSync(record, { level: 9 }));
}
```

```ts
// BEFORE — /Volumes/New Volume/code/spfx/packages/manifest-generator/src/component-manifests.ts:55
export async function generateComponentManifests(ctx: ManifestContext): Promise<ComponentManifest[]> {
  const spDependencies = findSpDependencies(ctx.projectRoot); // sync readdirSync
  // ...
  scanComponentsDir(ctx, manifests, spDependencies, webpartsDir); // sync
}

// AFTER — same signature, internals delegate
export async function generateComponentManifests(ctx: ManifestContext): Promise<ComponentManifest[]> {
  let native: { scanComponentsDir(opts: ScanOpts): Promise<ComponentManifest[]> } | undefined;
  try { native = require('../../crates/rspfx-manifest/index.node'); } catch {}
  if (native) return native.scanComponentsDir({ projectRoot: ctx.projectRoot, webpartsDir, /*...*/ });
  // fallback — existing sync path wrapped in Promise.resolve
  return legacyGenerateComponentManifests(ctx);
}
```

```ts
// BEFORE — /Volumes/New Volume/code/spfx/packages/compiler-rspack/src/public-path.ts:79
export class SpfxPublicPathPlugin { apply(compiler: Compiler){ /* JS string replace */ } }

// AFTER — registration chooses Rust when available
import { SpfxPublicPathPlugin as JsPlugin } from './public-path.js';
let RustPlugin: typeof JsPlugin | undefined;
try { RustPlugin = require('../../crates/rspfx-rspack-plugin/index.node').SpfxPublicPathPlugin; } catch {}
export const SpfxPublicPathPlugin = RustPlugin ?? JsPlugin;
```

**Stricter validation (intended):**

```ts
// BEFORE — /Volumes/New Volume/code/spfx/packages/sppkg-builder/src/resx.ts:11
export function parseResx(content: string): Record<string,string> {
  // regex /<data name="([^"]+)">.*?<value>([\s\S]*?)<\/value>/g  — misses xml:space, comments, attribute order
  while(match=regex.exec(content)) values[match[1]] = decodeXmlEntities(match[2]);
  return values; // silently drops malformed entries
}

// AFTER — Rust quick-xml
// parseResx(content:string) -> Result<Record<string,string>, RspfxError>
//  throws RspfxError { code:'INVALID_RESX', message:'... at line 42: missing </data>' }
```

Consumers that relied on silent dropping must handle the throw — this is the only breaking observable. Migration: wrap `parseResx` in try/catch, or validate RESX via `rspfx doctor` pre-flight.

### 6.3 File-by-File Breakdown — Absolute Paths + Line Numbers

| File | Action | Lines / Notes |
|---|---|---|
| `/Volumes/New Volume/code/spfx/Cargo.toml` | **NEW** workspace root | `1-35` `[workspace] members=["crates/rspfx-sppkg","crates/rspfx-manifest","crates/rspfx-rspack-plugin"]` + `[workspace.dependencies]` pins: `zip = { version="2.2", features=["deflate-zlib-ng"]}`, `flate2`, `quick-xml="0.36"`, `walkdir="2.5"`, `rayon="1.10"`, `memchr="2.7"`, `tokio={version="1.40",features=["fs","rt-multi-thread"]}`, `serde="1.0"`, `serde_json="1.0"`, `schemars="0.8"`, `napi="2.16"`, `napi-derive="2.16"`, `rspack_core="1.2"` (optional). No `pnpm-workspace.yaml` edit. |
| `/Volumes/New Volume/code/spfx/crates/rspfx-sppkg/Cargo.toml` | **NEW** crate | `1-28` `name="rspfx-sppkg"` `crate-type=["cdylib"]` `napi` build. Deps: `zip`, `flate2`, `quick-xml`, `walkdir`, `rayon`, `memchr`, `napi`, `serde_json`. |
| `/Volumes/New Volume/code/spfx/crates/rspfx-sppkg/src/lib.rs` | **NEW** `napi` entry | `1-180` `#[napi] pub fn build_package(entries: Vec<ZipEntry>, opts: PackageOptions) -> napi::Result<Buffer>` — validates duplicate names, builds `zip::ZipWriter`, writes `[Content_Types].xml` via `build_content_types_xml`, `AppManifest.xml`, `feature_*.xml`, `*.xml` manifests, sorts entries deterministically, uses `flate2::Compression::best()`, returns `Buffer`. Replaces `packages/sppkg-builder/src/zip.ts:14` `writeZip` + `readZipEntries` + `validateSppkg`. |
| `/Volumes/New Volume/code/spfx/crates/rspfx-sppkg/src/xml.rs` | **NEW** | `1-120` `pub fn serialize_xml(node: &XmlNode, pretty: bool) -> String` mirroring `packages/sppkg-builder/src/xml.ts:48` `serializeXml`; uses `quick_xml::Writer`, `escape` for `escapeXmlText`/`escapeXmlAttribute` (`xml.ts:30-46`). Exports `build_rels_xml`, `build_content_types_xml`, `build_feature_xml`, `build_elements_xml`, `build_app_manifest_xml` matching `xml.ts:80-322`. |
| `/Volumes/New Volume/code/spfx/crates/rspfx-sppkg/src/resx.rs` | **NEW** | `1-80` `pub fn parse_resx(content: &str) -> Result<HashMap<String,String>, ResxError>` — `quick_xml::Reader` event loop, handles `xml:space="preserve"`, attribute order independence, decodes `&amp; &lt; &gt; &apos; &quot;` via match (mirrors `resx.ts:3-9` `XML_ENTITIES`). Replaces regex `RESX_DATA_ENTRY` `resx.ts:1`. |
| `/Volumes/New Volume/code/spfx/crates/rspfx-sppkg/src/lcid.rs` | **NEW** | `1-90` `pub fn locale_to_lcid(locale:&str)->u32`, `lcid_to_culture_name(lcid:u32)->String`, `locale_to_culture_name(locale:&str)->String` — port of `packages/sppkg-builder/src/lcid.ts:60-107` `LOCALE_TO_LCID` map (57 entries) + `LCID_TO_CULTURE` reverse + `formatCulture`. Validates unknown → `1033`. |
| `/Volumes/New Volume/code/spfx/crates/rspfx-sppkg/src/glob.rs` | **NEW** | `1-70` `pub fn glob_to_regexp(pattern:&str)->Regex` port of `packages/sppkg-builder/src/glob.ts:4-30` + `pub fn glob_files(dir:PathBuf, patterns:Vec<String>)->Vec<String>` parallel `walkdir` + `rayon` filter, replacing `glob.ts:32-58` `globFiles`/`walk` recursion. Deterministic sort `localeCompare` equivalent via `a.cmp(&b)`. |
| `/Volumes/New Volume/code/spfx/crates/rspfx-sppkg/src/zip.rs` | **NEW** internal | `1-100` `pub fn validate_sppkg(path: &Path) -> ValidationResult` — opens `zip::ZipArchive`, checks `[Content_Types].xml`, `_rels/.rels`, `AppManifest.xml`, `feature_<guid>.xml` regex, `<featureId>/<ComponentType>_<componentId>.xml` via `regex` crate. Mirrors `zip.ts:34-62` `validateSppkg`. |
| `/Volumes/New Volume/code/spfx/packages/sppkg-builder/src/zip.ts` | **MODIFY** | `1-62` → `1-48` new lines: add `tryRequire` native at `8-12`, keep fallback `fflate` path at `22-35`. `writeZip` `14-23` becomes delegating wrapper. `readZipEntries` `25-32` and `validateSppkg` `34-62` get same native-or-fallback pattern. Export type `SppkgValidationResult` unchanged `9-12`. |
| `/Volumes/New Volume/code/spfx/packages/sppkg-builder/src/xml.ts` | **MODIFY** | `1-363` — add `1-8` header: `let native; try{native=require(...)}catch{}`; each builder (`buildRelsXml:80`, `buildContentTypesXml:128`, `buildFeatureXml:156`, `buildElementsXml:181`, `buildAppManifestXml:244`) tries native first, fallback to JS. Keep `escapeXml*` `30-46`, `serializeXml` `48-78` as fallback. |
| `/Volumes/New Volume/code/spfx/packages/sppkg-builder/src/resx.ts` | **MODIFY** | `1-23` → `1-18` wrapper: native `parseResx` at `3-8`, fallback regex at `11-19`. |
| `/Volumes/New Volume/code/spfx/packages/sppkg-builder/src/lcid.ts` | **MODIFY** | `1-107` — wrap `localeToLcid:60`, `lcidToCultureName:83`, `localeToCultureName:91` with native delegation at top `1-8`. Keep JS maps `LOCALE_TO_LCID:1-58` as fallback data. |
| `/Volumes/New Volume/code/spfx/packages/sppkg-builder/src/glob.ts` | **MODIFY** | `1-58` — `globToRegExp:4` and `globFiles:32` get native delegation. Keep `walk:39` fallback. |
| `/Volumes/New Volume/code/spfx/crates/rspfx-manifest/Cargo.toml` | **NEW** | `1-30` `name="rspfx-manifest"` `crate-type=["cdylib"]` `napi`. Deps: `tokio`, `serde_json`, `schemars`, `walkdir`, `rayon`, `askama`. |
| `/Volumes/New Volume/code/spfx/crates/rspfx-manifest/src/lib.rs` | **NEW** | `1-200` `#[napi] pub async fn scan_components_dir(opts: ScanOpts) -> napi::Result<Vec<ComponentManifest>>` — async `tokio::fs::read_dir`, parallel `rayon` for JSON parse, `find_sp_dependencies` reading `node_modules/@microsoft/*/dist/*.manifest.json` via `walkdir` (port of `packages/manifest-generator/src/sp-dependencies.ts:36` `findSpDependencies`). Returns `Vec<ComponentManifest>` matching `types.ts:1-14`. |
| `/Volumes/New Volume/code/spfx/crates/rspfx-manifest/src/sp_dependencies.rs` | **NEW** | `1-90` port of `sp-dependencies.ts:1-69` — `find_dist_manifest` (port `19-34`), `find_sp_dependencies` (port `36-68`), plus fallback to `SP_COMPONENT_IDS` JSON embedded via `include_str!("../data/component-ids.json")` mirroring `packages/manifest-generator/src/data/component-ids.ts`. |
| `/Volumes/New Volume/code/spfx/crates/rspfx-manifest/src/manifests_js.rs` | **NEW** | `1-80` `#[napi] pub fn generate_manifests_js(manifests: Vec<ComponentManifest>) -> String` — `askama` template `templates/manifests.js.j2` replacing `packages/manifest-generator/src/manifests-js.ts` string concat; ensures `window.__MANIFESTS__` shape matches Phase 0 capture. |
| `/Volumes/New Volume/code/spfx/packages/manifest-generator/src/component-manifests.ts` | **MODIFY** | `1-157` → `1-40` wrapper: `55-157` `scanComponentsDir` becomes `try native.scanComponentsDir` then fallback to existing `scanComponentsDir` logic at `60-157`. Keep `generateComponentManifests:43-53` signature identical; make it `async` delegating. |
| `/Volumes/New Volume/code/spfx/packages/manifest-generator/src/sp-dependencies.ts` | **MODIFY** | `1-69` — add native delegation header `1-8`; keep `findSpDependencies:36` fallback. |
| `/Volumes/New Volume/code/spfx/packages/manifest-generator/src/manifests-js.ts` | **MODIFY** | `~1-40` — delegate `generateManifestsJs` to Rust `askama` when native present. |
| `/Volumes/New Volume/code/spfx/crates/rspfx-rspack-plugin/Cargo.toml` | **NEW** | `1-25` `name="rspfx-rspack-plugin"` `crate-type=["cdylib"]` depends on `rspack_core = { version="1.2", features=["plugin"] }`, `rspack_cacheable`, `napi`. |
| `/Volumes/New Volume/code/spfx/crates/rspfx-rspack-plugin/src/lib.rs` | **NEW** | `1-150` `#[napi] pub struct SpfxPublicPathPlugin { entries: Vec<BundleEntry> }` + `impl Plugin for SpfxPublicPathPlugin` — hooks `this_compilation` → `process_assets` at `PROCESS_ASSETS_STAGE_REPORT (5000)` mirrors `packages/compiler-rspack/src/public-path.ts:87-116`. Uses `compilation.update_asset` with `RawSource(captureLine + rewritten)`, zero-copy `Arc<dyn Source>`. Holds `SPFX_PUBLIC_PATH_SENTINEL = "__RSPFX_SPFX_PUBLIC_PATH__"` const at `4` same as TS. |
| `/Volumes/New Volume/code/spfx/crates/rspfx-rspack-plugin/src/localized.rs` | **NEW** | `1-80` `pub struct SpfxLocalizedResourcesPlugin { resources: Vec<LocalizedResource> }` — `apply` at `PROCESS_ASSETS_STAGE_ADDITIONAL` mirroring `localized-resources.ts:23-44`; uses `std::fs::read` + `compilation.emit_asset` with `RawSource(content)`. Handles `resources` empty early return at `20-22`. |
| `/Volumes/New Volume/code/spfx/packages/compiler-rspack/src/public-path.ts` | **MODIFY** | `1-117` — keep `1-78` helper `captureLine`, `scriptUrlGlobalKey`, `publicPathExpression`, `scriptUrlCaptureLine`, `scriptUrlPublicPathExpression` identical (bundler-agnostic, reused by Vite plugin). `79-117` `SpfxPublicPathPlugin` class becomes `let RustPlugin; try...` selector at `79-84`, then `export const SpfxPublicPathPlugin = RustPlugin ?? JsPlugin` at `85`. No API change. |
| `/Volumes/New Volume/code/spfx/packages/compiler-rspack/src/localized-resources.ts` | **MODIFY** | `1-45` — same selector pattern: `12-45` `SpfxLocalizedResourcesPlugin` gains native-or-JS branch. Keeps `fs.readFileSync` fallback at `30-34`. |
| `/Volumes/New Volume/code/spfx/crates/rspfx-dev/Cargo.toml` | **NEW optional** | `1-22` `name="rspfx-dev"` `crate-type=["bin","cdylib"]` behind `optional = true` feature; deps `axum="0.7"`, `tower-http="0.6"`, `notify="6.1"`, `tokio-tungstenite="0.24"`, `rcgen="0.13"`. Not required for 0.1.0; lands behind `--features dev`. |
| `/Volumes/New Volume/code/spfx/crates/rspfx-dev/src/lib.rs` | **NEW optional** | `1-100` stub: `pub fn create_static_middleware(root: PathBuf) -> tower::Layer` mirroring `compiler-rspack/src/dev-server.ts:67` `createStaticMiddleware` + routes from `packages/dev-runtime/src/serve.ts:246`; `ensure_certificates` via `rcgen`. Guarded by `#[cfg(feature="dev")]`. |
| `/Volumes/New Volume/code/spfx/packages/compiler-rspack/src/dev-server.ts` | **TOUCH optional** | `67-100` — add comment `// TODO Phase 6 optional: delegate to crates/rspfx-dev when native available` but no functional change in 0.1.0. Keep TS `createStaticMiddleware` as fallback. |
| `/Volumes/New Volume/code/spfx/bench/bench.mjs` | **MODIFY** | `59` → add `cargo bench -p rspfx-sppkg --bench package` timing at `65-80` alongside existing `cold 633ms / recompile 68ms / build 315ms`. No CI wiring — local only. |

### 6.4 Types / Data Structures

**Rust → TS boundary (napi):**

```rust
// crates/rspfx-sppkg/src/lib.rs
#[napi(object)]
pub struct ZipEntry {
  pub name: String,                // ZipPath newtype → Utf8PathBuf validated, no `..` or absolute
  pub buffer: Vec<u8>,             // Uint8Array on TS side
}
#[napi(object)]
pub struct PackageOptions {
  pub level: u8,                   // 0-9, default 9
  pub pretty_xml: bool,            // maps to XmlNode pretty flag in xml.rs
}
#[napi(object)]
pub struct XmlNode {
  pub name: String,
  pub attrs: Option<HashMap<String,String>>,
  pub children: Option<Vec<XmlChild>>,
  pub single_quoted_attrs: Option<Vec<String>>,
}
#[napi(string_enum)]
pub enum ResxErrorKind { MissingData, InvalidXml, DuplicateKey }
#[napi(object)]
pub struct ValidationResult { pub ok: bool, pub errors: Vec<String> }

// crates/rspfx-manifest/src/lib.rs
#[napi(object)]
pub struct ScanOpts {
  pub project_root: String,
  pub webparts_dir: String,        // default "src/webparts"
  pub extensions_dir: String,      // default "src/extensions"
  pub libraries_dir: String,       // default "src/libraries"
  pub package_version: String,
  pub bundle_files: HashMap<String,String>, // entryModuleId -> filename
  pub externals: Vec<String>,
  pub localized_resources: Option<Vec<LocalizedResourceEntry>>,
  pub production: bool,
  pub base_urls: BaseUrls,         // { debug: String, release: Vec<String> }
}
#[napi(object)]
pub struct ComponentManifest {
  pub id: String,                  // ComponentId newtype Uuid
  pub alias: String,
  pub component_type: String,      // "WebPart" | "Extension" | "Library" | "AdaptiveCardExtension"
  pub version: String,
  pub manifest_version: u32,
  pub loader_config: LoaderConfig,
  #[napi(js_name = "$schema")]
  pub schema: Option<String>,
}
#[napi(object)]
pub struct LoaderConfig {
  pub internal_module_base_urls: Vec<String>,
  pub entry_module_id: String,
  pub script_resources: HashMap<String, serde_json::Value>, // type:"path"|"component"|"localizedPath"
  pub export_name: Option<String>,
}

// crates/rspfx-rspack-plugin/src/lib.rs
#[napi(object)]
pub struct BundleEntry { pub name: String, pub import: String, pub component_ids: Vec<String>, pub version: String }
#[napi(object)]
pub struct LocalizedResource { pub name: String, pub files: Vec<LocalizedFile> }
#[napi(object)]
pub struct LocalizedFile { pub path: String, pub locale: String } // locale = CultureName newtype
pub const SPFX_PUBLIC_PATH_SENTINEL: &str = "__RSPFX_SPFX_PUBLIC_PATH__";
```

**TS fallback types (unchanged public surface):**

```ts
// packages/sppkg-builder/src/zip.ts:4-12  (kept)
export interface ZipFileEntry { name: string; buffer: Uint8Array; }
export interface SppkgValidationResult { ok: boolean; errors: string[]; }

// packages/manifest-generator/src/types.ts:1-14 (kept, but ScanOpts internal)
export interface ComponentManifest { id:string; alias:string; componentType:string; version:string; manifestVersion:number; loaderConfig:{...} }
export interface ManifestContext { projectRoot:string; production:boolean; baseUrls:{debug:string; release:string[]}; packageVersion:string; bundleFiles:Map<string,string>; externals:string[]; localizedResources?:LocalizedResourceEntry[]; webpartsDir?:string; extensionsDir?:string; librariesDir?:string; entryModuleIds?:Record<string,string>; }

// packages/compiler-rspack/src/types.ts (BundleEntry, LocalizedResource unchanged)
export interface BundleEntry { name:string; import:string; componentIds:string[]; version:string; }
export interface LocalizedResource { name:string; files:{ path:string; locale:string }[]; }
```

**Newtype layer (from Phase 1, reused):**

```ts
// packages/core/src/newtypes.ts (Phase 1) — Rust mirrors with Tuple structs
export type ComponentId = string & { __brand:'ComponentId' }; // Uuid::parse
export type ZipPath = string & { __brand:'ZipPath' };         // Utf8PathBuf, no `..`
export type CultureName = string & { __brand:'CultureName' }; // en-US formatted, see lcid.ts:72-81 formatCulture
export type Lcid = number & { __brand:'Lcid' };               // u32
```

Rust:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ComponentId(Uuid);
#[derive(Debug, Clone)]
pub struct ZipPath(Utf8PathBuf);
#[derive(Debug, Clone, Copy)]
pub struct Lcid(u32);
#[derive(Debug, Clone)]
pub struct CultureName(String); // validated via locale_to_culture_name
```

**Error mapping:**

```rust
#[napi(object)]
pub struct RspfxError { pub code: String, pub message: String, pub cause: Option<String> }
// codes: "DUPLICATE_ZIP_ENTRY" (zip.ts:18), "INVALID_RESX", "INVALID_XML", "UNRESOLVED_EXTERNAL" (component-manifests.ts:126), "MULTIPLE_MANIFESTS" (component-manifests.ts:80)
```

TS catches as `RspfxError` branded `RspfxErrorCode` from `packages/diagnostics/src/codes.ts:1`.

### 6.5 Ordered Implementation Steps

1. **Scaffold Cargo workspace (0.5d)** — create `/Volumes/New Volume/code/spfx/Cargo.toml` at root, `crates/rspfx-sppkg/Cargo.toml`, `crates/rspfx-manifest/Cargo.toml`, `crates/rspfx-rspack-plugin/Cargo.toml`. Add `.gitignore` entry `crates/*/target/`, `*.node`. Verify `cargo check --workspace` passes with empty `lib.rs` stubs exporting `#[napi] fn hello()->String`. No CI change.

2. **Port `lcid` + `glob` + `xml` + `resx` (2d)** — implement `crates/rspfx-sppkg/src/lcid.rs:1-90`, `glob.rs:1-70`, `xml.rs:1-120`, `resx.rs:1-80` as pure functions with unit tests `cargo test --workspace` covering `lcid.ts:60-107` matrix (`af-za→1078` etc.), `globToRegExp` edge cases (`**/`, `*.resx`), `parseResx` with `xml:space`, comments, entity decoding. TS facades in `packages/sppkg-builder/src/lcid.ts:1-8`, `glob.ts:1-8`, `xml.ts:1-8`, `resx.ts:1-8` add `tryRequire` delegation but keep fallback.

3. **Implement `zip` crate (3d)** — `crates/rspfx-sppkg/src/lib.rs:1-180` `build_package` + `crates/rspfx-sppkg/src/zip.rs:1-100` `validate_sppkg`. Use `zip::ZipWriter::new_append`? actually `ZipWriter::new(Cursor<Vec<u8>>)` with `SimpleFileOptions::default().compression_method(Stored|Deflated).compression_level(Some(9))`. Ensure deterministic entry order: sort `entries` by `name` before write (matches `globFiles` sort at `glob.ts:46`). Add `__IntegrationTest` that zips then `zip::ZipArchive` reads CRC matches `fflate` CRC from fixture `reference/FORMATS.md`. Modify `packages/sppkg-builder/src/zip.ts:14-62` to delegate. Add `cargo bench --bench package` at `crates/rspfx-sppkg/benches/package.rs:1-60` measuring `shadcn` 4-entry package <200ms vs JS `bench/bench.mjs:59` 315ms.

4. **Parallel manifest crate (3d)** — `crates/rspfx-manifest/src/lib.rs:1-200` + `sp_dependencies.rs:1-90` + `manifests_js.rs:1-80`. Implement `tokio::fs` async walk: `tokio::fs::read_dir` + `walkdir::WalkDir` parallel via `rayon::par_bridge`. `serde_json::from_str` + `schemars` validation; `askama` template `templates/manifests.js.j2` producing `define([...],...)` AMD wrapper. Keep TS `packages/manifest-generator/src/component-manifests.ts:43-157` delegating; legacy path stays for fallback. Test via `packages/manifest-generator/tests/parity.test.ts` hash comparison (existing Phase 0 baseline) — run both JS and Rust paths, assert identical `ComponentManifest[]` JSON.

5. **Rspack plugins (3d)** — `crates/rspfx-rspack-plugin/src/lib.rs:1-150` `SpfxPublicPathPlugin` and `src/localized.rs:1-80` `SpfxLocalizedResourcesPlugin`. Implement `Plugin` trait: `apply` registers `this_compilation` hook, `process_assets` at `PROCESS_ASSETS_STAGE_REPORT` (5000) for public-path and `PROCESS_ASSETS_STAGE_ADDITIONAL` for localized. Use `rspack_core::rspack_sources::RawSource` via `Arc`. Modify `packages/compiler-rspack/src/public-path.ts:79-117` and `localized-resources.ts:12-45` to selector pattern. Test parity: build `examples/svelte` and `examples/shadcn` with both JS and Rust plugins, diff `dist/*.js` header `startsWith('(function(){window["__rspfx_script_url_')` at `public-path.ts:29` stable prefix + `SPFX_PUBLIC_PATH_SENTINEL` replacement via `scriptUrlPublicPathExpression` at `public-path.ts:41-44`.

6. **Fallback & error hardening (1d)** — ensure every native `require` is `try { require } catch {}` not top-level throw; log `debug` via `packages/diagnostics/src/logger.ts:29` `createLogger('rspfx:rust')` when native missing, but not warn (fallback is expected on `npm install --ignore-scripts`). Make `napi` optional: `packages/*/package.json` add `optionalDependencies: { "@mbsks/rspfx-sppkg-native": "workspace:*" }`? Actually keep simple `tryRequire('../../crates/rspfx-sppkg/index.node')` resolved relative to built file; no `optionalDependencies` needed. Document fallback in `docs/architecture.md#rust`.

7. **Bench & parity gate (1d)** — run `bench/bench.mjs:59` with env `RSPFX_NATIVE=1` vs `RSPFX_NATIVE=0`, assert `recompile <40ms` on `shadcn` when native (target), and ZIP CRC matches fixture via `zip` crate not `fflate`. Run `pnpm test` with both paths (test helper sets `process.env.RSPFX_NATIVE`). No CI — local `cargo test --workspace` + `pnpm test` manual.

8. **Optional `rspfx-dev` stub (1d, stretch)** — `crates/rspfx-dev/src/lib.rs:1-100` behind `#[cfg(feature="dev")]` exposing `create_static_middleware` and `ensure_certificates`; leave `packages/compiler-rspack/src/dev-server.ts:67` untouched except comment. Not required for exit.

9. **Docs & changelog (0.5d)** — update `docs/internal-api.md` with `native?` flag, `ARCHITECTURE.md:7` note `crates/*` optional, `CHANGELOG.md ## [0.1.0]` entry: "Rust-accelerated sppkg/manifest/rspack plugins with JS fallback". No CI docs.

**Total 15d** — overlaps Phase 5 after step 1; steps 2-5 parallelizable across 2 engineers (TS facades vs Rust impls).

### 6.6 Migration Notes

- **No migration required for consumers.** Public API unchanged. `writeZip`, `generateComponentManifests`, `SpfxPublicPathPlugin` signatures identical.
- **Opt-in native:** `pnpm install` builds native via `napi` postinstall (`cargo build --release` via `napi build --platform`). If build fails (no Rust toolchain), JS fallback silently used. To force JS: `RSPFX_NATIVE=0 pnpm build`. To force native: `RSPFX_NATIVE=1 pnpm build` (throws if native missing).
- **RESX strictness:** If project has malformed `loc/*.resx` (e.g., unescaped `&`, missing `</data>`), previous `parseResx` returned partial `{}`, now throws `RspfxError('INVALID_RESX')`. Fix RESX file; run `rspfx doctor` will surface new error code.
- **Deterministic ZIP:** Rust sorts entries; JS `fflate` preserves insertion order. If code relied on insertion order, output may differ but still valid ZIP (SharePoint only cares about presence, not order). CRC and file count unchanged; SharePoint extraction identical.
- **Node version:** `napi-rs` requires Node 18+ (already required `Node 20+` per `ARCHITECTURE.md:7`). No change.
- **Publishing:** `crates/*` are not published to npm; only TS facades are. `cargo` crates are internal; publish uses `napi` prebuilt binaries via `optionalDependencies` if desired later — not in 0.1.0.

### 6.7 Exit Criteria (Functional)

- [ ] `cargo test --workspace` passes (unit tests for `lcid` matrix, `globToRegExp` 20 cases, `parseResx` with `xml:space` + entities, `serializeXml` pretty vs compact, `validateSppkg` missing-entry cases).
- [ ] `cargo fmt --check` and `cargo clippy -- -D warnings` pass locally (no CI gate, manual).
- [ ] `pnpm build && pnpm test` green with `RSPFX_NATIVE=1` and `RSPFX_NATIVE=0` (both paths exercised; parity hash `packages/plugin/tests/parity.test.ts:1` identical).
- [ ] `.sppkg` ZIP CRC verified by `zip` crate (not just `fflate` JS) — `readZipEntries` via Rust returns same `Map<string,Buffer>` as JS path for `examples/shadcn`, `examples/svelte`, `templates` fixtures.
- [ ] `bench/bench.mjs` recompile <40ms on `shadcn` with native (vs 68ms baseline), `package` step <200ms (vs 315ms) — measured via `bench/bench.mjs:59` median of 5 runs.
- [ ] No `unknown[]` regression — `packages/plugin-api/src/types.ts:29` stays clean.
- [ ] Fallback works: deleting `crates/rspfx-sppkg/index.node` and running `pnpm test` still passes (JS path).
- [ ] No CI files modified (`git diff --name-only | grep -E '^\.github|scripts/check'` empty).

### 6.8 Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `napi` build fails on consumer machine (no Rust toolchain) | Build breaks | `tryRequire` fallback — JS path is primary; native is acceleration. Document `RSPFX_NATIVE=0`. No `postinstall` hard failure. |
| `zip` crate output byte-differs from `fflate` (compression level, extra fields) causing `reference/FORMATS.md` fixture drift | Parity test fails | Match `fflate` level 9 (`flate2::Compression::best()`), set `unix_permissions(0o644)`, deterministic `last_modified` (`1980-01-01`), sort entries. Add `zip` vs `fflate` CRC cross-check test. |
| `quick-xml` stricter than regex RESX parser — rejects legacy `&` in values | Build fails for existing projects | Provide codemod `rspfx doctor --fix-resx` (outside Phase 6) and keep fallback regex path when `RSPFX_NATIVE=0`. Document in migration. |
| `tokio::fs` async vs `fs.readdirSync` sync ordering changes manifest order | LoaderConfig `scriptResources` order diff | Sort `manifests` by `id` before emit; sort `scriptResources` keys (already `externalNames.sort()` at `component-manifests.ts:104`). Test parity hash. |
| `rspack_core` version pin drift (`rspack = "1.2"` vs `compiler-rspack` `package.json` `@rspack/core: ^1.2.x`) causes plugin ABI mismatch | Plugin `apply` panic | Pin `rspack_core` exactly to `compiler-rspack` peer (`cargo update -p rspack_core --precise`). Add `cargo tree | grep rspack_core` check in `bench/bench.mjs` comment. Keep JS plugin as fallback. |
| `rayon` + `tokio` thread pool oversubscription (both create global pools) | Perf regression, deadlock | Use `tokio::task::spawn_blocking` for `rayon` work, limit `rayon` threads to `num_cpus/2`. Measure via `cargo bench`. |
| `walkdir` follows symlinks unintentionally (vs `glob.ts:48` `isSymbolicLink() continue`) | Infinite loop on circular `node_modules` links | Configure `WalkDir::follow_links(false)` explicitly; test with `pnpm` symlink `node_modules/.pnpm`. |
| Native asset `RawSource` lifetime bug (use-after-free `Arc`) | Rspack crash | Use `rspack_core::rspack_sources::RawSource::from(content)` which clones `String` into `Arc`; don't hold `&str` reference. Test with `RSPACK_CACHE=1` persistent cache. |
| Publishing size — `.node` binaries bloat `npm pack` | Tarball > 50MB | Don't publish `.node` in npm tarball; `crates/*/index.node` is `.gitignore`d, built locally via `napi build`. Future prebuild via `optionalDependencies` deferred. |

### 6.9 Effort Estimate

**15d total** (single engineer; 8d with 2 engineers in parallel with Phase 5):

| Task | Days | Engineer |
|---|---|---|
| Cargo workspace scaffold + stubs | 0.5 | Rust |
| `lcid`/`glob`/`xml`/`resx` ports + tests | 2 | Rust |
| `zip` crate + bench | 3 | Rust |
| `manifest` crate (async walk + askama) | 3 | Rust |
| Rspack plugins (public-path + localized) | 3 | Rust + TS |
| Fallback hardening + error mapping | 1 | TS |
| Bench & parity gate | 1 | Either |
| Optional `rspfx-dev` stub | 1 (stretch) | Rust |
| Docs & changelog | 0.5 | TS |

Parallelizable: `sppkg` (steps 2-3) and `manifest` (step 4) independent; `rspack-plugin` (step 5) needs kernel `CompileContext` frozen (Phase 5 `packages/plugin/src/kernel.ts`).

---
