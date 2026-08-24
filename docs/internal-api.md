# RSPFX Internal API Contract

Single source of truth for package public surfaces. Subagents implement EXACTLY
these signatures — no invented names, no scope creep. Read `reference/FORMATS.md`
for SharePoint formats. ESM only (`"type": "module"`). Strict TS. No comments
unless requested. Zero webpack/heft/gulp dependencies anywhere.

## Shared conventions

- Packages: `@mbsks/rspfx-<name>`, version `0.0.11`, ESM, `main`/`types` → `dist/`; all 19 publishable packages (`packages/*` + `apps/cli`) share one version bumped together via `scripts/publish.mjs:17` (`0.0.6→0.0.7→0.0.11`; `bun run publish`); `examples/*` and `apps/playground` are `private:true` and excluded.
- Native acceleration (optional): `crates/rspfx-sppkg`, `crates/rspfx-manifest`, `crates/rspfx-rspack-plugin` provide Rust implementations with JS fallback (`try { require('../../crates/.../index.node') } catch {}`); no `.node` required — `pnpm build` and `pnpm test` pass with or without native.
- All packages build with `tsc` to `dist/`; typecheck: `pnpm -w exec tsc --noEmit -p <pkg>/tsconfig.json`.
- Errors: throw `RspfxError(code, message, cause?)` from `@mbsks/rspfx-diagnostics`.
- Tests: vitest, colocated `tests/*.test.ts`, happy-dom only where DOM needed.

---

## @mbsks/rspfx-core (zero dependencies)

`packages/core/src/index.ts` exports:

```ts
export type FrameworkId = 'vanilla' | 'react' | 'solid' | 'vue' | 'preact' | 'svelte' | (string & {});
export type SpfxTarget = '1.20' | '1.21' | '1.22' | '1.23';

export interface DevConfig {
  port?: number;                 // default 4321 (manifest+bundle server, like official serve)
  https?: boolean;               // default true
  hostname?: string;             // default 'localhost'
  workbench?: boolean;           // default true — auto-open workbench page
  fastRefresh?: boolean;         // default false (rspfx dev --refresh)
  openBrowser?: boolean;         // default false — opt in with rspfx dev --browser
  tenantUrl?: string;            // e.g. https://contoso.sharepoint.com
  initialPage?: string;          // overrides tenantUrl; supports {tenantdomain} token
}
export interface BuildConfig {
  sourcemap?: boolean;           // @deprecated — set devtool in bundler config; scaffold-only default false
  minify?: boolean;              // @deprecated — set optimization.minimize / build.minify in bundler config; scaffold-only default true
  splitChunks?: boolean;         // @deprecated — must remain false for SPFx AMD correctness; scaffold-only default false
  outDir?: string;               // default 'dist'
  releaseDir?: string;           // default 'release'
}
export interface DeployConfig {
  tenantUrl?: string; username?: string; password?: string;
  appCatalogSiteUrl?: string;    // e.g. https://contoso.sharepoint.com/sites/appcatalog
}

export interface RspfxConfig {
  name: string;                  // project name (npm name)
  version?: string;              // build-time version for AMD library names + manifests; overrides package.json
  framework: FrameworkId;
  spfxVersion: SpfxTarget;       // default '1.23'
  dev: DevConfig;
  build: BuildConfig;
  deploy?: DeployConfig;
}
export function defineConfig(config: RspfxConfig): RspfxConfig;
export function resolveConfig(config: Partial<RspfxConfig>): RspfxConfig; // fills defaults
export const RSPFX_PLUGIN_MARKER: symbol;  // Symbol.for('@mbsks/rspfx/bundler-plugin'); stamped on bundler plugin instances
export interface RspfxBundlerPluginLike {  // structural contract for RspfxPlugin / rspfxVite
  options: RspfxConfig;
  [key: symbol]: unknown;
}

// SPFx-mirror types (structural, no @microsoft dependency)
export enum EnvironmentType { Local = 0, ClassicSharePoint = 1, SharePoint = 2 }
export enum PropertyPaneFieldType {
  Custom = 1, CheckBox = 2, TextField = 3, Dropdown = 4, Toggle = 5, Link = 6,
  Slider = 7, Heading = 8, ChoiceGroup = 9, Button = 10, HorizontalRule = 11,
  Image = 12, Thumbnail = 13, ColorPicker = 14, SpinButton = 15, Label = 16,
  DynamicField = 17, DynamicFieldSet = 18, DynamicData = 19,
}
export class Version {  // mirrors sp-core-library Version
  constructor(major: number, minor: number, patch: number, build?: number);
  static parse(versionString: string): Version;
  static tryParse(versionString: string): Version | undefined;
  static compare(v1: string, v2: string): number; // -1 | 0 | 1
  readonly major: number; readonly minor: number; readonly patch: number; readonly build: number;
  toString(): string; compareTo(other: Version): number;
}
export interface ISpfxTheme { palette: Record<string, string>; [k: string]: unknown }
export interface ThemeProvider {
  getTheme(): ISpfxTheme | undefined;
  addChangeListener(listener: () => void): void;
  removeChangeListener(listener: (() => void)): void;
}
export interface WebPartContextLike {   // minimal surface used by web parts/templates
  instanceId: string;
  webPartTag: string;
  domElement: HTMLElement;
  properties: Record<string, unknown>;
  environment: { type: EnvironmentType };
  pageContext: { web: { title: string; absoluteUrl: string }; site: { absoluteUrl: string } };
  themeProvider?: ThemeProvider;
  propertyPane: Record<string, unknown>;
  [key: string]: unknown;
}

export interface HeadlessAdapter<TProps extends Record<string, unknown>> {
  readonly mount: (root: HTMLElement, props: TProps) => void;
  readonly update: (root: HTMLElement, props: TProps) => void;
  readonly unmount: (root: HTMLElement) => void;
}
export interface HeadlessContext {
  readonly domElement: HTMLElement;
  readonly theme: ISpfxTheme | undefined;
  readonly themeProvider?: ThemeProvider;
  readonly environment: EnvironmentType;
  readonly cultureName: string;
  readonly manifestId?: string;
}
export type PropsSelector<TProps, TRaw = Record<string, unknown>> = (raw: TRaw, ctx: HeadlessContext) => TProps;
```

