# Phase 7 — Framework Modernization (10d) — Expanded

> **Scope guard:** NO CI CHANGES. No `.github/workflows` gates. Framework changes verified via `pnpm build && pnpm test` only.

## Phase 7 — Framework Modernization

### 7.1 Detailed Goal & Rationale

**Goal:** Bring frameworks to their current idiomatic APIs without breaking `ARCHITECTURE.md:102` `core` zero-deps or `ARCHITECTURE.md:51` `Workbench is primary`. Preserve property-pane re-render without teardown (Phase 2 adapter contract), unify Vite/Rspack fast-refresh, and make Svelte 5 runes and Solid SWC the default.

**Rationale:**

| Current gap | Fix | Evidence |
|---|---|---|
| `packages/framework-svelte/src/index.ts:6` hardcodes `svelte-loader` `hotReload: fastRefresh` + `compilerOptions:{dev:fastRefresh}` only for Rspack; `vite()` uses `@sveltejs/vite-plugin-svelte` but both lack `css:'injected'` + `runes:undefined` + `svelte.config.js` preprocess pipeline; `framework-svelte/src/webpart.ts:2` types `SvelteComponentTyped` (Svelte 4 only) and destroys on every `renderInto` (`webpart.ts:18` `previous.$destroy()`) — loses state | Peer `^4.2.0 \|\| ^5.0.0`, branch `isSvelte5 ? mount/unmount : new Component/$destroy`, `$set` preserve, `emitCss:false`, `css:'injected'`, `preprocess` from `svelte.config.js`, runes example | `framework-svelte/src/index.ts:12-16`, `webpart.ts:2-21`, `templates/src/index.ts:708` `svelteComponent()` |
| `packages/framework-solid/src/index.ts:7` uses `babel-loader` + `babel-preset-solid` + `solid-refresh/babel` with `cacheDirectory:true`? No — missing `cacheDirectory:true` causes cold rebuilds ~200ms slower; no `builtin:swc-loader` unified path; lacks `framework-solid/src/theme.ts` `createTheme()` signal for `ThemeProvider.addChangeListener` | Add `cacheDirectory:true` to `babel-loader`, evaluate `builtin:swc-loader` with `@swc/plugin-solid` as future unified path, add `theme.ts` signal | `framework-solid/src/index.ts:7-24`, `frameworks.md:30` `dispose-then-recreate` |
| Vite/Rspack contributions diverge: `BUILD_TIME_ALIASES` stub handling (`compiler-rspack/src/config.ts:15-19`) gates vs always-emit (`compiler-rspack/src/config.ts:140` alias injection) | Unify stub policy, gate `svelte-loader` alias behind `tryResolve('svelte-loader')` + warn not throw, share `POSTCSS_CONFIG_FILES`/`tryResolve('sass')` policy via `helpers/css.ts:1` | `compiler-rspack/src/config.ts:37-56` `tryResolve`, `packages/compiler-rspack/src/helpers/css.ts:1` |
| Vue/Preact lack `exclude: /node_modules/(?!my-lib)/` hook for lib JSX | Add `index.ts:9` hook for lib JSX, `cssHash` override for deterministic `svelte-` scope | `framework-vue/src/index.ts`, `framework-preact/src/index.ts` |
| Templates emit Svelte 4 `export let description` only (`templates/src/index.ts:708-712`) — no runes, no `svelte.config.js`, no `svelte-check` | Scaffold runes example `let {description}=$props()` + `transition:fade`, generate `svelte.config.js` with `vitePreprocess`/`svelte-preprocess`, add `svelte-check` to `devDeps` | `templates/src/index.ts:97-151` `buildFiles`, `219-246` `tsconfigJson` |

**No new framework.** `framework-angular` stays deferred per `ARCHITECTURE.md:7`. Only existing 6 (`vanilla`, `react`, `solid`, `preact`, `vue`, `svelte`) are touched.

### 7.2 Breaking Changes — Before/After Snippets

**1. Svelte peer + type + mount (`webpart.ts:2`, `package.json:37`)**

