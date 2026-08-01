# RSPFX Internal API Contract

Single source of truth for package public surfaces. Subagents implement EXACTLY
these signatures — no invented names, no scope creep. Read `reference/FORMATS.md`
for SharePoint formats. ESM only (`"type": "module"`). Strict TS. No comments
unless requested. Zero webpack/heft/gulp dependencies anywhere.

## Shared conventions

- Packages: `@mbsks/rspfx-<name>`, version `0.1.0`, ESM, `main`/`types` → `dist/`.
- All packages build with `tsc` to `dist/`; typecheck: `pnpm -w exec tsc --noEmit -p <pkg>/tsconfig.json`.
- Errors: throw `RspfxError(code, message, cause?)` from `@mbsks/rspfx-diagnostics`.
- Tests: vitest, colocated `tests/*.test.ts`, happy-dom only where DOM needed.

---

## @mbsks/rspfx-core (zero dependencies)

`packages/core/src/index.ts` exports:

```ts
export type FrameworkId = 'vanilla' | 'react' | 'solid' | 'vue' | 'preact' | 'svelte';
export type SpfxTarget = '1.20' | '1.21' | '1.22';

export interface DevConfig {
  port?: number;                 // default 4321 (manifest+bundle server, like official serve)
  https?: boolean;               // default true
  hostname?: string;             // default 'localhost'
  workbench?: boolean;           // default true — auto-open workbench page
  fastRefresh?: boolean;         // default false (rspfx dev --refresh)
  openBrowser?: boolean;         // default true
  tenantUrl?: string;            // e.g. https://contoso.sharepoint.com
  initialPage?: string;          // overrides tenantUrl; supports {tenantdomain} token
}
export interface BuildConfig {
  sourcemap?: boolean;           // default false (prod), true (dev)
  minify?: boolean;              // default true
  splitChunks?: boolean;         // default false (single bundle per web part)
  outDir?: string;               // default 'dist'
  releaseDir?: string;           // default 'release'
}
export interface PlaygroundConfig { port?: number; enabled?: boolean }
export interface DeployConfig {
  tenantUrl?: string; username?: string; password?: string;
  appCatalogSiteUrl?: string;    // e.g. https://contoso.sharepoint.com/sites/appcatalog
}

export interface RspfxConfig {
  name: string;                  // project name (npm name)
  framework: FrameworkId;
  spfxVersion: SpfxTarget;       // default '1.22'
  fluent: boolean;               // default false
  language: 'typescript' | 'javascript';
  styling: 'css' | 'scss' | 'tailwind';
  dev: DevConfig;
  build: BuildConfig;
  playground?: PlaygroundConfig;
  deploy?: DeployConfig;
}
export function defineConfig(config: RspfxConfig): RspfxConfig;
export function resolveConfig(config: Partial<RspfxConfig>): RspfxConfig; // fills defaults

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
export interface WebPartContextLike {   // minimal surface used by adapters/templates
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

// Base web part (extends real @microsoft/sp-webpart-base BaseClientSideWebPart when available)
export abstract class BaseWebPart<TProps extends Record<string, unknown> = Record<string, unknown>> {
  // Provided by @microsoft/sp-webpart-base at runtime; declared here as dependency contract
  protected abstract get frameworkAdapter(): import('@mbsks/rspfx-plugin-api').FrameworkAdapter | null;
  protected abstract createComponent(): unknown;            // framework root component instance
  protected abstract getComponentProps(): TProps;           // props derived from this.properties
  public render(): void;                                    // mount via adapter into this.domElement
  protected onDispose(): void;                              // unmount via adapter
}
```

## @mbsks/rspfx-plugin-api (depends on core only)