`HeadlessAdapter` lives in `src/headless.ts`, exported via `@mbsks/rspfx-core/headless` (zero-deps).

## @mbsks/rspfx-webpart-base (depends on core + @microsoft/sp-webpart-base)

```ts
export abstract class HeadlessWebPart<TProps extends Record<string, unknown> = Record<string, unknown>> extends BaseClientSideWebPart<TProps> {
  protected abstract createAdapter(): HeadlessAdapter<TProps>;
  protected getComponentProps(): TProps;           // default: this.properties as TProps
  public override render(): void;                   // adapter.mount(this.domElement, getComponentProps())
  protected override onDispose(): void;             // adapter.unmount + super
  protected updateProps(next: TProps): void;        // adapter.update
}
export function defineWebPart<const TProps extends Record<string, unknown>>(opts: {
  readonly adapterFactory: (host: { domElement: HTMLElement }) => HeadlessAdapter<TProps>;
  readonly selector?: PropsSelector<TProps>;
  readonly propertiesSchema?: (raw: unknown) => TProps;
  readonly displayName?: string;
  readonly getPropertyPaneConfiguration?: () => unknown;
}): new () => HeadlessWebPart<TProps>;
/** @deprecated alias for HeadlessWebPart — use @mbsks/rspfx-webpart-base */
export const BaseWebPart = HeadlessWebPart;
```

Compat shim at `@mbsks/rspfx-core/webpart` re-exports `HeadlessWebPart as BaseWebPart` with a one-time `console.warn('deprecated: use @mbsks/rspfx-webpart-base')`.

## @mbsks/rspfx-plugin-api (depends on core only)

```ts
export interface FrameworkRspackContributions {   // structural; typed loosely to stay compiler-agnostic
  rules?: unknown[];        // rspack RuleSetRule[]
  plugins?: unknown[];      // rspack plugin instances
  resolve?: { alias?: Record<string, string>; extensions?: string[] };
  swc?: { jsc?: { parser?: unknown; transform?: unknown } };   // for builtin:swc-loader options
  define?: Record<string, string>;
  moduleTest?: { test?: RegExp; type?: string };  // e.g. { type: 'asset' } for css
}
export interface FrameworkViteContributions {    // vite-shaped; merged into the vite config by rspfxVite
  plugins?: unknown[];        // vite plugin instances (@vitejs/plugin-react, @vitejs/plugin-vue, @prefresh/vite, @sveltejs/vite-plugin-svelte, vite-plugin-solid)
  esbuild?: Record<string, unknown>;             // esbuild transform options, e.g. { jsx: 'automatic' }
  resolveExtensions?: string[];
  define?: Record<string, string>;
}
export interface FrameworkRsbuildContributions {  // webpack/rspack-shaped, minus the swc block (Rsbuild owns SWC)
  rules?: unknown[];        // loader strings rewritten to absolute paths via resolveContributionLoaders
  plugins?: unknown[];      // rspack plugin instances
  resolve?: { alias?: Record<string, string>; extensions?: string[] };
  define?: Record<string, string>;
}
export interface FrameworkPreset<F extends string = import('@mbsks/rspfx-core').FrameworkId> {
  name: F; // custom frameworks use FrameworkPreset<string> — FrameworkId is 'vanilla' | 'react' | 'solid' | 'vue' | 'preact' | 'svelte' | (string & {})
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions;
  vite?(opts: { fastRefresh: boolean }): FrameworkViteContributions;       // optional — absent = no Vite support; rspfxVite warns loudly
  rsbuild?(opts: { fastRefresh: boolean }): FrameworkRsbuildContributions; // optional — rspfxRsbuild falls back to contributions() when absent
}
export const HOOK_PHASES = ['beforeCompile','afterCompile','afterStats','beforeGenerate','afterGenerate','beforeStart','afterStart','beforePackage','afterPackage'] as const;
export type HookPhase = typeof HOOK_PHASES[number];
export type HookResult<T> = Result<T, RspfxError | AggregateRspfxError>;
export type BeforeCompile = (ctx: CompileContext) => HookResult<CompileContext> | void | Promise<HookResult<CompileContext>|void>;
export type AfterStats = (stats: Stats) => void | Promise<void>;
export type BeforeGenerate = (ctx: { readonly production: boolean; readonly webParts: readonly WebPartEntry[] }) => HookResult<typeof ctx> | void | Promise<HookResult<typeof ctx>|void>;
export type AfterGenerate = (ctx: { readonly manifests: readonly ComponentManifest[]; readonly releaseDir: string }) => void | Promise<void>;
export type BeforePackage = (ctx: { readonly manifests: readonly ComponentManifest[]; readonly files: ReadonlyMap<ZipPath, Uint8Array> }) => HookResult<ReadonlyMap<ZipPath,Uint8Array>> | ReadonlyMap<ZipPath,Uint8Array> | void | Promise<...>;
export type AfterPackage = (ctx: { readonly sppkgPath: ZipPath }) => void | Promise<void>;
export type OnHookError = (err: RspfxError, phase: HookPhase, pluginName: string) => 'throw' | 'continue';
export interface CompilerHooks { beforeCompile?: BeforeCompile; afterStats?: AfterStats; afterCompile?: AfterStats; }
export interface ReleaseHooks { beforeGenerate?: BeforeGenerate; afterGenerate?: AfterGenerate; }
export interface DevHooks { beforeStart?: (ctx: { readonly mode: 'local'|'sharepoint'; readonly port?: number }) => HookResult<typeof ctx>|void | Promise<...> ; afterStart?: (ctx: { readonly url: string }) => void | Promise<void>; }
export interface PackageHooks { beforePackage?: BeforePackage; afterPackage?: AfterPackage; }
export interface RspfxExtension {
  readonly name: string;
  readonly frameworkPreset?: FrameworkPreset;
  readonly compilerHooks?: CompilerHooks;
  readonly releaseHooks?: ReleaseHooks;
  readonly devHooks?: DevHooks;
  readonly packageHooks?: PackageHooks;
  readonly onError?: OnHookError;
  readonly priority?: number;
}
export function definePlugin(plugin: RspfxExtension): RspfxExtension;
export function registerPlugin(plugin: RspfxExtension): void;      // global registry; read by the CLI before each build/package
export function getPlugins(): RspfxExtension[];
export interface HookBus {
  readonly plugins: readonly RspfxExtension[];
  emitBeforeCompile(ctx: CompileContext): Promise<HookResult<CompileContext>>;
  emitAfterStats(stats: Stats): Promise<void>;
  emitBeforeGenerate(ctx: { readonly production: boolean; readonly webParts: readonly WebPartEntry[] }): Promise<HookResult<typeof ctx>>;
  emitAfterGenerate(ctx: { readonly manifests: readonly ComponentManifest[]; readonly releaseDir: string }): Promise<void>;
  emitBeforeStart(ctx: { readonly mode: 'local'|'sharepoint'; readonly port?: number }): Promise<HookResult<typeof ctx>>;
  emitAfterStart(ctx: { readonly url: string }): Promise<void>;
  emitBeforePackage(ctx: { readonly manifests: readonly ComponentManifest[]; readonly files: ReadonlyMap<ZipPath,Uint8Array> }): Promise<HookResult<ReadonlyMap<ZipPath,Uint8Array>>>;
  emitAfterPackage(ctx: { readonly sppkgPath: ZipPath }): Promise<void>;
}
export function createHookBus(plugins: readonly RspfxExtension[], opts?: { logger?: Logger; onError?: OnHookError }): HookBus;
export function composeHooks<T>(...hooks: Array<(ctx: T) => HookResult<T>|void>): (ctx: T) => Promise<HookResult<T>>;
export function sortedPlugins(plugins: readonly RspfxExtension[]): readonly RspfxExtension[];
```