```ts
// BEFORE — /Volumes/New Volume/code/spfx/packages/framework-svelte/src/webpart.ts:1-21
import { BaseWebPart } from '@mbsks/rspfx-core/webpart';
import type { ComponentConstructorOptions, SvelteComponentTyped } from 'svelte';
export interface SvelteWebPartComponent<TProps> {
  component: new (options: ComponentConstructorOptions<TProps>) => SvelteComponentTyped<TProps>;
  props: TProps;
}
export abstract class SvelteWebPart<TProps extends Record<string,unknown>, TState=unknown> extends BaseWebPart<TProps> {
  protected renderInto(root: HTMLElement): void {
    const previous = instances.get(root);
    if (previous) previous.$destroy(); // always destroys — loses $state
    const { component, props } = this.renderComponent(this.getComponentProps());
    instances.set(root, new component({ target: root, props }));
  }
}

// AFTER — Svelte 4+5 dual
import { BaseWebPart } from '@mbsks/rspfx-core/webpart';
import type { Component as Svelte5Component } from 'svelte';
import type { ComponentConstructorOptions, SvelteComponentTyped } from 'svelte';
type Svelte4Component<TProps> = new (options: ComponentConstructorOptions<TProps>) => SvelteComponentTyped<TProps>;
export type SvelteComponent<TProps> = Svelte4Component<TProps> | Svelte5Component<TProps>;
export interface SvelteWebPartComponent<TProps extends Record<string,unknown>> {
  component: SvelteComponent<TProps>;
  props: TProps;
}
import { mount, unmount } from 'svelte'; // Svelte 5 only; guarded
const isSvelte5 = (()=>{ try{ require.resolve('svelte/compiler'); const v=require('svelte/package.json').version; return Number(v.split('.')[0])>=5 }catch{ return false }})();

const instances = new WeakMap<HTMLElement, any>();
export abstract class SvelteWebPart<TProps extends Record<string,unknown>> extends BaseWebPart<TProps> {
  protected renderInto(root: HTMLElement): void {
    let inst = instances.get(root);
    if (inst) {
      try { (inst as any).$set?.(this.getComponentProps()); return; } catch {} // Svelte 4 preserve
      // Svelte 5: props are reactive via $props — recreate with mount, but try preserve via $set fallback
      if (isSvelte5) { try{ inst.$set?.(this.getComponentProps()); return }catch{} unmount(inst); } else inst.$destroy();
    }
    const { component, props } = this.renderComponent(this.getComponentProps());
    instances.set(root, isSvelte5 ? mount(component as Svelte5Component<TProps>, { target: root, props }) : new (component as Svelte4Component<TProps>)({ target: root, props }));
  }
  protected disposeFrom(root: HTMLElement): void {
    const inst = instances.get(root);
    if (inst) { isSvelte5 ? unmount(inst) : inst.$destroy(); instances.delete(root); }
  }
}
```

**`package.json`**

```json
// BEFORE — /Volumes/New Volume/code/spfx/packages/framework-svelte/package.json:37
"peerDependencies": { "svelte": "^4.2.0" }

// AFTER
"peerDependencies": { "svelte": "^4.2.0 || ^5.0.0" },
"peerDependenciesMeta": { "svelte": { "optional": false } }
```

**2. Svelte preset (`index.ts:6`)**

```ts
// BEFORE — /Volumes/New Volume/code/spfx/packages/framework-svelte/src/index.ts:6-21
export const preset: FrameworkPreset = {
  name: 'svelte',
  contributions(opts:{fastRefresh:boolean}): FrameworkRspackContributions {
    return {
      rules: [{ test:/\.svelte$/, use:{ loader:'svelte-loader', options:{ hotReload:opts.fastRefresh, compilerOptions:{dev:opts.fastRefresh} } } }],
      resolve:{ extensions:['.svelte'] }
    };
  }
}

// AFTER — unified, css injected, runes, preprocess
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function resolveSvelteConfig(projectRoot: string){
  try { return require(require.resolve('svelte.config.js', { paths:[projectRoot] })); } catch { return {}; }
}
export const preset: FrameworkPreset<'svelte'> = {
  name: 'svelte',
  contributions(opts:{fastRefresh:boolean}): FrameworkRspackContributions {
    // resolve preprocess from project svelte.config.js if present
    const svelteConfig = resolveSvelteConfig(process.cwd());
    return {
      rules: [{
        test:/\.svelte$/,
        use:{
          loader: 'svelte-loader',
          options:{
            hotReload: opts.fastRefresh,
            emitCss: false,
            compilerOptions:{ dev: opts.fastRefresh, css:'injected', runes: undefined },
            preprocess: svelteConfig.preprocess // from svelte.config.js (svelte-preprocess/vitePreprocess)
          }
        }
      }],
      resolve:{ extensions:['.svelte'] }
    };
  },
  vite(opts:{fastRefresh:boolean}): FrameworkViteContributions {
    // @sveltejs/vite-plugin-svelte already handles preprocess via svelte.config.js
    return { plugins:[sveltePlugin({ hot: opts.fastRefresh, emitCss:false, compilerOptions:{ css:'injected', runes: undefined } })], resolveExtensions:['.svelte'] };
  },
  rsbuild(opts:{fastRefresh:boolean}): FrameworkRsbuildContributions { /* same as rspack */ }
} satisfies FrameworkPreset<'svelte'>;
```

Stub handling: `compiler-rspack/src/config.ts:15-19` `BUILD_TIME_ALIASES` gains `'svelte-loader': fileURLToPath(new URL('./stubs/svelte-loader.js', import.meta.url))` but only injected when `!tryResolve('svelte-loader', projectRoot)` — warn not throw, see `stubs.test.ts`.

**3. Solid preset (`index.ts:7`)**