```ts
export interface FrameworkAdapter {
  name: string;
  mount(root: HTMLElement, component: unknown): void;
  unmount(root: HTMLElement): void;
  update(root: HTMLElement): void;
  supportsFastRefresh(): boolean;
}
export interface FrameworkRspackContributions {   // structural; typed loosely to stay compiler-agnostic
  rules?: unknown[];        // rspack RuleSetRule[]
  plugins?: unknown[];      // rspack plugin instances
  resolve?: { alias?: Record<string, string>; extensions?: string[] };
  swc?: { jsc?: { parser?: unknown; transform?: unknown } };   // for builtin:swc-loader options
  define?: Record<string, string>;
  moduleTest?: { test?: RegExp; type?: string };  // e.g. { type: 'asset' } for css
}
export interface FrameworkPreset {
  name: import('@mbsks/rspfx-core').FrameworkId;
  adapter(): FrameworkAdapter;
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions;
}
export interface CompilerHooks {
  beforeCompile?(config: unknown): unknown;       // mutate rspack config object, return it
  afterStats?(stats: unknown): void;
}
export interface PackageHooks {
  beforePackage?(ctx: { manifests: unknown[]; files: { path: string; content: Uint8Array }[] }): void;
}
export interface RspfxPlugin {
  name: string;
  frameworkPreset?: FrameworkPreset;
  compilerHooks?: CompilerHooks;
  packageHooks?: PackageHooks;
}
export function definePlugin(plugin: RspfxPlugin): RspfxPlugin;
export function registerPlugin(plugin: RspfxPlugin): void;      // global registry (CLI wires)
export function getPlugins(): RspfxPlugin[];
```

## @mbsks/rspfx-diagnostics (depends on core only)

```ts
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'success';
export class RspfxError extends Error { constructor(code: string, message: string, cause?: unknown) }
export interface Logger { error(m: string): void; warn(m: string): void; info(m: string): void; debug(m: string): void; success(m: string): void; }
export function createLogger(name: string): Logger;
export async function trace<T>(name: string, fn: () => Promise<T>): Promise<T>; // logs duration
export function timeStart(name: string): () => number;      // returns elapsed ms fn
export function reportBenchmark(name: string, ms: number): void;  // appends .rspfx/benchmarks.jsonl
export function formatBytes(bytes: number): string;
```

## @mbsks/rspfx-compiler-rspack (depends on plugin-api, diagnostics)

```ts
export interface BundleEntry {
  name: string;                       // bundleName = webpart folder name (entryModuleId)
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

Notes for implementer:
- Use `builtin:swc-loader` for .ts/.tsx/.jsx/.js (parser jsx, decorators, importMeta); merge framework swc contributions.
- SCSS: `sass-loader` + `sass`; CSS modules via `experiments.css` + `.module.*` convention; Tailwind: postcss-loader with `@tailwindcss/postcss`.
- Output: filename `[name].js` (always — manifest references exact name), chunkFilename `chunk.[name].js`,
  `output.library: { type: 'amd', name: '<componentId>_<version>' }` (single component per bundle — M1 default),
  `externals: string[]`, `chunkLoadingGlobal: webpackJsonp_<uniqueName>` where uniqueName = single id_version or md5 hex of concatenated ids,
  `crossOriginLoading: 'anonymous'`, `publicPath: 'auto'`, `devtool: production ? (sourcemap?'hidden-source-map':false) : 'source-map'` (rspack value 'hidden-source-map' supported).
- DefinePlugin: DEBUG, DEPRECATED_UNIT_TEST, process.env.NODE_ENV.
- CSS inlined into JS bundle (SPFx has no external css in sppkg). Implement a tiny inline-css loader (or style-loader equivalent) — do NOT use css-extract.
- optimization: moduleIds 'deterministic', usedExports, sideEffects, removeEmptyChunks.
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
}
export async function generateComponentManifests(ctx: ManifestContext): Promise<ComponentManifest[]>; // reads src/webparts/*/*.manifest.json
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
  teamsDir?: string;               // optional teams icons folder
}
export async function buildPackage(opts: BuildPackageOptions): Promise<{ outputPath: string; zipEntries: string[]; appManifest: string }>;
// Zip via yazl or jszip (DEFLATE level 9). Full layout: reference/FORMATS.md §4. Must include:
// [Content_Types].xml, _rels/.rels, AppManifest.xml (+.rels), feature_<id>.xml (+.config.xml, +.rels),
// <featureId>/<ComponentType>_<componentId>.xml, ClientSideAssets feature + files (when includeClientSideAssets && production),
// rewrite manifest base urls to ['HTTPS://SPCLIENTSIDEASSETLIBRARY/'] when includeClientSideAssets.
export function validateSppkg(zipPath: string): Promise<{ ok: boolean; errors: string[] }>; // unzip + schema checks
```