The hooks are wired at fixed points in the shared pipeline; with no registered
plugins the loops are empty no-ops and behavior is unchanged:

- `vite()` / `rsbuild()` are the M8 bundler-parity surface. `rspfxVite` calls
  `preset.vite({ fastRefresh })` and merges plugins/esbuild/resolveExtensions/define
  into the vite config (loud warning when the method is absent — no Vite support
  for that framework). `rspfxRsbuild` calls `preset.rsbuild({ fastRefresh })` in
  `modifyRspackConfig` and merges rules/plugins/resolve/define (loader strings
  rewritten against the framework package's own `node_modules` by
  `resolveContributionLoaders`); when `rsbuild()` is absent it falls back to
  `contributions()` minus the swc block. React/preact rsbuild refresh is
  babel-based (`react-refresh/babel`, `@prefresh/babel-plugin`); vue/svelte/solid
  rsbuild reuse their rspack loader rules.
- `compilerHooks.beforeCompile` — invoked with the resolved `CompileContext` before
  `build()` runs; plugins mutate it in place (e.g. push into `additionalPlugins` or
  `swcContributions`). The return value is ignored. (CLI rspack path only.)
- `compilerHooks.afterStats` — invoked with the rspack stats once `build()` resolves.
- `releaseHooks.beforeGenerate` / `releaseHooks.afterGenerate` — fired by
  `assembleRelease` (`packages/dev-runtime/src/release.ts`) around component-manifest
  generation, so they run identically for every entry point: `rspfx build` (CLI) and
  the native bundler commands (`vite build`, `rspack build`, `rsbuild build`).
- `devHooks.beforeStart` / `devHooks.afterStart` — fired around dev-server startup by
  `rspfx dev` (rspack path) and by the vite/rsbuild plugins (`configureServer`,
  `onBeforeStartDevServer`/`onAfterStartDevServer`).
- `packageHooks.beforePackage` — invoked with `{ manifests, files }` before the
  `.sppkg` is assembled (`rspfx package`); `manifests` are the release component
  manifests, `files` are the release assets as `{ path, content }` so plugins can
  add or transform package files.
- `packageHooks.afterPackage` — invoked with `{ sppkgPath }` once the `.sppkg` is written.

## @mbsks/rspfx-diagnostics (depends on core only)

```ts
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'success' | 'trace';
export type LogFields = Record<string, string|number|boolean|undefined>;
export interface LogEntry { readonly level: LogLevel; readonly name: string; readonly message: string; readonly fields: Readonly<LogFields>; readonly timestamp: string; readonly error?: unknown; }
export interface LoggerOptions { readonly level?: LogLevel; readonly json?: boolean; readonly sinks?: Array<(e: LogEntry)=>void>; }
export interface Logger {
  readonly name: string;
  error(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  debug(message: string, fields?: LogFields): void;
  success(message: string, fields?: LogFields): void;
  trace(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
  isLevelEnabled(level: LogLevel): boolean;
  withLevel(level: LogLevel): Logger;
}
export function createLogger(name: string, opts?: LoggerOptions): Logger;
export function createDiagnosticFormatter(logger: Logger): (err: RspfxError|AggregateRspfxError)=>string;
export class RspfxError extends Error { readonly code: RspfxErrorCode; readonly cause?: RspfxError|Error; constructor(code: RspfxErrorCode, message: string, cause?: RspfxError|Error) }
export class AggregateRspfxError extends Error { readonly code: RspfxErrorCode.AGGREGATE; readonly errors: readonly RspfxError[]; constructor(errors: readonly RspfxError[], message?: string) }
export function isRspfxError(e: unknown): e is RspfxError | AggregateRspfxError;
export function isAggregateRspfxError(e: unknown): e is AggregateRspfxError;
export function flatCauseChain(err: RspfxError): RspfxError[];
export function formatError(err: RspfxError|AggregateRspfxError, opts?: { color?: boolean }): string;
export async function trace<T>(name: string, fn: () => Promise<T>): Promise<T>; // logs duration
export function timeStart(name: string): () => number;      // returns elapsed ms fn
export function reportBenchmark(name: string, ms: number): void;  // appends .rspfx/benchmarks.jsonl
export function formatBytes(bytes: number): string;
export interface Tracer { span<T>(name: string, fn: ()=>Promise<T>): Promise<T>; time<T>(name: string, fn: ()=>T): T; }
export function createTracer(logger: Logger): Tracer;
```

## @mbsks/rspfx-compiler-rspack (depends on plugin-api, diagnostics)