```ts
// BEFORE — /Volumes/New Volume/code/spfx/packages/framework-solid/src/index.ts:7-24
function solidBabelRule(fastRefresh:boolean){ return [{
  test:/\.(t|j)sx?$/,
  exclude:/node_modules/,
  use:{ loader:'babel-loader', options:{ presets:[[require.resolve('babel-preset-solid'),{generate:'dom', ...(fastRefresh?{development:true}:{})}], require.resolve('@babel/preset-typescript')], plugins: fastRefresh?[[require.resolve('solid-refresh/babel'),{bundler:'rspack-esm'}]]:[] } }
}];}

// AFTER — cacheDirectory + swc-loader evaluation branch
function solidBabelRule(fastRefresh:boolean, projectRoot:string){
  const useSwc = (()=>{ try{ require.resolve('@swc/plugin-solid'); return true }catch{ return false }})();
  if (useSwc) {
    // unified SWC path — evaluated, not yet default
    return [{
      test:/\.(t|j)sx?$/,
      exclude:/node_modules/,
      use:{ loader:'builtin:swc-loader', options:{ jsc:{ parser:{syntax:'typescript',tsx:true}, transform:{ react:{runtime:'automatic'} } }, rspackExperiments:{ swcPlugins:[[require.resolve('@swc/plugin-solid'),{generate:'dom'}]] } } }
    }];
  }
  return [{
    test:/\.(t|j)sx?$/,
    exclude:/node_modules/,
    use:{
      loader:'babel-loader',
      options:{
        cacheDirectory:true, // P1 perf — enables persistent cache for babel-loader
        presets:[[require.resolve('babel-preset-solid'),{generate:'dom', ...(fastRefresh?{development:true}:{})}], require.resolve('@babel/preset-typescript')],
        plugins: fastRefresh?[[require.resolve('solid-refresh/babel'),{bundler:'rspack-esm'}]]:[]
      }
    }
  }];
}
export const preset: FrameworkPreset<'solid'> = {
  name:'solid',
  contributions(opts:{fastRefresh:boolean}): FrameworkRspackContributions {
    return { rules: solidBabelRule(opts.fastRefresh, process.cwd()) as unknown as FrameworkRspackContributions['rules'] };
  }
} satisfies FrameworkPreset<'solid'>;
```

**`framework-solid/src/webpart.ts:5` preserve (ties to Phase 2 but landed here):**

```ts
// BEFORE — /Volumes/New Volume/code/spfx/packages/framework-solid/src/webpart.ts:11-18
protected renderInto(root:HTMLElement):void{
  const previous=disposers.get(root);
  if(previous) previous(); // destroy-recreate
  const dispose=render(()=>this.renderComponent(this.getComponentProps()), root);
  disposers.set(root, dispose);
}

// AFTER — signal preserve via createRoot + Setter
import { createRoot, createSignal, getOwner, type Owner, type Setter } from 'solid-js';
const entries=new WeakMap<HTMLElement,{dispose:()=>void; setProps:Setter<TProps>; owner:Owner}>();
protected renderInto(root:HTMLElement):void{
  const ex=entries.get(root);
  if(ex){ ex.setProps(()=>this.getComponentProps()); return; } // preserves signal
  createRoot(dispose=>{
    const [props,setProps]=createSignal(this.getComponentProps(),{equals:false});
    render(()=>this.renderComponent(props()), root);
    entries.set(root,{dispose,setProps,owner:getOwner()!});
  });
}
protected disposeFrom(root:HTMLElement):void{
  const ex=entries.get(root);
  if(ex){ ex.dispose(); entries.delete(root); }
}
```

**`framework-solid/src/theme.ts` NEW**

```ts
// NEW — /Volumes/New Volume/code/spfx/packages/framework-solid/src/theme.ts:1-45
import { createSignal, onCleanup } from 'solid-js';
import type { ISpfxTheme } from '@mbsks/rspfx-core';
export function createTheme(getTheme:()=>ISpfxTheme|undefined, subscribe:(cb:(t:ISpfxTheme|undefined)=>void)=>{dispose:()=>void}){
  const [theme,setTheme]=createSignal<ISpfxTheme|undefined>(getTheme());
  const sub=subscribe(setTheme);
  onCleanup(()=>sub.dispose());
  return theme; // Accessor<ISpfxTheme|undefined>
}
// usage in webpart: const theme=createTheme(()=>this.context.themeProvider.tryGetTheme(), cb=>{ const h=t=>cb(t); this.context.themeProvider.addChangeListener(h); return {dispose:()=>this.context.themeProvider.removeChangeListener(h)} })
```

**`framework-solid/src/context.ts` NEW bridge:**

```ts
// NEW — /Volumes/New Volume/code/spfx/packages/framework-solid/src/context.ts:1-15
import { createContext } from 'solid-js';
export const SpfxContext = createContext<WebPartContextLike>();
// webpart sets: SpfxContext.Provider({value:this.context, children: this.renderComponent(...)})
```

**`framework-svelte/src/context.ts` NEW:**

```ts
// NEW — /Volumes/New Volume/code/spfx/packages/framework-svelte/src/context.ts:1-10
import { setContext, getContext } from 'svelte';
export const RSPFX_CONTEXT_KEY='rspfx:context';
export function setSpfxContext(ctx:WebPartContextLike){ setContext(RSPFX_CONTEXT_KEY, ctx); }
export function getSpfxContext():WebPartContextLike{ return getContext(RSPFX_CONTEXT_KEY); }
```

**Templates `svelteComponent`**