## @mbsks/rspfx-manifest-server (depends on core, diagnostics)

```ts
export interface ManifestServerOptions {
  port: number; hostname: string; https: boolean;
  projectRoot: string;
  certsDir: string;                 // default ~/.rspfx/certs
  manifestsJs: () => Promise<string>;       // dynamic — regenerated after each build
  extraStatic?: { path: string; urlPrefix: string }[];  // e.g. dist folders
}
export async function startManifestServer(opts: ManifestServerOptions): Promise<{ port: number; url: string; close(): Promise<void>; }>;
export async function ensureCertificates(certsDir: string): Promise<{ key: string; cert: string }>; // selfsigned; cache; print trust instructions once
```

Routes (http/https, CORS `*` + `Access-Control-Allow-Private-Network: true`):
- `GET /temp/manifests.js` → manifestsJs()
- `GET /node_modules/*` → file from projectRoot/node_modules/* (for sp-* debug bundles)
- `GET /dist/*` → projectRoot/dist/* (writeToDisk) — optional if dev server serves it
- everything else → 404 JSON

## @mbsks/rspfx-dev-runtime (depends on core, compiler-rspack, manifest-server, manifest-generator, diagnostics)

```ts
export interface DevRuntimeOptions {
  projectRoot: string;
  config: RspfxConfig;
  tenantDomain?: string;            // from env SPFX_SERVE_TENANT_DOMAIN or config.dev.tenantUrl
  fastRefresh?: boolean;            // --refresh flag
  noBrowser?: boolean;
}
export async function startServe(opts: DevRuntimeOptions): Promise<{ url: string; close(): Promise<void> }>;
// Flow: load config → find webpart manifests+entries → create rspack config (serveMode) →
// start dev server (hot:true, CORS, static root) → generate cumulative manifests.js (project + sp-* debug) →
// open browser → workbench URL: <tenantUrl>/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=<server>/temp/manifests.js
// On each compiler rebuild: regenerate manifests.js (dist files may change names; official keeps [name].js so stable).
export async function startPlayground(opts: DevRuntimeOptions): Promise<{ url: string; close(): Promise<void> }>;
// Standalone: dev server on config.playground.port (default 3000) + generated playground page (see templates)
export interface RefreshRuntime { dispose(): void; preserveState(): void; restoreState(): void; }
export function createRefreshRuntime(framework: FrameworkId): RefreshRuntime; // no-op for vanilla
```

## @mbsks/rspfx-framework-* (depends on core, plugin-api; peer: framework libs)

Each package `@mbsks/rspfx-framework-react|solid|preact|vue|svelte|vanilla` exports:

```ts
export const preset: FrameworkPreset;       // name = '<framework>'
export const adapter: FrameworkAdapter;      // singleton
export class <Cap>WebPart<TProps, TState> extends BaseWebPart<TProps> { ... } // e.g. ReactWebPart
```

- `framework-vanilla`: mount = append component (HTMLElement|string), no refresh.
- React: react ^18, react-dom ^18 (peers); mount via `createRoot(root).render(component)`; update re-renders with new props (render again); fast refresh: `@rspack/plugin-react-refresh` contribution when fastRefresh.
- Solid: `render(() => component, root)` from solid-js/web; refresh: babel-loader + babel-preset-solid (+ solid-refresh in dev).
- Preact: `render(component, root)` from preact; refresh: `@rspack/plugin-preact-refresh`.
- Vue: `createApp(component).mount(root)`; refresh: vue-loader HMR (peer @vue/compiler-sfc; contribution: vue-loader rule).
- Svelte: `new Component({ target: root, props })`; refresh: svelte-loader `hotReload` (svelte-hmr).
- Each preset's `contributions` must return compiler rules/plugins/swc for JSX/refresh — compilers merge them.

## @mbsks/rspfx-sharepoint-runtime (depends on core; peer @microsoft/sp-*)

```ts
export function createMockWebPartContext(manifest: unknown, overrides?: Record<string, unknown>): WebPartContextLike;
export function createPlaygroundLoader(webpartModule: unknown): { mount(root: HTMLElement): void; unmount(): void };
export const PLAYGROUND_SERVICE_KEY = '__rspfx_playground__';
```

## @mbsks/rspfx-fluent-adapter (depends on core, framework-react; peer @fluentui/react)

```ts
export class FluentWebPart<TProps, TState> extends ReactWebPart<TProps, TState> {
  protected onThemeChanged(): void;   // syncs context.themeProvider → Fluent ThemeProvider
}
```

## @mbsks/rspfx-templates (depends on core)

```ts
export interface TemplateVars {
  name: string;                       // project or webpart name (kebab-case)
  namePascal: string;                 // PascalCase
  nameCamel: string;
  framework: FrameworkId;
  spfxVersion: SpfxTarget;
  fluent: boolean;
  language: 'typescript' | 'javascript';
  styling: 'css' | 'scss' | 'tailwind';
  tenantUrl?: string;
  componentId: string;                // uuid for webpart manifest
  solutionId: string;                 // uuid for package-solution.json
  featureId: string;                  // uuid
  packageName: string;                // npm name
  packageVersion: string;
}
export function scaffoldProject(vars: TemplateVars, destDir: string): Promise<string[]>; // returns written file paths
export function scaffoldPlaygroundPage(projectRoot: string, vars: TemplateVars): Promise<string[]>;
```

Generated project layout:
```
package.json  tsconfig.json  rspfx.config.ts  .gitignore  README.md
config/package-solution.json  config/serve.json  config/write-manifests.json
sharepoint/assets/.gitkeep
src/index.ts
src/webparts/<name>/<name>.manifest.json  <name>WebPart.ts  components/<Pascal>.tsx|ts|vue|svelte  styles/<Pascal>.module.scss|css  assets/.gitkeep
playground/index.html  playground/main.ts
```
(Exact scaffold file contents are the template's design; must match API usage below.)

## @mbsks/rspfx-cli (depends on ALL packages)

Bin `rspfx`. Commands (commander):
- `rspfx new <name>` — interactive prompts (framework, language, styling, fluent, spfx target, pm); flags `--framework <id> --language <ts|js> --styling <css|scss|tailwind> --fluent --spfx-version <v> --pm <pnpm|npm|yarn> --no-install --yes` for non-interactive. Then scaffold + install deps.
- `rspfx dev` — startServe; flags `--refresh`, `--no-browser`, `--port <n>`, `--tenant <url>`
- `rspfx playground` — startPlayground; `--port <n>`
- `rspfx build` — production compile to dist + release (manifests/assets); `--no-minify --sourcemap`
- `rspfx package` — build + package → sppkg; `--no-build`
- `rspfx deploy` — package + upload to app catalog (REST, creds from config.deploy or env RSPFX_TENANT/RSPFX_USERNAME/RSPFX_PASSWORD); prints manual steps if no creds
- `rspfx analyze` — build + bundle report (sizes, chunk list) to `.rspfx/analyze.html` + console table
- `rspfx doctor` — env/config/ports/deps checks, exit code 1 on failures
- `rspfx clean` — rm dist release temp .rspfx node_modules/.cache
- `rspfx --version`, `rspfx --help`

Config loading: `jiti` import of `rspfx.config.ts` (or `.js`); then `defineConfig`/`resolveConfig`.
Guid generation: `crypto.randomUUID`.