```ts
export interface BundleEntry {
  name: string;                       // bundleName — manifests' loaderConfig.entryModuleId follows the bundle name (config.json bundle key, else webpart folder name)
  import: string;                     // absolute path to entry .ts/.tsx
  componentIds: string[];             // manifest ids in this bundle (for library name)
  version: string;                    // package version (library name: `${id}_${version}`)
}
export interface CompileContext {
  projectRoot: string;
  framework: FrameworkId;
  fastRefresh: boolean;
  production: boolean;
  entries: BundleEntry[];
  externals: string[];                // package names (sp-* etc.)
  build: BuildConfig;                 // from core
  serveMode?: boolean;                // dev server mode (no contenthash)
  additionalPlugins?: unknown[];      // from plugin registry
  swcContributions?: Record<string, unknown>[];  // from framework presets
}
export async function createRspackConfig(ctx: CompileContext): Promise<unknown>;
export async function build(ctx: CompileContext): Promise<{ stats: unknown; outputFiles: string[] }>; // writes dist/
export function watch(ctx: CompileContext, onDone: (stats: unknown, errors: unknown[]) => void): { close(): Promise<void> };
// dev server (rspack + @rspack/dev-server) — called by dev-runtime; returns started server
export async function startDevServer(ctx: CompileContext, devServerOptions: unknown): Promise<{ close(): Promise<void>; port: number; compiler: unknown; onEmit(cb: () => void): void }>;
```

## @mbsks/rspfx-plugin (depends on core, compiler-rspack, dev-runtime, manifest-generator, manifest-server, diagnostics)

The project config as bundler plugins — the replacement for the legacy
`rspfx.config.ts`. The CLI loads the user's `rspack.config.ts` /
`vite.config.ts` / `rsbuild.config.ts` via jiti, scans the `plugins` array for
the marker symbol, and reads the resolved `options` (project config). No plugin
→ CLI error with guidance.

```ts
export type { RspfxConfig } from '@mbsks/rspfx-core';
export { defineConfig, resolveConfig, RSPFX_PLUGIN_MARKER } from '@mbsks/rspfx-core';
// RSPFX_PLUGIN_MARKER: Symbol.for('@mbsks/rspfx/bundler-plugin') — stable across
// duplicated package copies; stamped on every plugin instance
export interface RspfxPluginOptions extends Partial<Omit<RspfxConfig, 'name'>> {
  name: string;
  projectRoot?: string;            // defaults to process.cwd()
}
// options carry: name, version (build-time version used in AMD library names and
// manifests — overrides package.json), spfxVersion, framework,
// dev (port/https/hostname/workbench/fastRefresh/openBrowser/tenantUrl/initialPage),
// build (sourcemap/minify/splitChunks/outDir/releaseDir), paths (srcDir/webpartsDir/configDir),
// deploy; defaults unchanged.
export class RspfxPlugin implements RspfxBundlerPluginLike {
  readonly [RSPFX_PLUGIN_MARKER]: true;
  readonly options: RspfxConfig;
  constructor(options: RspfxPluginOptions);
  apply(compiler: unknown): void;  // standard webpack plugin interface — webpack-compatible bundlers (Rspack) can run the compile-time parts; Turbopack does not support webpack plugins
}
export function rspfxVite(options: RspfxPluginOptions): ViteRspfxPlugin; // { name: 'rspfx', [RSPFX_PLUGIN_MARKER]: true, options }
export const VITE_ENV: { mode: string; entry: string; amdId: string; fastRefresh: string };
// env var names for per-bundle vite builds: RSPFX_VITE_MODE / RSPFX_VITE_ENTRY /
// RSPFX_VITE_AMD_ID, plus RSPFX_FAST_REFRESH ('1' gates fast refresh in dev;
// also enabled by dev.fastRefresh)
export function rspfxRsbuild(options: RspfxPluginOptions): RsbuildRspfxPlugin;
// { name: 'rspfx-rsbuild', [RSPFX_PLUGIN_MARKER]: true, options, setup(api) } — RsbuildPlugin-compatible
// setup: modifyRsbuildConfig (html: false, distPath.root = build.outDir, source.entry) +
// modifyRspackConfig (AMD library entries, externals, [name].js output, chunkLoadingGlobal
// webpackJsonp_<uniqueName>, SPFX_PUBLIC_PATH_SENTINEL publicPath, localized aliases, and the
// SpfxPublicPathPlugin / SpfxLocalizedResourcesPlugin / DefinePlugin instances)
```

`@mbsks/rspfx-core` exports the structural marker contract:
`RSPFX_PLUGIN_MARKER` and `RspfxBundlerPluginLike` (`{ options: RspfxConfig }`).

The full pipeline (manifests, dev server, packaging) runs through the rspfx CLI;
for Vite configs `rspfx build`/`rspfx package` spawn one `vite build` per web
part bundle (selected via `VITE_ENV` env vars), and `rspfx dev` spawns `vite`
(the plugin serves `/temp/manifests.js`, rebuilds AMD bundles into `dist/`,
opens the workbench when a tenant is configured). For Rsbuild configs a single
`rsbuild build` produces all web part bundles and `rspfx dev` spawns `rsbuild
dev`. The local preview page and mock `/_api` API are served by dev-runtime's
`startServe`, which the CLI runs on the Rspack path — the Vite/Rsbuild dev flows
are workbench-only for now.

M8 parity surface (shared with the Rspack path):

- `rspfxVite` loads the framework preset and merges its `vite()` contributions
  (loud warning when the framework has none). Each bundle is closed to Rspack
  byte-compat output: the `scriptUrlCaptureLine` is prepended (same bytes as the
  Rspack `SpfxPublicPathPlugin`), the `SPFX_PUBLIC_PATH_SENTINEL` is rewritten to
  the script-URL public-path expression, and emitted `.css` assets are inlined
  into the JS bundle (`cssCodeSplit: false`; no `.css` files in `dist/`).
- Both plugins write `.rspfx/stats.json` as `{ "moduleCounts": { "<bundle>": n } }`
  (per entry for vite; per entry chunk for rsbuild via `onAfterBuild`) — the
  `rspfx analyze` module counts for bundlers that emit no webpack-style stats.
- Fast refresh is gated on dev mode + (`RSPFX_FAST_REFRESH=1` or
  `dev.fastRefresh`): vite merges the preset's refresh plugins
  (`@vitejs/plugin-react`, `@prefresh/vite`, …); rsbuild merges the preset's
  `rsbuild()` rules/plugins in `modifyRspackConfig` (no swc block — Rsbuild owns
  SWC; loader strings rewritten via `resolveContributionLoaders`).