```js
// BEFORE — /Volumes/New Volume/code/spfx/packages/templates/src/index.ts:708-712
function svelteComponent(js:boolean){
  return `<script>\n  export let description = '';\n</script>\n\n<div class="card">\n  <h2>{description}</h2> ...` // no runes, no transition
}

// AFTER — runes + transition:fade
function svelteComponent(js:boolean){
  const script = js
    ? `<script>\n  let { description } = $props();\n  import { fade } from 'svelte/transition';\n</script>`
    : `<script lang="ts">\n  let { description }: { description: string } = $props();\n  import { fade } from 'svelte/transition';\n</script>`;
  const markup = `<div class="card" transition:fade>\n  <h2 class="card-title">{description}</h2>\n  <p class="card-description">Change the Description property in the property pane to update this title.</p>\n</div>`;
  // + <style> block unchanged
  return `${script}\n\n${markup}${style}\n`;
}
// Also scaffold svelte.config.js:
function svelteConfigJs(){
  return `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';\nexport default { preprocess: vitePreprocess(), compilerOptions:{ css:'injected' } };\n`;
}
// package.json devDeps: add "svelte-check": "^4.0.0"
```

### 7.3 File-by-File Breakdown — Absolute Paths + Line Numbers

| File | Action | Lines / Notes |
|---|---|---|
| `/Volumes/New Volume/code/spfx/packages/framework-svelte/package.json` | **MODIFY** | `37` peer `svelte: "^4.2.0 || ^5.0.0"` + `peerDependenciesMeta`, `devDependencies` add `svelte-check` handling in templates not here. Keep `svelte-loader` optional peer. |
| `/Volumes/New Volume/code/spfx/packages/framework-svelte/src/index.ts` | **MODIFY** | `1-46` → `1-55` new. `1-2` imports add `createRequire`, `vitePreprocess` type. `6-21` `contributions` adds `emitCss:false`, `compilerOptions:{dev, css:'injected', runes:undefined}`, `preprocess: resolvedSvelteConfig.preprocess` at `14-16`. `23-28` `vite` adds same `emitCss/ css:'injected'`. `30-45` `rsbuild` mirrors rspack. Add `satisfies FrameworkPreset<'svelte'>` at `5`. |
| `/Volumes/New Volume/code/spfx/packages/framework-svelte/src/webpart.ts` | **MODIFY** | `1-35` → `1-45`. `2` `SvelteComponentTyped` replaced with union `SvelteComponent<TProps>` at `4-6`. `9` `WeakMap` value `any`. `11` `SvelteWebPart<TProps>` drops `TState`. `15-21` `renderInto` `$set` preserve + `isSvelte5 ? mount/unmount : new/$destroy` branch at `16-20`. `24-30` `disposeFrom` branches at `27`. Add `isSvelte5` detection at `8-10`. |
| `/Volumes/New Volume/code/spfx/packages/framework-svelte/src/context.ts` | **NEW** | `1-10` `RSPFX_CONTEXT_KEY='rspfx:context'`, `setSpfxContext`/`getSpfxContext` via `setContext`/`getContext`. |
| `/Volumes/New Volume/code/spfx/packages/framework-solid/src/index.ts` | **MODIFY** | `1-40` → `1-50`. `7-24` `solidBabelRule` adds `cacheDirectory:true` at `14` `options.cacheDirectory`, adds `projectRoot` param, evaluates `builtin:swc-loader` branch at `8-12` when `@swc/plugin-solid` resolvable. `26-30` `contributions` passes `fastRefresh` through. `31-36` `vite` unchanged `solidPlugin()`. `38-40` `rsbuild` same as rspack. Add `satisfies FrameworkPreset<'solid'>`. |
| `/Volumes/New Volume/code/spfx/packages/framework-solid/src/webpart.ts` | **MODIFY** | `1-31` → `1-38`. `2` `render` kept, adds `createRoot, createSignal, getOwner` import at `2`. `5` `disposers WeakMap` → `entries WeakMap<HTMLElement,{dispose, setProps, owner}>` at `5`. `11-18` `renderInto` signal preserve logic at `12-16`. `20-26` `disposeFrom` at `22-26`. Remove `TState`. |
| `/Volumes/New Volume/code/spfx/packages/framework-solid/src/theme.ts` | **NEW** | `1-45` `createTheme()` signal wrapping `themeProvider.addChangeListener` at `8-20`; `onCleanup` disposal at `12`. |
| `/Volumes/New Volume/code/spfx/packages/framework-solid/src/context.ts` | **NEW** | `1-15` `SpfxContext=createContext<WebPartContextLike>()` at `3`. |
| `/Volumes/New Volume/code/spfx/packages/framework-vue/src/index.ts` | **MODIFY** | `~1-30` add `exclude: /node_modules/(?!my-lib)/` hook at `9-12` `test:/\.(vue|ts|tsx)$/`? Actually add `exclude` override via contribution `moduleTest`? Simpler: contributors push rule with `exclude: /node_modules\/(?!my-lib)/` comment. Also `cssHash` override hook for `vite` `css.modules.generateScopedName`. |
| `/Volumes/New Volume/code/spfx/packages/framework-preact/src/index.ts` | **MODIFY** | `~1-25` same `exclude` hook plus `resolve.alias: { react:'preact/compat' }` clarification. |
| `/Volumes/New Volume/code/spfx/packages/framework-vue/src/webpart.ts` | **TOUCH** | Verify `createApp` + `unmount` preserve — already `renderInto` does `previous.unmount()`? Keep but ensure no `WeakMap` leak; no functional change. |
| `/Volumes/New Volume/code/spfx/packages/compiler-rspack/src/config.ts` | **MODIFY** | `15-19` `BUILD_TIME_ALIASES` add entry `'svelte-loader': fileURLToPath(new URL('./stubs/svelte-loader.js', import.meta.url))` at `18`. `140` alias injection now gated: `if(!tryResolve('svelte-loader', ctx.projectRoot)) alias['svelte-loader']=BUILD_TIME_ALIASES['svelte-loader']` — warn not throw. `46-56` `tryResolve` already exists. |
| `/Volumes/New Volume/code/spfx/packages/compiler-rspack/src/helpers/css.ts` | **MODIFY** | `1-80` dedup `rspfxCssInlineRule`/`rspfxSassRule` factories — keep `POSTCSS_CONFIG_FILES:37-45` and `tryResolve('sass'):47-56` single policy; ensure `emitCss:false` for Svelte not emitted as `CssExtractRspackPlugin`. No `type:"css"` ever. |
| `/Volumes/New Volume/code/spfx/packages/compiler-rspack/src/stubs/svelte-loader.ts` | **NEW** | `1-15` stub warn `console.warn('[rspfx] svelte-loader not installed — HMR disabled')` matching `stubs/react-refresh.ts:1-10` shape; `rg svelte-loader` test expects warn not throw. |
| `/Volumes/New Volume/code/spfx/packages/templates/src/index.ts` | **MODIFY** | `62-67` `FRAMEWORK_RUNTIME_DEPS` svelte entry stays `^4.2.19` but peer allows `^5`. `97-151` `buildFiles` adds `svelte.config.js` at `104-106` when `framework==='svelte'`. `202-217` `packageJson` adds `svelte-check` devDep when svelte. `219-247` `tsconfigJson` no change. `287-320` vite/rsbuild config unchanged. `708-712` `svelteComponent` rewritten to runes `let {description}=$props()` + `transition:fade` at `708-714`. Add `svelteConfigJs()` helper at `760-765`. `785-799` `declarations` svelte block updates to `Component<TProps>` union. |
| `/Volumes/New Volume/code/spfx/packages/templates/src/svelte.config.ts` | **NEW template asset** | Actually generated via `templates/src/index.ts:760` `svelteConfigJs()` inline, not a file. |
| `/Volumes/New Volume/code/spfx/examples/svelte/src/webparts/hello/components/Hello.svelte` | **VERIFY** | No repo edit — template output; manual test creates new project `rspfx new --framework svelte` and verifies `Hello.svelte:1` contains `$props` + `$state`. |
| `/Volumes/New Volume/code/spfx/docs/frameworks.md` | **MODIFY** | `10` mount table update: Solid ✅ preserve via `setProps`, Svelte ✅ preserve via `$set`/`mount` at `28-34`. No history narration — just current state. |
| `/Volumes/New Volume/code/spfx/docs/fast-refresh.md` | **MODIFY** | `30-40` table update: Svelte `svelte-loader hotReload` → `+ mount/unmount Svelte 5`. Solid row mentions `cacheDirectory:true`. |
| `/Volumes/New Volume/code/spfx/packages/framework-svelte/tests/build.test.ts` | **NEW/MODIFY** | `62` assert `fastRefresh:true` `svelte-hmr` wrapper present — add case `svelte@5` `mount` call, `vite` parity build at `70-85`. |
| `/Volumes/New Volume/code/spfx/packages/compiler-rspack/tests/stubs.test.ts` | **MODIFY** | Add `svelte-loader` stub warn test at `~20-30` `expect(warn).toContain('svelte-loader is not installed')`. |

### 7.4 Types / Data Structures

```ts
// /Volumes/New Volume/code/spfx/packages/framework-svelte/src/webpart.ts:1-10
import type { Component as Svelte5Component } from 'svelte'; // Svelte 5
import type { ComponentConstructorOptions, SvelteComponentTyped } from 'svelte'; // Svelte 4
type Svelte4Component<TProps extends Record<string,unknown>> =
  new (options: ComponentConstructorOptions<TProps>) => SvelteComponentTyped<TProps>;