- Dev auto-reload: after each rebuild the reload controller is ticked and bundle
  URLs in `/temp/manifests.js` get a `?t=<epoch>` cache-busting suffix (both
  vite and rsbuild paths).

Notes for implementer:
- Use `builtin:swc-loader` for .ts/.tsx/.jsx/.js (parser jsx, decorators, importMeta); merge framework swc contributions.
- SCSS: `sass-loader` + `sass`; CSS modules via `experiments.css` + `.module.*` convention; no Tailwind special-casing — users wire their own CSS tooling (Tailwind, UnoCSS, …) in the bundler config.
- Output: filename `[name].js` (always — manifest references exact name), chunkFilename `chunk.[name].js`,
  `output.library: { type: 'amd', name: '<componentId>_<version>' }` (single component per bundle — M1 default),
  `externals: string[]`, `chunkLoadingGlobal: webpackJsonp_<uniqueName>` where uniqueName = single id_version or md5 hex of concatenated ids,
  `crossOriginLoading: 'anonymous'`, `publicPath: 'auto'`, `devtool: production ? (sourcemap?'hidden-source-map':false) : 'source-map'` (rspack value 'hidden-source-map' supported).
- DefinePlugin: DEBUG, DEPRECATED_UNIT_TEST, process.env.NODE_ENV.
- CSS inlined into JS bundle (SPFx has no external css in sppkg). Implement a tiny inline-css loader (or style-loader equivalent) — do NOT use css-extract.
- optimization: moduleIds 'named' in dev / 'deterministic' in production, usedExports, sideEffects, removeEmptyChunks; `minimize` only in production (`mode === 'production' && build.minify`).
- `experiments.css: true` only if stable; otherwise css-loader+style-loader chain. Verify in tests.
- Caching: rspack `cache: { type: 'filesystem' }` in watch mode.

## @mbsks/rspfx-manifest-generator (depends on core, diagnostics)

```ts
export interface ComponentManifest { id: string; alias: string; componentType: string; version: string; manifestVersion: number; loaderConfig: { internalModuleBaseUrls: string[]; entryModuleId: string; scriptResources: Record<string, unknown>; exportName?: string }; [k: string]: unknown }
export interface ManifestContext {
  projectRoot: string;
  production: boolean;
  baseUrls: { debug: string; release: string[] };   // debug: 'https://localhost:4321/dist/'; release: cdn or []
  packageVersion: string;                            // package.json version
  bundleFiles: Map<string, string>;                  // bundleName -> emitted js filename
  externals: string[];                               // externalized names → "type": "component" scriptResources
  webpartsDir?: string;                              // overrides default 'src/webparts' (config.paths.webpartsDir)
  entryModuleIds?: Record<string, string>;           // manifestId -> bundleName; overrides the folder-name default
}
export async function generateComponentManifests(ctx: ManifestContext): Promise<ComponentManifest[]>; // reads <webpartsDir>/*/*.manifest.json
export async function generateManifestsJs(manifests: ComponentManifest[], metadata?: unknown): Promise<string>; // exact template from reference/FORMATS.md §3
export function findSpDependencies(projectRoot: string): Map<string, { id: string; version: string; manifestPath: string }>; // node_modules/@microsoft/sp-*/dist/*.manifest.json; fallback reference/sp-component-ids.json
export function rewriteSpManifestForDebug(spManifest: unknown, relativePath: string, baseUrl: string): unknown; // prepend base url per ManifestUrlProcessor
```

## @mbsks/rspfx-sppkg-builder (depends on core, manifest-generator, diagnostics)

```ts
export interface PackageConfig { solution: Record<string, unknown>; paths: { zippedPackage: string } } // package-solution.json
export interface BuildPackageOptions {
  projectRoot: string;
  solutionConfigPath: string;      // config/package-solution.json
  manifestsDir: string;            // release/manifests (prod) or dist (dev)
  assetsDir: string;               // release/assets or dist
  outDir: string;                  // default projectRoot/sharepoint/solution (zippedPackage resolved against projectRoot)
  production: boolean;
  prettyXml?: boolean;
  teamsDir?: string;               // optional teams icons folder; files land under ClientSideAssets/ (flat)
  resxDir?: string;                // optional folder with Resources.resx + Resources.<lang>.resx (see below)
}
export async function buildPackage(opts: BuildPackageOptions): Promise<{ outputPath: string; zipEntries: string[]; appManifest: string }>;
// Zip via yazl or jszip (DEFLATE level 9). Full layout: reference/FORMATS.md §4. Must include:
// [Content_Types].xml, _rels/.rels → /AppManifest.xml, AppManifest.xml + _rels/AppManifest.xml.rels, feature_<id>.xml + .config.xml + _rels/feature_<id>.xml.rels,
// <featureId>/<ComponentType>_<componentId>.xml, ClientSideAssets feature + files (when includeClientSideAssets && production),
// rewrite manifest base urls to ['HTTPS://SPCLIENTSIDEASSETLIBRARY/'] when includeClientSideAssets.
// Extension components (componentType 'Extension'): elements XML uses Type="Extension", Location="ClientSideExtension.<extensionType>",
// ClientSideComponentProperties="null", and a ClientSideComponentInstance child (fresh random UUID per build); no <Module>.
// resxDir: Resources.resx (CultureName "default") + Resources.<lang>.resx parsed by src/resx.ts (regex, no deps; CultureName mapping in
// src/lcid.ts) and embedded at the zip root with content-defaultresource/content-resource rels; AppManifest metadata values
// "$Resources:Key" resolve into <LocalizedString CultureName="..."> entries per locale (missing keys fall back to the literal string).
export function validateSppkg(zipPath: string): Promise<{ ok: boolean; errors: string[] }>; // unzip + schema checks
```

## @mbsks/rspfx-manifest-server (depends on core, diagnostics)

`manifest-server` provides certs only; `:4321` serving is handled by the compiler dev server (`compiler-rspack` `startDevServer`) (bundles, `/temp/manifests.js`, `node_modules` static proxy).

```ts
export async function ensureCertificates(certsDir: string): Promise<{ key: string; cert: string }>;
// selfsigned (localhost + 127.0.0.1 SANs, 825 days); cached in certsDir (~/.rspfx/certs);
// writes cert.pem.trust.txt + logs trust instructions on first generation
```