export type SvelteComponent<TProps extends Record<string,unknown>> =
  Svelte4Component<TProps> | Svelte5Component<TProps>;
export interface SvelteWebPartComponent<TProps extends Record<string,unknown>> {
  component: SvelteComponent<TProps>;
  props: TProps;
}
// instances: WeakMap<HTMLElement, SvelteComponentTyped<any> | ReturnType<typeof mount>>
const instances = new WeakMap<HTMLElement, any>();
const isSvelte5: boolean; // detected via svelte/package.json major >=5

// /Volumes/New Volume/code/spfx/packages/framework-svelte/src/context.ts:1-10
export const RSPFX_CONTEXT_KEY = 'rspfx:context' as const;
export function setSpfxContext(ctx: WebPartContextLike): void;
export function getSpfxContext(): WebPartContextLike;

// /Volumes/New Volume/code/spfx/packages/framework-solid/src/webpart.ts:1-10
import type { JSX } from 'solid-js';
import type { Owner, Setter } from 'solid-js';
type SolidEntry<TProps> = { dispose:()=>void; setProps:Setter<TProps>; owner:Owner };
const entries = new WeakMap<HTMLElement, SolidEntry<any>>();

// /Volumes/New Volume/code/spfx/packages/framework-solid/src/theme.ts:1-20
export function createTheme(
  getTheme: ()=> ISpfxTheme | undefined,
  subscribe: (cb:(t:ISpfxTheme|undefined)=>void)=>{dispose:()=>void}
): Accessor<ISpfxTheme|undefined>;

// /Volumes/New Volume/code/spfx/packages/framework-solid/src/context.ts:1-10
import type { Context } from 'solid-js';
export const SpfxContext: Context<WebPartContextLike|undefined>;

// /Volumes/New Volume/code/spfx/packages/framework-svelte/src/index.ts:1-15
export interface SvelteCompilerOptions {
  dev: boolean;
  css: 'injected' | 'external'; // we use 'injected'
  runes?: boolean | undefined;   // undefined = auto (Svelte 5 detects)
}
export interface SvelteLoaderOptions {
  hotReload: boolean;
  emitCss: false;
  compilerOptions: SvelteCompilerOptions;
  preprocess?: unknown; // from svelte.config.js
}

// /Volumes/New Volume/code/spfx/packages/framework-solid/src/index.ts:7-24
export interface SolidBabelOptions {
  cacheDirectory: true;
  presets: [string, {generate:'dom', development?:boolean}][]; // babel-preset-solid
  plugins: [string, {bundler:'rspack-esm'}][];                  // solid-refresh/babel
}
// future SWC branch:
export interface SolidSwcOptions {
  jsc: { parser:{syntax:'typescript', tsx:true}, transform:{ react:{runtime:'automatic'} } };
  rspackExperiments: { swcPlugins: [string, {generate:'dom'}][] }; // @swc/plugin-solid
}

// /Volumes/New Volume/code/spfx/packages/plugin-api/src/types.ts:29-44 (FrameworkPreset now satisfies)
type FrameworkIdCore = 'vanilla'|'react'|'solid'|'preact'|'vue'|'svelte';
type FrameworkId = FrameworkIdCore | (string & { __custom?: never });
interface RspackContribs { rules?: RuleSetRule[]; plugins?: Configuration['plugins']; resolve?: {alias?:Record<string,string>;extensions?:string[]}; swc?:{jsc?:Record<string,unknown>}; define?:Record<string,string> }
interface FrameworkPreset<T extends FrameworkId = FrameworkId> {
  readonly name:T;
  rspack(opts:{fastRefresh:boolean}):RspackContribs;
  vite?(opts:{fastRefresh:boolean}):ViteContribs;
  rsbuild?(opts:{fastRefresh:boolean}):RsbuildContribs;
}
// usage: export const preset = { name:'svelte', ... } satisfies FrameworkPreset<'svelte'>
```

**Svelte 5 runes component shape (template output):**

```svelte
<!-- /Volumes/New Volume/code/spfx/templates/src/index.ts:708 runes example -->
<script lang="ts">
  let { description }: { description: string } = $props();
  import { fade } from 'svelte/transition';
  let count = $state(0);
</script>

<div class="card" transition:fade>
  <h2 class="card-title">{description}</h2>
  <button onclick={() => count++}>count {count}</button>
</div>
```

**Svelte 4 fallback (still valid):**

```svelte
<script>
  export let description = '';