## @mbsks/rspfx-dev-runtime (depends on core, compiler-rspack, manifest-server, manifest-generator, diagnostics)

```ts
export type ServeMode = 'local' | 'sharepoint';
export interface DevRuntimeOptions {
  projectRoot: string;
  config: RspfxConfig;
  fastRefresh?: boolean;            // --refresh flag
  noBrowser?: boolean;              // inverse of --browser / dev.openBrowser
  port?: number;                    // --port flag
  tenantDomain?: string;            // --tenant, config.dev.tenantUrl, or env var (see [docs/commands.md#rspfx-dev](commands.md#rspfx-dev) and AGENTS.md:47)
  mode?: ServeMode;                 // --mode flag; default 'sharepoint' when a tenant domain is configured, else 'local'
}
export interface DevRuntimeHandle {
  url: string;                      // dev server origin; http:// in local mode, https:// otherwise
  port: number;
  workbenchUrl: string | undefined; // undefined in local mode — there is no workbench URL
  close(): Promise<void>;
}
export async function startServe(opts: DevRuntimeOptions): Promise<DevRuntimeHandle>;
export interface AssembleReleaseOptions {
  projectRoot: string;
  config: RspfxConfig;
  project: ReadProjectResult;
  externals: string[];
  outputFiles: string[];
  production: boolean;
}
export interface ReleaseOutput {
  manifests: ComponentManifest[];
  distDir: string;
  releaseDir: string;
  releaseManifestsDir: string;
  releaseAssetsDir: string;
  outputFiles: string[];
}
export async function assembleRelease(opts: AssembleReleaseOptions): Promise<ReleaseOutput>;
// Generates production component manifests (cdnBasePath from `config/write-manifests.json`) and assembles `release/manifests/*.manifest.json` + `release/assets/*` from `dist/`.
// Shared by `rspfx build` and native bundler commands (`vite build`, `rspack build`, `rsbuild build`); fires `releaseHooks.beforeGenerate` / `afterGenerate` identically.
// `mode 'local'` details: plain HTTP, sp-* externals emptied and bundled, extra `local-runtime` bundle compiled, local preview at `/` and mock `/_api` mounted.
export function resolveServeMode(opts: { mode?: ServeMode; config: RspfxConfig }, tenantDomain: string | undefined): ServeMode;
// explicit --mode wins; otherwise a configured tenant domain selects 'sharepoint', else 'local'
export function resolveServeSettings(opts: { port?: number; tenantDomain?: string; config: RspfxConfig }, serveJson: ProjectServeConfigJson | undefined): ServeSettings;
// port/hostname/https/tenant from CLI overrides → config/serve.json → plugin dev options → defaults (4321, localhost, https, scheme/origin derived)
export function buildWorkbenchUrl(settings: ServeSettings, config: RspfxConfig): string | undefined;
// <tenantUrl>/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=<enc>.../temp/manifests.js
// undefined when no tenant domain is available; honors config.dev.workbench and initialPage ({tenantdomain} token)
export function stripScheme(url: string | undefined): string | undefined;  // strips https?:// prefix and trailing slashes
export interface ServeSettings { port: number; hostname: string; https: boolean; scheme: string; origin: string; tenantDomain: string | undefined; initialPage: string | undefined }
export function readProject(projectRoot: string, paths?: PathsConfig, versionOverride?: string): ReadProjectResult;
// reads package.json/config.json/serve.json, discovers web parts and extensions; the version override
// (plugin `version` option) replaces package.json version in AMD library names and manifests
// discovery: explicit config.json bundles win; otherwise scans src/webparts/* and src/extensions/*
// (each folder needs one *.manifest.json + a pickable entrypoint: index, <name>WebPart,
// <name>ApplicationCustomizer/<name>FieldCustomizer/<name>CommandSet/<name>Extension, or a lone .ts/.tsx)
export function discoverWebParts(projectRoot: string, configJson?: ProjectConfigJson, webpartsDir?: string, packageJson?: { version?: string }, extensionsDir?: string): DiscoveredWebParts; // same scan, exported for tooling; discoverComponents is an alias
export function createReloadController(): ReloadController;
// dev auto-reload: monotonically increasing build counter served at /__rspfx_hot.json
// (no-store + CORS); tick() after each completed rebuild; clientScript is appended to
// /temp/manifests.js and polls the endpoint, calling location.reload() when the counter changes
export function createManifestRegenerator(opts: ManifestRegeneratorOptions): ManifestRegenerator;
// regenerates /temp/manifests.js after each compiler rebuild (project + sp-* debug manifests)
export interface RefreshRuntime {
  dispose(): void;
  preserveState(): void;
  restoreState(): void;
  readonly preserved: boolean;
  readonly disposed: boolean;
  readonly epoch: number;              // completed preserve→restore cycles
}
export function createRefreshRuntime(framework: FrameworkId, options?: {
  onPreserve?: () => void; onRestore?: () => void;
}): RefreshRuntime;
// framework-agnostic state machine; created only when fast refresh is enabled;
// wired into startServe's manifest-regeneration cycle (preserveState before,
// restoreState in finally, dispose on close)
export interface FrameworkPresetModule {
  preset: FrameworkPreset;      // loaded preset (no-op when the framework package is missing)
  moduleUrl: string;            // resolved framework package path ('' when missing)
}
export async function loadFrameworkPreset(framework: FrameworkId, projectRoot?: string): Promise<FrameworkPresetModule>;
// imports @mbsks/rspfx-framework-<fw> index (Node side); warns + returns a no-op preset when absent
export function resolveContributionLoaders(contributions: Record<string, unknown>, frameworkModuleUrl: string): Record<string, unknown>;
// resolves bare loader strings ('vue-loader', 'svelte-loader', 'babel-loader') and babel
// preset/plugin strings ('babel-preset-solid') in rule `use` entries against the framework
// package's own node_modules (createRequire from moduleUrl); unchanged when moduleUrl is ''
```

Local preview internals (module-level exports in `src/`, used by `startServe`
in `mode: 'local'`; not re-exported from the package index):

- `src/local-page.ts` — `buildLocalPageHtml(opts: LocalPageOptions): string`: static HTML served at `/` — injects discovered web part list into `window.__RSPFX_COMPONENTS__`, loads `/dist/local-runtime.js`, appends reload client script. `readLocalPageComponents(bundles, packageVersion): LocalPageComponent[]` derives `{ id, alias, bundleName, amdId, preconfiguredEntries }` from manifests.
- `src/mock-api.ts` — `createMockSharePointApi(opts: { projectRoot: string; origin: () => string })` returns `{ path: '/_api', handle(req, res) }`: mock SharePoint REST API (OData v4 JSON-light, `/_api/web`, `/site`, `/lists`, item CRUD via `X-HTTP-Method`, `POST /contextinfo`, 404/400 envelopes). Store seeded from `createDefaultMockStore()` and optionally overridden by `local/data.json`.

## @mbsks/rspfx-framework-* (depends on core, plugin-api, webpart-base; peer: framework libs)

Each package `@mbsks/rspfx-framework-react|solid|preact|vue|svelte|vanilla` exposes three entry points:

- Index (`@mbsks/rspfx-framework-<fw>`) — Node-safe; exports only the preset, never imports `@mbsks/rspfx-webpart-base`:

```ts
export const preset: FrameworkPreset;       // name = '<framework>'
```

- Subpath (`@mbsks/rspfx-framework-<fw>/headless`) — pure adapter factory, no SPFx dependency:

```ts
import { createReactAdapter } from '@mbsks/rspfx-framework-react/headless';
export function createReactAdapter<TProps>(renderComponent: (props: TProps) => ReactNode): HeadlessAdapter<TProps>;
import { createSolidAdapter } from '@mbsks/rspfx-framework-solid/headless';
export function createSolidAdapter<TProps>(renderComponent: (props: TProps) => JSX.Element): HeadlessAdapter<TProps>;
import { createVanillaAdapter } from '@mbsks/rspfx-framework-vanilla/headless';
export function createVanillaAdapter<TProps>(render: (props: TProps) => HTMLElement | string): HeadlessAdapter<TProps>;
import { createVueAdapter } from '@mbsks/rspfx-framework-vue/headless';
export function createVueAdapter<TProps>(factory: (props: TProps) => Component): HeadlessAdapter<TProps>;
import { createPreactAdapter } from '@mbsks/rspfx-framework-preact/headless';
export function createPreactAdapter<TProps>(renderComponent: (props: TProps) => ComponentChild): HeadlessAdapter<TProps>;
import { createSvelteAdapter } from '@mbsks/rspfx-framework-svelte/headless';
export function createSvelteAdapter<TProps>(factory: (props: TProps) => SvelteWebPartComponent<TProps>): HeadlessAdapter<TProps>;
```

- Subpath (`@mbsks/rspfx-framework-<fw>/webpart`) — thin `HeadlessWebPart` shim (deprecated, kept for one major):

```ts
import { ReactWebPart } from '@mbsks/rspfx-framework-react/webpart';
export abstract class <Cap>WebPart<TProps, TState> extends HeadlessWebPart<TProps> {
  protected abstract renderComponent(props: TProps): unknown;
  protected createAdapter(): HeadlessAdapter<TProps>; // delegates to createXAdapter
}
```

- Svelte's `/headless` also exports `SvelteWebPartComponent<TProps>` — the `{ component, props }` shape.
- `framework-vanilla`: `createVanillaAdapter` `mount` uses `replaceChildren`; no refresh.
- React: `createReactAdapter` caches `Root` in `WeakMap<HTMLElement,Root>`; re-render via `root.render`; fast refresh contributors unchanged.
- Solid: `createSolidAdapter` uses `render(() => comp, root)` with per-adapter `WeakMap<HTMLElement,()=>void>`; refresh unchanged.
- Preact: `createPreactAdapter` uses `render(vnode, root)` / `render(null, root)`.
- Vue: `createVueAdapter` uses `createApp(...).mount` with `WeakMap<HTMLElement,App>`.
- Svelte: `createSvelteAdapter` does `new Component({ target: root, props })` with `WeakMap<HTMLElement,SvelteComponentTyped>`; checks `$destroy` existence for Svelte 4/5 compat.
- Each preset's `contributions` unchanged; `vite()`/`rsbuild()` methods unchanged.

## @mbsks/rspfx-sharepoint-runtime (depends on core; peer @microsoft/sp-*)

Local preview emulation of the SPFx client — used by the `/dist/local-runtime.js`
bootstrap (`rspfx dev` local mode) to instantiate web parts without SharePoint:

```ts
export function createLocalWebPartContext(
  manifest: unknown,
  overrides?: Record<string, unknown>,
  options?: CreateLocalContextOptions
): Promise<WebPartContextLike>;
// Builds a REAL WebPartContext (`new WebPartContext(parameters)`, mirroring
// ClientSideWebPartManager._getWebPartContext) over a parent ServiceScope that
// provides a mock PageContext + a local theme provider under the real service
// keys (PageContext.serviceKey / ThemeProvider.serviceKey). The REAL
// SPHttpClient/HttpClient are kept (they work against the dev server); the
// child-scope MSGraphClientFactory / AadHttpClientFactory / AadTokenProviderFactory
// registrations are replaced with mocks. Environment.type is Local.
// options.services can override spHttpClient/msGraphClientFactory/aadHttpClientFactory/
// pageContext/themeProvider; options.createScope/createContext are test seams.
export function createMockPageContextData(overrides?: Partial<LocalPageContextData>): LocalPageContextData;
export const LOCAL_CURRENT_USER: Record<string, unknown>;
export type { CreateLocalContextOptions, LocalContextServices, LocalPageContextData, ScopeLike };
export { createMockThemeProvider, LOCAL_THEMES } from './theme';      // Fluent-faithful light/dark themes
// LocalThemeProvider: tryGetTheme()/getTheme()/themeChangedEvent (add/remove)/setTheme()/dispose()
export { createMockSPHttpClient, createMockAadHttpClientFactory, createMockMSGraphClientFactory,
         defaultMockTransport, LOCAL_GRAPH_DATA } from './http';     // mocked graph/AAD data clients

// LEGACY — retained for compat, used nowhere at runtime (docs mark these, do not remove):
export const PLAYGROUND_SERVICE_KEY = '__rspfx_playground__';   // self-referenced only by its own test
export function createMockWebPartContext(manifest: unknown, overrides?: Record<string, unknown>): WebPartContextLike;  // pre-emulation flat mock
export function createPlaygroundLoader(mountComponent: (root: HTMLElement) => void, unmountComponent?: (root: HTMLElement) => void): { mount(root: HTMLElement): void; unmount(): void };
```

Subpath `@mbsks/rspfx-sharepoint-runtime/local-bootstrap` — the browser entry
compiled by the dev server as the `local-runtime` bundle: installs global AMD
`define`/`require` hooks on `window`, initializes `Environment` type to `Local`,
reads `window.__RSPFX_COMPONENTS__`, loads each web part bundle by `amdId`, and
per component: `createLocalWebPartContext` → `_internalInitialize(context,
false, DisplayMode.Read)` → `_internalDeserialize({ properties, dataVersion })`
→ await `onInit()` → `render()`.

## @mbsks/rspfx-fluent-adapter (depends on core, framework-react, webpart-base; peer @fluentui/react)

```ts
export class FluentWebPart<TProps, TState> extends HeadlessWebPart<TProps> {
  protected onThemeChanged(): void;   // syncs context.themeProvider → Fluent ThemeProvider
}
export function createFluentAdapter<TProps>(render: (props: TProps, theme: ITheme) => ReactNode, getThemeProvider?: () => ThemeProvider, getTheme?: () => ITheme): HeadlessAdapter<TProps>;
```

## @mbsks/rspfx-templates (depends on core)

```ts
export interface TemplateVars {
  name: string;                       // project or webpart name (kebab-case)
  namePascal: string;                 // PascalCase
  nameCamel: string;
  framework: FrameworkId;
  spfxVersion: SpfxTarget;
  language: 'typescript' | 'javascript';
  tenantUrl?: string;
  componentId: string;                // uuid for webpart manifest
  solutionId: string;                 // uuid for package-solution.json
  featureId: string;                  // uuid
  packageName: string;                // npm name
  packageVersion: string;
}
export function scaffoldProject(vars: TemplateVars, destDir: string): Promise<string[]>; // returns written file paths
```

Generated project layout:
```
package.json  tsconfig.json  rspack.config.ts  .gitignore  .npmrc  README.md
config/package-solution.json  config/serve.json  config/write-manifests.json
sharepoint/assets/.gitkeep
src/index.ts  src/rspfx-env.d.ts
src/webparts/<name>/<name>.manifest.json  <name>WebPart.ts  components/<Pascal>.tsx|ts|vue|svelte  styles/<Pascal>.module.scss|css  assets/.gitkeep
```
(Exact scaffold file contents are the template's design; must match API usage below.)

There is **no `playground/` folder** in the scaffold — the local preview page is
generated by dev-runtime (`local-page.ts`) and served at `/` by `rspfx dev`
(`--mode local`, the default). The scaffolded `<name>WebPart.ts` extends
`BaseClientSideWebPart` from `@microsoft/sp-webpart-base` directly (no
`@mbsks/rspfx-framework-*` web part base).

## @mbsks/rspfx-cli (depends on ALL packages)

Bin `rspfx`. Commands (commander):
- `rspfx new <name>` — interactive prompts (framework, language, spfx target, pm); flags `--framework <id> --language <ts|js> --spfx-version <v> --pm <pnpm|npm|yarn> --no-install --yes` for non-interactive. Then scaffold + install deps.
- `rspfx dev` — startServe; flags `--refresh`, `--browser`, `--port <n>`, `--mode <local|sharepoint>`, `--tenant <url>`
- `rspfx build` — production compile to dist + release (manifests/assets); `--no-minify --sourcemap`
- `rspfx package` — build + package → sppkg; `--no-build`
- `rspfx deploy` — package + upload to app catalog (see [docs/commands.md#rspfx-deploy](commands.md#rspfx-deploy) and AGENTS.md:47 for env vars; URL validated, 120s upload timeout); prints manual steps without a token
- `rspfx analyze` — build + bundle report (sizes, chunk list) to `.rspfx/analyze.html` + console table; module counts from bundler stats (Rspack) or the `.rspfx/stats.json` fallback (Vite/Rsbuild)
- `rspfx doctor` — env/config/ports/deps checks, exit code 1 on failures
- `rspfx clean` — rm dist release temp .rspfx node_modules/.cache
- `rspfx --version`, `rspfx --help`

Config loading: `jiti` import of `rspack.config.ts` (or `vite.config.ts`, or
`rsbuild.config.ts`), find the plugin by `RSPFX_PLUGIN_MARKER`, read `.options`
→ `resolveConfig`. Guidance error when no config or no plugin is found.
Hybrid mode (`apps/cli/src/hybrid.ts`, see
[docs/hybrid-dev.md](hybrid-dev.md)): `detectOfficialProject(projectRoot)`
→ `{ toolchainMarker } | undefined` (requires `config/config.json` + `gulpfile.js`/`heft.json`/`.yo-rc.json`);
`loadOfficialConfig(projectRoot)` → synthesized `RspfxConfig` (name/version from
package.json, `spfxVersion` from the `@microsoft/sp-core-library` dependency,
framework from dependency scan); used by `runDev` on
`CONFIG_NOT_FOUND`. `loadConfigOrRefuseOfficial(projectRoot)` replaces
`loadConfig` in `build/package/deploy/analyze` and throws
`RspfxError('OFFICIAL_TOOLCHAIN_BUILD')` on official projects.
Per-command bundler awareness: for Vite configs, `dev`/`build`/`package` spawn
the project-local `vite`/`vite build` (one build per web part bundle); for
Rsbuild configs a single `rsbuild build` runs and `dev` spawns `rsbuild dev`;
for Rspack configs the internal Rspack pipeline runs as before. On Vite/Rsbuild
projects `dev --refresh` (or `dev.fastRefresh`) sets `RSPFX_FAST_REFRESH=1` on
the spawned process. The local
preview page and mock `/_api` API are served by dev-runtime's `startServe` on
the Rspack path — the Vite/Rsbuild dev flows are workbench-only for now. The
Rsbuild plugin mirrors the Vite dev
features: serves `/temp/manifests.js` + the `/__rspfx_hot.json` reload counter
via `onBeforeStartDevServer` middlewares, regenerates manifests and ticks the
counter on `onAfterDevCompile`, keeps dev unminified (`optimization.minimize:
false`), and opens the workbench when `dev.openBrowser` is set (via
`onAfterStartDevServer`).
Guid generation: `crypto.randomUUID`.