</script>
```

Both compile under `runes:undefined` (auto).

### 7.5 Ordered Implementation Steps

1. **Svelte peer & detection (0.5d)** — Edit `/Volumes/New Volume/code/spfx/packages/framework-svelte/package.json:37` peer to `^4.2.0 || ^5.0.0`. Add `isSvelte5` helper at `webpart.ts:8-10` via `require('svelte/package.json').version`. Verify `pnpm install` with Svelte 4 and 5 in separate `pnpm --filter` workspaces.

2. **Svelte webpart preserve (1d)** — Rewrite `/Volumes/New Volume/code/spfx/packages/framework-svelte/src/webpart.ts:11-35` to `$set` preserve + `mount/unmount` branch. Add `SvelteWebPartComponent<TProps>` union at `webpart.ts:2-6` dropping `SvelteComponentTyped` import for Svelte 5 path. Test via `framework-svelte/tests/webpart.test.ts:90` `$set not $destroy` — create `jsdom` root, `renderInto`, mutate `properties.description`, assert `instances.get(root).$set` called not `$destroy`. Add Svelte 5 `mount` mock.

3. **Svelte preset unify (1.5d)** — Edit `/Volumes/New Volume/code/spfx/packages/framework-svelte/src/index.ts:6-46` to `emitCss:false`, `compilerOptions:{dev, css:'injected', runes:undefined}`, `preprocess` via `svelte.config.js` walk-up at `index.ts:8-12` `resolveSvelteConfig`. Mirror to `vite()` and `rsbuild()`. Add stub `packages/compiler-rspack/src/stubs/svelte-loader.ts:1-15` and gate alias in `compiler-rspack/src/config.ts:15-19` via `tryResolve`. Test `framework-svelte/tests/build.test.ts:62` `fastRefresh:true` `svelte-hmr` wrapper.

4. **Solid `cacheDirectory` + SWC eval (1d)** — Edit `/Volumes/New Volume/code/spfx/packages/framework-solid/src/index.ts:7-24` to add `cacheDirectory:true` at `13` and `builtin:swc-loader` branch at `8-12` behind `tryResolve('@swc/plugin-solid')`. Default remains `babel-loader` for 0.1.0, SWC is opt-in evaluated. Benchmark `bench/bench.mjs:59` cold + recompile before/after `cacheDirectory`.

5. **Solid webpart preserve + bridges (2d)** — Rewrite `/Volumes/New Volume/code/spfx/packages/framework-solid/src/webpart.ts:5-31` to `WeakMap<HTMLElement,{dispose,setProps,owner}>` + `createSignal` preserve at `11-18`. Create `/Volumes/New Volume/code/spfx/packages/framework-solid/src/context.ts:1-15` `SpfxContext` and `/Volumes/New Volume/code/spfx/packages/framework-solid/src/theme.ts:1-45` `createTheme`. Create `/Volumes/New Volume/code/spfx/packages/framework-svelte/src/context.ts:1-10`. Verify property-pane keystroke preserves Solid signal `count 5` survives via `framework-solid/tests/webpart.test.ts:90` `preserves signal on property change`.

6. **Vue/Preact hooks (0.5d)** — Add `exclude: /node_modules/(?!my-lib)/` to `/Volumes/New Volume/code/spfx/packages/framework-vue/src/index.ts:9` and `framework-preact/src/index.ts` contributions; add `cssHash` override for Svelte `generateScopedName: 'svelte-[hash:base64:4]'` deterministic.

7. **Templates runes + svelte.config.js (1.5d)** — Rewrite `/Volumes/New Volume/code/spfx/packages/templates/src/index.ts:708-712` `svelteComponent()` to runes `let {description}=$props()` + `transition:fade` at `708-714`. Add `svelteConfigJs()` helper at `760-765` and wire into `buildFiles:97-151` to emit `svelte.config.js` when `framework==='svelte'`. Add `svelte-check` to `devDeps` in `packageJson:202-217`. Update `declarations:785-799` svelte `.d.ts` to `Component<TProps>` union.

8. **Docs + tests (1d)** — Update `docs/frameworks.md:10` mount table and `docs/fast-refresh.md:30-40` Svelte 5 row. Add `packages/compiler-rspack/tests/stubs.test.ts` svelte-loader warn test. Run `pnpm build && pnpm test` — all frameworks pass `render()` → property-pane keystroke without teardown.

9. **Parity & HMR verify (1d)** — Build `examples/svelte` with `rspfx build` (Rspack) and `rspfxVite` parity path; assert `dist/*.js` header + assets naming identical. Run `rspfx dev --refresh` manual: edit `Hello.svelte` runes `$state` count, save, expect HMR preserves count (no full reload). Solid `count` preserve via signal.

**Total 10d** — steps 1-4 parallelizable (Svelte vs Solid), steps 5-6 parallel, step 7 after.

### 7.6 Migration Notes

| From (0.0.13) | To (0.1.0) | Action |
|---|---|---|
| `import type { SvelteComponentTyped } from 'svelte'` | `import type { Component } from 'svelte'` (Svelte 5) or union | If extending `SvelteWebPart`, change `SvelteWebPartComponent<TProps>` generic to new union; `ComponentConstructorOptions` still works for Svelte 4. No change needed if staying on Svelte 4. |
| `packages/framework-svelte` `svelte: ^4.2.0` forced | `^4.2.0 \|\| ^5.0.0` | No action if on 4; to opt into runes, `pnpm add svelte@^5.0.0 svelte-loader@^...` + `pnpm add -D svelte-check`. Template `svelteComponent` will auto-use runes but old `export let` remains valid (compat). |
| `isSvelte5` branch missing | auto | Existing `SvelteWebPart` subclasses recompile and automatically get `$set` preserve; no code change. |
| `framework-solid` `babel-loader` without cache | `cacheDirectory:true` | Transparent — first build warms `.babel-cache`. Delete `.rspack-cache` if stale. |
| `SolidWebPart<TProps,TState>` second generic | removed | Change `extends SolidWebPart<IProps, unknown>` → `extends SolidWebPart<IProps>` (TState dead). Codemod `rspfx migrate --to 0.1` rewrites. |
| `svelte.config.js` absent | generated | New `rspfx new --framework svelte` emits `svelte.config.js` with `vitePreprocess()`; existing projects should create one: `export default { preprocess: vitePreprocess(), compilerOptions:{css:'injected'} }` to get `preprocess` wiring. Without it, `svelte-loader` still works but `svelte-preprocess` (scss etc.) disabled. |
| `svelte-loader` not installed | stub warn | Previously threw at `require.resolve`; now `BUILD_TIME_ALIASES` stub logs warning and builds without HMR (fallback to full reload). Install `svelte-loader` to enable HMR. |
| `vue/preact` lib JSX in `node_modules/my-lib` ignored | now handled via `exclude: /node_modules/(?!my-lib)/` | No action unless you import JSX from a linked lib — now transpiled correctly. |

**Codemod:** `rspfx migrate --to 0.1` handles `SvelteComponentTyped → Component`, removes `TState`, adds `svelte.config.js` from template, rewrites `framework: string` literal per Phase 1.

### 7.7 Exit Criteria (Functional)

- [ ] `examples/svelte/src/webparts/hello/components/Hello.svelte:1` with `$state/$props` + `transition:fade` builds via `rspfx build` (Rspack), `rspfxVite`, `rspfxRsbuild` — all three produce `dist/*.js` with same `captureLine` header `startsWith('(function(){window["__rspfx_script_url_')`.
- [ ] HMR preserves state: Svelte `count` via `$state` survives `renderInto` property-pane change (test `framework-svelte/tests/webpart.test.ts:90` `$set not $destroy`), Solid `count 5` signal survives (`framework-solid/tests/webpart.test.ts:90` `preserves signal on property change`).
- [ ] `isSvelte5` branch verified: running tests with `svelte@5` (via `pnpm add svelte@5 --filter framework-svelte`) uses `mount`/`unmount`, with `svelte@4` uses `new Component`/`$destroy` — both pass.
- [ ] `rg svelte-loader` stub warns not throw — `packages/compiler-rspack/tests/stubs.test.ts` asserts `console.warn` contains `svelte-loader is not installed` when `svelte-loader` not in `node_modules`.
- [ ] `docs/frameworks.md:10` mount table updated ✅ preserve for Solid/Svelte; `docs/fast-refresh.md:37` adapter table reflects `mount/unmount` and `cacheDirectory:true`.
- [ ] `pnpm build && pnpm test` green; `pnpm typecheck` no `SvelteComponentTyped` error (union covers both).
- [ ] `templates` `svelteComponent` runes example + `svelte.config.js` generation + `svelte-check` devDep present in scaffolded `package.json`.
- [ ] `framework-solid/tests/build.test.ts:62` asserts `fastRefresh:true` injects `solid-refresh/babel` or `builtin:swc-loader` with `@swc/plugin-solid`; Vite parity `vitePluginSolid` still works.
- [ ] No CI files modified.
- [ ] `core` still zero-deps — `depcruise` gate would pass if run (but not run in this phase).

### 7.8 Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Svelte 5 `mount/unmount` API mismatch (Svelte 5.0 vs 5.1 `mount` signature `mount(component,{target,props})` vs `mount(Component, {target, props})` positional) | Runtime `TypeError: mount is not a function` on Svelte 5 | Feature-detect: `try{ mount }catch{ fallback }`; test matrix `svelte@4.2.19` and `svelte@5.0.0` in `pnpm test` `framework-svelte` job (local, not CI). Keep `new Component` fallback. |
| `svelte-loader` preprocess walk-up `require.resolve('svelte.config.js', {paths:[projectRoot]})` fails when project uses ESM `svelte.config.ts` | Preprocess ignored, scss in Svelte fails | Try `svelte.config.js`, `svelte.config.ts`, `svelte.config.mjs` in order; if none, no `preprocess`. Log debug. |
| `runes:undefined` + `css:'injected'` breaks Svelte 4 projects using `css:'external'` | Styles externalized incorrectly | `runes:undefined` is auto-detect; `css:'injected'` matches current `emitCss:false` behavior (styles inlined). For Svelte 4 external CSS, user can override via `svelte.config.js` `compilerOptions.css external` — our preset respects `svelteConfig.compilerOptions` merge. |
| Solid `cacheDirectory:true` + `RSPACK_CACHE=1` persistent cache double-cache causes stale `babel-preset-solid` output on `solid-js` version bump | Stale bundle, hidden bug | Include `solid-js` version in cache version hash at `compiler-rspack/src/config.ts:303-313` `experiments.cache.version = hash(framework+spfxVersion+build+solidVersion)`. |
| `builtin:swc-loader` + `@swc/plugin-solid` not installed → `swcPlugins` resolve fails throw | Build fails for Solid projects without plugin | Gate `builtin:swc-loader` behind `tryResolve('@swc/plugin-solid', projectRoot)`; fallback to `babel-loader` when not found. Evaluate only, not default. |
| `exclude: /node_modules/(?!my-lib)/` regex is over-broad — transpiles too much `node_modules` | Build slow, breaks `node_modules` that shouldn't be transpiled | Apply per-framework `exclude` only when `ctx.localizedResources` or `framework==='vue'|'preact'`; keep default `exclude:/node_modules/` for others. Test `bench` before/after. |
| `createTheme` `onCleanup` called outside Solid owner (webpart `renderInto` not in `createRoot`) | Theme signal never disposes, leaks listener | Ensure `createTheme` called inside `createRoot` owner created in `renderInto`; store `owner` from `getOwner()` and dispose on `disposeFrom`. |
| Template `svelte.config.js` ESM (`import { vitePreprocess }`) fails when project `type:commonjs` | Generated config not loadable | Emit `svelte.config.js` as ESM with `type:module` project (all templates are `type:module` per `templates/src/index.ts:192`); fallback `svelte.config.cjs` commented alternative. |
| `svelte-check` peer `typescript` version mismatch | `svelte-check` errors on TS 5.7 vs 5.8 | Pin `svelte-check@^4.0.0` which supports `typescript@^5.7.0` already in templates `tsconfig` target. |

### 7.9 Effort Estimate

**10d total** (single engineer; 6d with 2 engineers Svelte vs Solid parallel):

| Task | Days | Engineer |
|---|---|---|
| Svelte peer + webpart preserve | 1.5 | Framework |
| Svelte preset unify + stub | 1.5 | Compiler + Framework |
| Solid cacheDirectory + SWC eval | 1 | Compiler |
| Solid webpart + bridges | 2 | Framework |
| Vue/Preact hooks | 0.5 | Framework |
| Templates runes + svelte.config.js | 1.5 | Templates |
| Docs + tests | 1 | Either |
| Parity & HMR manual verify | 1 | Either |

Parallelizable: Svelte track (1-3) and Solid track (4-5) independent; templates (7) after.

---

### Phase 6 + 7 Combined Notes

- **Order:** Phase 6 can start once Phase 5 kernel `CompileContext` is frozen. Phase 7 depends on Phase 2 adapter (already landed) but otherwise independent of Rust; they can overlap in calendar (Rust engineer vs Framework engineer).
- **No CI:** All gates are `pnpm build && pnpm test` + manual `cargo test` + `bench/bench.mjs`. CI wiring deferred to Phase 9.
- **Single version bump:** Both phases ship behind `0.1.0` break; no intermediate publish.
