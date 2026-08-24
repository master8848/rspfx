# Phase 2 — Headless Adapter

## 2.1 Detailed Goal & Rationale

**Goal:** Decouple rendering from SPFx lifecycle by extracting `BaseWebPart` out of `@mbsks/rspfx-core` into a dedicated zero-cycle adapter layer and replacing inheritance (`extends BaseWebPart` + `renderInto`/`disposeFrom` abstract overrides) with a compositional **headless adapter** contract. After Phase 2, `core` is truly zero-deps (no `import * as spWebpartBase from '@microsoft/sp-webpart-base'`), framework packages export a pure `createXAdapter<TProps>(root): HeadlessAdapter<TProps>` plus a thin `XWebPart` class that merely binds the adapter to the SPFx lifecycle, and consumers can use `defineWebPart<TProps>({ adapter, ... })` without subclassing. Prop derivation (`getComponentProps`) becomes a pure selector `(properties) => props` that is independently type-checked and testable off-DOM.

**Current pain (why this must precede Hooks/Diagnostics/Framework Modernization):**

* `/Volumes/New Volume/code/spfx/packages/core/src/base-web-part.ts:1` imports `@microsoft/sp-webpart-base` as `spWebpartBase` and casts via `as unknown as { BaseClientSideWebPart: new <TProps>... }` at `:4-7` then `export abstract class BaseWebPart<TProps> extends BaseClientSideWebPart<TProps>` at `:10`. This is the *only* violation of `ARCHITECTURE.md:102` / `docs/architecture.md:63` `core has zero dependencies`. It forces `core/package.json` to carry an implicit `@microsoft/sp-webpart-base` peer and leaks `IPropertyPaneConfiguration`, `WebPartContext`, and `Version` ambient types into every `import { defineConfig } from '@mbsks/rspfx-core'` consumer. `docs/frameworks.md:12` already declares the three-hook contract but the base class still hard-wires it to SPFx inheritance rather than composition.
* Framework web parts re-implement the same WeakMap disposal ceremony with subtle drift: `/Volumes/New Volume/code/spfx/packages/framework-solid/src/webpart.ts:5` `const disposers = new WeakMap<HTMLElement,()=>void>()` + `:11-18` dispose-then-`render(()=>renderComponent(...), root)`, `/Volumes/New Volume/code/spfx/packages/framework-svelte/src/webpart.ts:9` `WeakMap<HTMLElement,SvelteComponentTyped>` + `:15-21` `$destroy` then `new component({target:root,props})`, `/Volumes/New Volume/code/spfx/packages/framework-react/src/webpart.ts` `WeakMap<HTMLElement,Root>` + `createRoot`/`root.render`/`root.unmount`, `/Volumes/New Volume/code/spfx/packages/framework-vanilla/src/webpart.ts` `replaceChildren`. No shared `HeadlessAdapter` interface; `docs/frameworks.md:36-44` says split into `preset` (Node-safe) and `/webpart` (browser) but four `framework-*/src/webpart.ts` files each own their own lifecycle glue. Adding Svelte 5 runes (Phase 7) or Solid owner preservation (Phase 4) would require touching `core/src/base-web-part.ts:18` `render():void` centrally and risking every framework.
* `BaseWebPart<TProps extends Record<string,unknown>>` at `base-web-part.ts:10` constrains `TProps` to `Record<string,unknown>` rather than a `Props` branded via Phase 1 `defineConfig<const T>` literal. `getComponentProps():TProps` at `:12` defaults to `this.properties` in every framework (`solid/webpart.ts:28-30`, `svelte/webpart.ts:32-34`) — untestable without instantiating a full `BaseClientSideWebPart` (`this.domElement`, `this.context`, `this.properties` as live SPFx getters). TanStack headless pattern is impossible: you cannot render a framework component in `dev-runtime` local preview (`dev-runtime/src/local-page.ts:40`) without SPFx host.
* `packages/core/src/context.ts:1` `WebPartContextLike` and `packages/core/src/environment.ts:1` `EnvironmentType` are stranded: they are imported by `sharepoint-runtime/src/context.ts:1` but `BaseWebPart` still reads `this.context` as `any` from SPFx. No `ThemeProvider`/`Environment` injection seam for headless adapters to consume.
* `packages/core/src/index.ts:1-21` re-exports `defineConfig` but cannot re-export `BaseWebPart` without the SPFx import; `packages/framework-*/src/webpart.ts:1` `import { BaseWebPart } from '@mbsks/rspfx-core/webpart'` creates a Node→browser split that `tsconfig.build.json` `paths:{}` empty rule cannot express for consumers.

**After:** `core` zero-deps invariant is auditable (`grep dependencies packages/core/package.json` => empty). `@mbsks/rspfx-webpart-base` (new) owns the SPFx dependency and exports `BaseWebPart` + `defineWebPart` headless factory. Each framework exports `createSolidAdapter`, `createSvelteAdapter`, etc. returning `HeadlessAdapter<TProps>` = `{ mount(root, props): void; update(props): void; unmount(root): void }` (or `{ renderInto, disposeFrom }` shape). `SolidWebPart`/`SvelteWebPart` become one-line bindings: `extends HeadlessWebPart<TProps> { protected createAdapter() { return createSolidAdapter(...) } }`. `dev-runtime/src/local-page.ts` can mount adapters without SPFx host for preview; `sharepoint-runtime/src/context.ts` provides typed `createHeadlessContext`.

**Non-goal:** No new bundler behavior, no compiler change (preset `contributions()` → `rspack()` rename already done in Phase 1), no CSS/invalidation change. No CI changes — verification is local `pnpm build && pnpm typecheck && pnpm test`.

---

## 2.2 All Breaking Changes — Before/After Snippets

### 1. `BaseWebPart` location & zero-deps — `packages/core/src/base-web-part.ts:1` → `packages/webpart-base/src/index.ts:1` (new)

**Before:**

```ts
// /Volumes/New Volume/code/spfx/packages/core/src/base-web-part.ts:1-26
import * as spWebpartBase from '@microsoft/sp-webpart-base';
import type { BaseClientSideWebPart as BaseClientSideWebPartType } from '@microsoft/sp-webpart-base';

const BaseClientSideWebPart = (
  spWebpartBase as unknown as { BaseClientSideWebPart: new <TProps extends Record<string,unknown>>() => BaseClientSideWebPartType<TProps> }
).BaseClientSideWebPart;

export abstract class BaseWebPart<TProps extends Record<string,unknown> = Record<string,unknown>>
  extends BaseClientSideWebPart<TProps> {
  protected abstract getComponentProps(): TProps;
  protected abstract renderInto(root: HTMLElement): void;
  protected abstract disposeFrom(root: HTMLElement): void;
  public override render(): void { this.renderInto(this.domElement); }
  protected override onDispose(): void { this.disposeFrom(this.domElement); super.onDispose(); }
}
```

**After:**

```ts
// /Volumes/New Volume/code/spfx/packages/core/src/headless.ts:1 (new, zero-deps, no sp-webpart-base)
export interface HeadlessAdapter<TProps> {
  readonly mount: (root: HTMLElement, props: TProps) => void;
  readonly update: (root: HTMLElement, props: TProps) => void; // default = unmount+mount
  readonly unmount: (root: HTMLElement) => void;
}
export interface HeadlessWebPartOptions<TProps> {
  readonly adapter: (host: { root: HTMLElement }) => HeadlessAdapter<TProps>;
  readonly selector?: (properties: TProps) => TProps; // default x=>x
}

// /Volumes/New Volume/code/spfx/packages/webpart-base/src/index.ts:1 (new, owns sp-webpart-base dep)
import * as spWebpartBase from '@microsoft/sp-webpart-base';
import type { BaseClientSideWebPart as SPBase } from '@microsoft/sp-webpart-base';
import type { HeadlessAdapter } from '@mbsks/rspfx-core/headless';

const SPBaseCtor = (spWebpartBase as unknown as { BaseClientSideWebPart: new <T extends Record<string,unknown>>() => SPBase<T> }).BaseClientSideWebPart;

export abstract class HeadlessWebPart<TProps extends Record<string,unknown>> extends SPBaseCtor<TProps> {
  protected abstract createAdapter(): HeadlessAdapter<TProps>;
  private adapter?: HeadlessAdapter<TProps>;
  protected getComponentProps(): TProps { return this.properties as TProps; } // override point
  public override render(): void {
    this.adapter ??= this.createAdapter();
    this.adapter.mount(this.domElement, this.getComponentProps());
  }
  protected override onDispose(): void {
    if(this.adapter) this.adapter.unmount(this.domElement);
    super.onDispose();
  }
  protected updateProps(next: TProps): void {
    this.adapter?.update(this.domElement, next);
  }
}
// compat re-export for one major:
export { HeadlessWebPart as BaseWebPart } from './index.js'; // @deprecated alias
```

**Break:** `import { BaseWebPart } from '@mbsks/rspfx-core/webpart'` still resolves for one major via shim at `/Volumes/New Volume/code/spfx/packages/core/src/webpart.ts:1` (re-export with `console.warn` once) but type is now `HeadlessWebPart<TProps>` and new code must `import { HeadlessWebPart, defineWebPart } from '@mbsks/rspfx-webpart-base'`. `core` no longer installs `@microsoft/sp-webpart-base` (peer moves to `webpart-base`).

### 2. `defineWebPart` factory — new `packages/webpart-base/src/define.ts:1` + `packages/core/src/headless.ts:1`

**Before (subclass ceremony, 30 LOC per web part):**

```ts
// consumer src/webparts/hello/HelloWebPart.ts (before)
import { SolidWebPart } from '@mbsks/rspfx-framework-solid/webpart';
export default class HelloWebPart extends SolidWebPart<{ name: string }> {
  protected renderComponent(props: {name:string}) { return <Hello name={props.name} />; }
  protected getComponentProps() { return this.properties; }
}
```

**After (headless, props selector typed, no abstract class):**

```ts
// /Volumes/New Volume/code/spfx/packages/webpart-base/src/define.ts:1
export function defineWebPart<const TProps extends Record<string,unknown>>(opts:{
  readonly adapterFactory: (host:{ domElement: HTMLElement }) => HeadlessAdapter<TProps>;
  readonly propertiesSchema?: (raw: unknown) => TProps; // optional valibot-style
  readonly displayName?: string;
}): new () => HeadlessWebPart<TProps> {
  return class extends HeadlessWebPart<TProps> {
    protected createAdapter() { return opts.adapterFactory({ domElement: this.domElement }); }
    protected getComponentProps(): TProps {
      const raw = super.getComponentProps();
      return opts.propertiesSchema ? opts.propertiesSchema(raw) : raw;
    }
  };
}

// consumer (after)
import { defineWebPart } from '@mbsks/rspfx-webpart-base';
import { createSolidAdapter } from '@mbsks/rspfx-framework-solid/headless';
export default defineWebPart<{name:string}>({
  adapterFactory: ({domElement}) => createSolidAdapter<{name:string}>((props)=> <Hello {...props} />),
});
```

**Break:** Abstract `renderComponent`/`renderInto`/`disposeFrom` no longer the only path. Old `extends SolidWebPart` still compiles via compat shim but is `@deprecated` — codemod rewrites to `defineWebPart`.

### 3. Framework `/webpart` split → `/headless` + thin `/webpart` shim

**Before:**

```ts
// /Volumes/New Volume/code/spfx/packages/framework-solid/src/webpart.ts:1-31
import { BaseWebPart } from '@mbsks/rspfx-core/webpart';
const disposers = new WeakMap<HTMLElement,()=>void>();
export abstract class SolidWebPart<TProps,...> extends BaseWebPart<TProps> {
  protected abstract renderComponent(props:TProps): JSX.Element;
  protected renderInto(root:HTMLElement){ const prev=disposers.get(root); if(prev) prev(); const dispose=render(()=>this.renderComponent(this.getComponentProps()), root); disposers.set(root,dispose); }
  protected disposeFrom(root:HTMLElement){ const dispose=disposers.get(root); if(dispose){dispose(); disposers.delete(root);} }
  protected getComponentProps():TProps{ return this.properties; }
}
```

**After:**

```ts
// /Volumes/New Volume/code/spfx/packages/framework-solid/src/headless.ts:1 (new, browser, no sp dependency)
import { render } from 'solid-js/web';
import type { HeadlessAdapter } from '@mbsks/rspfx-core/headless';
import type { JSX } from 'solid-js';
const disposers = new WeakMap<HTMLElement,()=>void>(); // same WeakMap, now private to adapter
export function createSolidAdapter<TProps>(renderComponent:(props:TProps)=>JSX.Element): HeadlessAdapter<TProps> {
  return {
    mount(root, props){
      const prev = disposers.get(root); if(prev) prev();
      const dispose = render(()=> renderComponent(props), root);
      disposers.set(root, dispose);
    },
    update(root, props){ // solid: dispose+recreate (preservation via Phase 4 store is opt-in)
      const prev = disposers.get(root); if(prev) prev();
      const dispose = render(()=> renderComponent(props), root);
      disposers.set(root, dispose);
    },
    unmount(root){ const d=disposers.get(root); if(d){ d(); disposers.delete(root);} }
  };
}

// /Volumes/New Volume/code/spfx/packages/framework-solid/src/webpart.ts:1 (shim, kept for compat)
import { HeadlessWebPart } from '@mbsks/rspfx-webpart-base';
import { createSolidAdapter } from './headless.js';
export abstract class SolidWebPart<TProps extends Record<string,unknown>> extends HeadlessWebPart<TProps> {
  protected abstract renderComponent(props:TProps): import('solid-js').JSX.Element;
  protected createAdapter(){ return createSolidAdapter<TProps>((p)=> this.renderComponent(p)); }
}
```

Analogously `/Volumes/New Volume/code/spfx/packages/framework-svelte/src/webpart.ts:1-35` splits:

```ts
// before svelte/webpart.ts:9 WeakMap<SvelteComponentTyped>
export interface SvelteWebPartComponent<TProps>{ component: new (o:ComponentConstructorOptions<TProps>)=>SvelteComponentTyped<TProps>; props:TProps; }

// after svelte/headless.ts:1
export function createSvelteAdapter<TProps>(factory:(props:TProps)=>SvelteWebPartComponent<TProps>):HeadlessAdapter<TProps> {
  const instances = new WeakMap<HTMLElement,SvelteComponentTyped<Record<string,unknown>>>();
  return {
    mount(root, props){
      const prev=instances.get(root); if(prev) prev.$destroy();
      const {component, props: p}=factory(props);
      instances.set(root, new component({target:root, props:p}));
    },
    update(root, props){ /* dispose+recreate; Svelte 5 runes preservation via props.$set when available */ 
      const prev=instances.get(root); if(prev) prev.$destroy();
      const {component, props:p}=factory(props); instances.set(root, new component({target:root, props:p}));
    },
    unmount(root){ const i=instances.get(root); if(i){ i.$destroy(); instances.delete(root);} }
  };
}
```

**Break:** `import { SolidWebPart } from '@mbsks/rspfx-framework-solid/webpart'` still works (shim) but new code should `import { createSolidAdapter } from '@mbsks/rspfx-framework-solid/headless'`. The `webpart` entry now imports `@mbsks/rspfx-webpart-base`, not `@mbsks/rspfx-core/webpart`. `framework-*` `package.json` `peerDependencies` no longer list `@microsoft/sp-webpart-base` directly — that dep lives in `webpart-base`.

### 4. Props selector & context injection — `packages/core/src/context.ts:1` + `sharepoint-runtime/src/context.ts:1`

**Before:**

```ts
// packages/core/src/context.ts:1
export interface WebPartContextLike { domElement: HTMLElement; propertyPane: unknown; ... }
// BaseWebPart reads this.context as any from SPFx, getComponentProps returns this.properties untyped
```

**After:**

```ts
// packages/core/src/headless.ts:1
export type PropsSelector<TProps, TRaw = Record<string,unknown>> = (raw: TRaw, ctx: HeadlessContext) => TProps;
export interface HeadlessContext {
  readonly domElement: HTMLElement;
  readonly themeProvider: ThemeProvider; // from core/src/context.ts:1
  readonly environment: EnvironmentType;
  readonly cultureName: CultureName;     // Phase 1 newtype Lcid/CultureName
}

// sharepoint-runtime/src/context.ts:10
export function createHeadlessContext(spContext: WebPartContextLike, domElement:HTMLElement): HeadlessContext;
```

Adapter `mount(root, props)` receives already-selected `TProps`; context is passed via factory closure `createAdapter({domElement, context: createHeadlessContext(this.context, this.domElement)})` when `defineWebPart` binds `this.context`. Pure adapters are testable: `createSolidAdapter(...).mount(fakeDiv, {name:'test'})` without SPFx.

### 5. Vanilla headless specialization

**Before:**

```ts
// packages/framework-vanilla/src/webpart.ts:1
export abstract class VanillaWebPart<TProps> extends BaseWebPart<TProps> {
  protected abstract renderComponent(props:TProps): HTMLElement | string;
  protected renderInto(root:HTMLElement){ root.replaceChildren(this.renderComponent(this.getComponentProps())); }
  protected disposeFrom(root:HTMLElement){ root.replaceChildren(); }
}
```

**After:**

```ts
// packages/framework-vanilla/src/headless.ts:1
export function createVanillaAdapter<TProps>(render:(props:TProps)=> HTMLElement | string): HeadlessAdapter<TProps> {
  return {
    mount(root, props){ const node = render(props); root.replaceChildren(typeof node==='string' ? document.createTextNode(node) : node); },
    update(root, props){ const node = render(props); root.replaceChildren(typeof node==='string' ? document.createTextNode(node) : node); },
    unmount(root){ root.replaceChildren(); }
  };
}
```

---

## 2.3 File-by-File Breakdown (Absolute Paths + Line Numbers)

| # | Absolute Path | Lines | Action | Detail |
|---|---|---|---|---|
| 2.1 | `/Volumes/New Volume/code/spfx/packages/core/src/headless.ts` | **new** | **Create** | Zero-deps. Exports `HeadlessAdapter<TProps>`, `PropsSelector<TProps>`, `HeadlessContext`, `ThemeProvider` re-export. No `import` from `@microsoft/*` or `node:*`. ~55 LOC. Must have `.js` imports only if internal. |
| 2.2 | `/Volumes/New Volume/code/spfx/packages/core/src/base-web-part.ts` | `1-26` | **Delete/Replace** | Delete class body. Replace with shim: `export { HeadlessWebPart as BaseWebPart } from '@mbsks/rspfx-webpart-base'` plus `@deprecated` JSDoc and `console.warn` once via `packages/diagnostics/src/logger.ts:42`. Or keep file as re-export stub for one major. Remove `import * as spWebpartBase`. |
| 2.3 | `/Volumes/New Volume/code/spfx/packages/core/src/webpart.ts` | **new** or `1-5` | **Create/Shim** | If `core/src/webpart.ts` is the subpath entry (`core/webpart`), make it `export * from '@mbsks/rspfx-webpart-base'` deprecated shim. Update `core/package.json` `exports`: `"./webpart": { "types":"./dist/webpart.d.ts", "default":"./dist/webpart.js" }` still resolves but marks `deprecated`. |
| 2.4 | `/Volumes/New Volume/code/spfx/packages/core/src/index.ts` | `1-21` | **Modify** | Remove re-export of `BaseWebPart` if present; add `export type { HeadlessAdapter, HeadlessContext, PropsSelector } from './headless.js'` . Keep `core` zero-deps audit green. |
| 2.5 | `/Volumes/New Volume/code/spfx/packages/webpart-base/src/index.ts` | **new** | **Create** | New package `@mbsks/rspfx-webpart-base`. `package.json` with `dependencies: { "@microsoft/sp-webpart-base": "^1.20.0" }` (peer), `peerDependencies: { "@mbsks/rspfx-core":"*" }`. Exports `HeadlessWebPart<TProps>`, `BaseWebPart` alias, `defineWebPart`. ~80 LOC. Implements `render()`/`onDispose()` binding to `HeadlessAdapter`. |
| 2.6 | `/Volumes/New Volume/code/spfx/packages/webpart-base/src/define.ts` | **new** | **Create** | Implements `defineWebPart<const TProps>(opts)` factory. Reads `this.context` and `this.properties` lazily in `render()`. Add `displayName` for devtools. ~45 LOC. |
| 2.7 | `/Volumes/New Volume/code/spfx/packages/webpart-base/package.json` | **new** | **Create** | `name:@mbsks/rspfx-webpart-base`, `version:0.1.0`, `type:module`, `exports:{".": "./dist/index.js", "./define": "./dist/define.js"}`, `peerDependencies` on `core`. Add to `pnpm-workspace.yaml` if present. |
| 2.8 | `/Volumes/New Volume/code/spfx/packages/framework-solid/src/headless.ts` | **new** | **Create** | `createSolidAdapter<TProps>(renderComponent)` pure function with WeakMap `disposers`. No `BaseWebPart` import. ~25 LOC. Imports only `solid-js/web` and `HeadlessAdapter` type. |
| 2.9 | `/Volumes/New Volume/code/spfx/packages/framework-solid/src/webpart.ts` | `1-31` | **Rewrite** | Replace body with shim extending `HeadlessWebPart` from `webpart-base`. Keep `renderComponent` abstract for compat but `createAdapter()` delegates to `createSolidAdapter`. Import `HeadlessWebPart` not `BaseWebPart`. |
| 2.10 | `/Volumes/New Volume/code/spfx/packages/framework-svelte/src/headless.ts` | **new** | **Create** | `createSvelteAdapter<TProps>(factory)` with `WeakMap<HTMLElement,SvelteComponentTyped>` at module scope (per-adapter, not global). Handle `component.$destroy` vs Svelte 5 `$destroy`/`unmount` dual path (check `instance.$destroy` exists). ~30 LOC. |
| 2.11 | `/Volumes/New Volume/code/spfx/packages/framework-svelte/src/webpart.ts` | `1-35` | **Rewrite** | Shim extending `HeadlessWebPart`, `createAdapter()` returns `createSvelteAdapter`. Preserve `SvelteWebPartComponent<TProps>` interface at `:1-7`. |
| 2.12 | `/Volumes/New Volume/code/spfx/packages/framework-react/src/headless.ts` | **new** | **Create** | `createReactAdapter<TProps>(renderComponent: (props:TProps)=>React.ReactNode)` with `WeakMap<HTMLElement,Root>` from `react-dom/client`. `mount` creates `createRoot(root).render(...)`, `update` reuses `root.render`, `unmount` `root.unmount()`. ~28 LOC. |
| 2.13 | `/Volumes/New Volume/code/spfx/packages/framework-react/src/webpart.ts` | `?` | **Rewrite** | Shim analogous. |
| 2.14 | `/Volumes/New Volume/code/spfx/packages/framework-vue/src/headless.ts` | **new** | **Create** | `createVueAdapter<TProps>(factory)` with `createApp`/`app.mount`/`app.unmount`, WeakMap `HTMLElement→App`. ~28 LOC. |
| 2.15 | `/Volumes/New Volume/code/spfx/packages/framework-vue/src/webpart.ts` | `?` | **Rewrite** | Shim. |
| 2.16 | `/Volumes/New Volume/code/spfx/packages/framework-preact/src/headless.ts` | **new** | **Create** | `createPreactAdapter` with `render(vnode, root)`/`render(null, root)` pattern. ~22 LOC. |
| 2.17 | `/Volumes/New Volume/code/spfx/packages/framework-preact/src/webpart.ts` | `?` | **Rewrite** | Shim. |
| 2.18 | `/Volumes/New Volume/code/spfx/packages/framework-vanilla/src/headless.ts` | **new** | **Create** | `createVanillaAdapter` with `replaceChildren` logic. ~18 LOC. |
| 2.19 | `/Volumes/New Volume/code/spfx/packages/framework-vanilla/src/webpart.ts` | `?` | **Rewrite** | Shim. |
| 2.20 | `/Volumes/New Volume/code/spfx/packages/fluent-adapter/src/index.ts` | `1-?` | **Modify** | Change `FluentWebPart<TProps> extends ReactWebPart` to `extends HeadlessWebPart` or to `defineWebPart` with `createFluentAdapter` that wraps `createReactAdapter` + `ThemeProvider` sync at `sharepoint-runtime/src/theme.ts:1`. Keep theme wiring. |
| 2.21 | `/Volumes/New Volume/code/spfx/packages/sharepoint-runtime/src/context.ts` | `1-?` | **Modify** | Add `export function createHeadlessContext(spContext: WebPartContextLike & {domElement?:HTMLElement}, root:HTMLElement): HeadlessContext` mapping `spContext.themeProvider`, `spContext.pageContext` culture. Used by `webpart-base` factory closure. |
| 2.22 | `/Volumes/New Volume/code/spfx/packages/sharepoint-runtime/src/theme.ts` | `?` | **Modify** | Export `createThemeAdapter` for Fluent integration; no break. |
| 2.23 | `/Volumes/New Volume/code/spfx/packages/dev-runtime/src/local-page.ts` | `40-147` | **Modify** | Import `createVanillaAdapter`/`createReactAdapter` etc. for local preview without SPFx host: mount adapter directly into `#root` of preview page. Add `renderHeadlessPreview(root, adapter, props)`. No lifecycle needed. |
| 2.24 | `/Volumes/New Volume/code/spfx/packages/core/src/context.ts` | `1-?` | **Modify** | Add `HeadlessContext` helpers (or keep in `headless.ts` and re-export). Ensure `ThemeProvider`/`ISpfxTheme` types stay zero-deps. |
| 2.25 | `/Volumes/New Volume/code/spfx/packages/core/src/platform.ts` | `20-28` | **No change** | Verify `isPlatformOnlyModule` still typed via Phase 1 `PlatformPrefix`; headless adapters don't touch externals. |
| 2.26 | `/Volumes/New Volume/code/spfx/tsconfig.base.json` | `22-42` | **Verify** | Add alias for `@mbsks/rspfx-webpart-base` to `paths` block at `23-40`. Keep `paths:{}` empty in each `packages/*/tsconfig.build.json`. |
| 2.27 | `/Volumes/New Volume/code/spfx/docs/architecture.md` | `38` | **Docs** | Update Package map row: `core` foundation — no `BaseWebPart`; new row `webpart-base | foundation | core + @microsoft/sp-webpart-base | HeadlessWebPart, defineWebPart`. |
| 2.28 | `/Volumes/New Volume/code/spfx/docs/frameworks.md` | `1-115` | **Docs** | Rewrite Mount semantics `12-34` to headless adapter table (`adapter mount/update/unmount`), add HeadlessAdapter contract code block, update Package layout `36-49` to list three entries per framework: `preset` (index), `headless` (adapter), `webpart` (thin binding). |
| 2.29 | `/Volumes/New Volume/code/spfx/docs/internal-api.md` | `?` | **Docs** | Add `@mbsks/rspfx-webpart-base` surface (`defineWebPart`, `HeadlessWebPart`, `HeadlessAdapter`) and per-framework `createXAdapter` signatures. |
| 2.30 | `/Volumes/New Volume/code/spfx/packages/templates/src/index.ts` | `?` | **Modify** | Scaffold new `defineWebPart` shape in templates: generated `HelloWebPart.ts` uses `defineWebPart({adapterFactory:()=>createXAdapter(...)})` not `class extends XWebPart`. Keep `XWebPart` option behind flag for migration demo. |

No file move in `compiler-rspack` or `plugin` kernels; `webpart-base` does not depend on bundler.

---

## 2.4 Ordered Implementation Steps

1. **Create `core/src/headless.ts` contract first** (`/Volumes/New Volume/code/spfx/packages/core/src/headless.ts:1`): define `HeadlessAdapter<TProps>`, `PropsSelector`, `HeadlessContext`. Add shims for `ThemeProvider`/`EnvironmentType` re-export. Run `pnpm typecheck` — no runtime change. Verify `core` still zero-deps (`grep -r "from '@microsoft" packages/core/src` must be 0 after step 2).
2. **Scaffold `@mbsks/rspfx-webpart-base` package** (`/Volumes/New Volume/code/spfx/packages/webpart-base/package.json:1`, `src/index.ts:1`, `src/define.ts:1`): implement `HeadlessWebPart` class (import `@microsoft/sp-webpart-base` via `as unknown as` cast same as `base-web-part.ts:4-7`), `defineWebPart`. Add `tsconfig.build.json` with `extends ../../tsconfig.base.json`, `paths:{}` empty. Run `pnpm build --filter @mbsks/rspfx-webpart-base`.
3. **Extract framework adapters — Vanilla first (lowest risk)** (`/Volumes/New Volume/code/spfx/packages/framework-vanilla/src/headless.ts:1`): implement `createVanillaAdapter`, add `headless` export to `package.json` `exports: { "./headless": "./dist/headless.js", "./webpart": "./dist/webpart.js" }`. Keep `webpart.ts` shim extending `HeadlessWebPart`. Test via `pnpm test -- framework-vanilla` mount into `jsdom` `div` with fake props. ~0.5d.
4. **Solid + Svelte adapters** (`framework-solid/src/headless.ts:1`, `framework-svelte/src/headless.ts:1`): same pattern; preserve WeakMap per-module scoping. Run `pnpm test` with `vitest` `jsdom` environment for `webpart.test.ts` per framework. ~1d.
5. **React + Vue + Preact adapters** (`framework-react/src/headless.ts:1`, etc.): React's `WeakMap<Root>` must handle `createRoot` idempotence; Vue `createApp(...).mount`/`unmount`; Preact `render`. Add `headless.test.ts` per package asserting `mount → DOM contains component`, `update → props flow`, `unmount → empty`, `remount → no leak` (WeakMap size 0 after unmount). ~1d.
6. **Wire `core/src/base-web-part.ts` shim** (`core/src/base-web-part.ts:1-26`): replace body with deprecated re-export from `webpart-base`; add `warnOnce('BaseWebPart moved to @mbsks/rspfx-webpart-base')` gated via `process.env.RSPFX_LOG_LEVEL !== 'silent'`. Keep `core/src/webpart.ts:1` barrel for backward import. Run `pnpm typecheck` — expect deprecated warnings, no errors.
7. **Update `sharepoint-runtime/context.ts` + `dev-runtime/local-page.ts:40`** (`sharepoint-runtime/src/context.ts:1`, `dev-runtime/src/local-page.ts:40`): add `createHeadlessContext`, use adapters in local preview. Verify `rspfx dev --mode local` still serves preview without SPFx host by mounting `createVanillaAdapter` directly. ~0.5d.
8. **Update `fluent-adapter`** (`fluent-adapter/src/index.ts:1`): migrate `FluentWebPart` to `defineWebPart` + `createFluentAdapter`. Test theme sync via `ThemeProvider.addChangeListener`.
9. **Template & docs** (`templates/src/index.ts:1`, `docs/frameworks.md:12`, `docs/architecture.md:38`): switch scaffold to `defineWebPart` output; update Package map; add Agent Note at `.agents/notes/implemented/headless/2026-08-24-headless-adapter.md` with header `# Agent Note: Headless Adapter` per `docs/AGENTS.md:Verfication`.
10. **Local verification gate** (`pnpm build && pnpm typecheck && pnpm test`): ensure `core` zero-deps (`grep dependencies packages/core/package.json` empty), `apps/cli` builds, `parity.test.ts` still byte-identical (no kernel change), `bench/bench.mjs:59` cold start unchanged (headless is runtime-only, no bundler diff). Capture `reference/baseline-headless.json` diff vs 0.1.0-baseline.

---

## 2.5 Types / Data Structures to Introduce

```ts
// /Volumes/New Volume/code/spfx/packages/core/src/headless.ts:1
export interface HeadlessAdapter<TProps extends Record<string,unknown>> {
  /** Mount component with initial props into root. */
  mount(root: HTMLElement, props: TProps): void;
  /** Update mounted component; default is unmount+mount but frameworks may diff. */
  update(root: HTMLElement, props: TProps): void;
  /** Unmount and clean disposers/listeners. */
  unmount(root: HTMLElement): void;
}
export type PropsSelector<TProps, TRaw = Record<string,unknown>> = (
  raw: TRaw,
  ctx: HeadlessContext
) => TProps;
export interface HeadlessContext {
  readonly domElement: HTMLElement;
  readonly theme: ISpfxTheme | undefined;        // from core/src/context.ts:1
  readonly themeProvider?: ThemeProvider;
  readonly environment: EnvironmentType;         // from core/src/environment.ts:1
  readonly cultureName: string;                 // resolved via PlatformPrefix l10n
  readonly manifestId: ComponentId;             // Phase 1 ComponentId brand
}
export interface HeadlessWebPartOptions<TProps> {
  readonly adapter: HeadlessAdapter<TProps>;
  readonly selector?: PropsSelector<TProps>;
  readonly displayName?: string;
}

// /Volumes/New Volume/code/spfx/packages/webpart-base/src/index.ts:1
import type { HeadlessAdapter } from '@mbsks/rspfx-core/headless';
export abstract class HeadlessWebPart<TProps extends Record<string,unknown>> extends BaseClientSideWebPart<TProps> {
  protected abstract createAdapter(): HeadlessAdapter<TProps>;
  protected getComponentProps(): TProps;
  protected updateProps(next: TProps): void;
}
export function defineWebPart<const TProps extends Record<string,unknown>>(opts:{
  adapterFactory: (host:{ domElement: HTMLElement; context: HeadlessContext }) => HeadlessAdapter<TProps>;
  selector?: PropsSelector<TProps>;
  displayName?: string;
}): new () => HeadlessWebPart<TProps>;

// /Volumes/New Volume/code/spfx/packages/framework-solid/src/headless.ts:1
export function createSolidAdapter<TProps>(
  renderComponent:(props:TProps)=> import('solid-js').JSX.Element
): HeadlessAdapter<TProps>;

// /Volumes/New Volume/code/spfx/packages/framework-svelte/src/headless.ts:1
export interface SvelteWebPartComponent<TProps> {
  component: new (opts: import('svelte').ComponentConstructorOptions<TProps>) => import('svelte').SvelteComponentTyped<TProps>;
  props: TProps;
}
export function createSvelteAdapter<TProps>(
  factory:(props:TProps)=> SvelteWebPartComponent<TProps>
): HeadlessAdapter<TProps>;

// /Volumes/New Volume/code/spfx/packages/framework-react/src/headless.ts:1
export function createReactAdapter<TProps>(
  renderComponent:(props:TProps)=> import('react').ReactNode
): HeadlessAdapter<TProps>;

// adapters share WeakMap bookkeeping internally, not exported:
// const disposers: WeakMap<HTMLElement, ()=>void>; // solid
// const instances: WeakMap<HTMLElement, SvelteComponentTyped>; // svelte
// const roots: WeakMap<HTMLElement, import('react-dom/client').Root>; // react
```

Zero runtime cost in `core`; `webpart-base` is the only SPFx-dependent package. Adapter `update` is Rust-ownership-inspired: `mount` takes ownership of `root`, `unmount` releases it, `update` borrows.

---

## 2.6 Migration Notes for Consumers

**If you `extends ReactWebPart` / `SolidWebPart` etc.:**

```ts
// before
import { ReactWebPart } from '@mbsks/rspfx-framework-react/webpart';
export default class HelloWebPart extends ReactWebPart<{ name: string }> {
  protected renderComponent(props:{name:string}){ return <Hello name={props.name} /> }
}

// after — option A (shim still works, deprecated, one major)
import { ReactWebPart } from '@mbsks/rspfx-framework-react/webpart'; // still works, but logs warn once
// no code change required, but type now HeadlessWebPart

// after — option B (recommended headless)
import { defineWebPart } from '@mbsks/rspfx-webpart-base';
import { createReactAdapter } from '@mbsks/rspfx-framework-react/headless';
export default defineWebPart<{name:string}>({
  adapterFactory: () => createReactAdapter<{name:string}>((props)=> <Hello {...props} />),
});
```

**If you import from `core/webpart`:**

```ts
// before
import { BaseWebPart } from '@mbsks/rspfx-core/webpart';
// after
import { HeadlessWebPart, defineWebPart } from '@mbsks/rspfx-webpart-base';
// or for one major:
import { BaseWebPart } from '@mbsks/rspfx-core/webpart'; // deprecated shim, warns once
```

**If you test adapters off-DOM (new capability):**

```ts
import { createSolidAdapter } from '@mbsks/rspfx-framework-solid/headless';
const root = document.createElement('div');
const adapter = createSolidAdapter<{name:string}>((p)=> <Hello name={p.name} />);
adapter.mount(root, {name:'a'});
expect(root.textContent).toContain('a');
adapter.update(root, {name:'b'});
expect(root.textContent).toContain('b');
adapter.unmount(root);
expect(root.children.length).toBe(0);
```

**If you used `getComponentProps` to transform `this.properties`:**

```ts
// before: override getComponentProps() inside class
protected getComponentProps(){ return { name: this.properties.title.toUpperCase() }; }

// after: selector passed to defineWebPart
defineWebPart<{name:string}>({
  adapterFactory: ()=> createSolidAdapter(...),
  selector: (raw)=> ({ name: (raw as {title:string}).title.toUpperCase() }),
});
```

Provide codemod at `scripts/migrate-headless.mjs` (Phase 8 will integrate with `rspfx migrate --to 0.1`) that rewrites `extends SolidWebPart` → `defineWebPart` + `createSolidAdapter`.

---

## 2.7 Exit Criteria (Functional, No CI)

- [ ] `grep -r "from '@microsoft/sp-webpart-base'" packages/core/src --include="*.ts"` → **0** results; `packages/core/package.json` has no `dependencies`/`peerDependencies` on `@microsoft/*` (zero-deps holds). `packages/webpart-base/package.json` has `"@microsoft/sp-webpart-base"` peer.
- [ ] `pnpm build` emits `packages/core/dist/headless.js`, `packages/webpart-base/dist/index.js` + `define.js`, and each `framework-*/dist/headless.js` as ESM with `.js` imports; `pnpm typecheck` passes with `strict:true`.
- [ ] All 6 frameworks export both `./webpart` (shim) and `./headless` (adapter) subpaths; `import { createSolidAdapter } from '@mbsks/rspfx-framework-solid/headless'` typechecks and mounts in `jsdom` test without SPFx host.
- [ ] `framework-solid/src/headless.ts` + `framework-svelte/src/headless.ts` etc. contain `WeakMap` disposal, not global `let` ; `webpart.ts` shims contain `extends HeadlessWebPart` and `createAdapter()` only.
- [ ] Deprecated `import { BaseWebPart } from '@mbsks/rspfx-core/webpart'` still compiles but emits `warn` once via `diagnostics/logger.ts:42` → `process.stderr` string `"deprecated: use @mbsks/rspfx-webpart-base"`.
- [ ] `dev-runtime` local preview (`pnpm --filter @mbsks/rspfx-dev-runtime build`) mounts headless adapter into preview page when `rspfx dev --mode local` — manual smoke: `http://localhost:4321/` shows vanilla/react/solid/svelte fixture without SPFx workbench.
- [ ] `pnpm test` passes including new `packages/framework-*/tests/headless.test.ts` (mount/update/unmount lifecycle) and `packages/webpart-base/tests/define.test.ts` (selector + theme injection). No new `singleFork` requirement.
- [ ] Parity suite `packages/plugin/tests/parity.test.ts` byte-identical across three bundlers (headless is runtime, not kernel) — `release/manifests` hashes match `reference/parity-0.0.13.hashes.json`.
- [ ] Size audit: `examples/shadcn/dist/*.js` + `templates/dist` unchanged beyond `webpart-base` additive chunk (~2kB) — `reference/sizes-headless.json` recorded.
- [ ] Docs updated: `docs/architecture.md:38` Package map shows `webpart-base`, `docs/frameworks.md:12` describes `HeadlessAdapter` contract, `docs/internal-api.md` lists `createXAdapter`.

---

## 2.8 Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **SPFx `BaseClientSideWebPart` generics drift** — `@microsoft/sp-webpart-base` at `1.20` vs `1.23` has different `onInit():Promise<void>` vs `onInit():Promise<void>\|void` | High | `webpart-base` pins `peerDependencies: "@microsoft/sp-webpart-base": "^1.20.0 \|\| ^1.21.0 \|\| ^1.22.0 \|\| ^1.23.0"` and tests `onInit` override signature with `satisfies` against both versions. Keep `as unknown as` cast isolated to `webpart-base/src/index.ts:4-7` single file. |
| **Breaking every `extends XWebPart` in one commit** | High | Keep `framework-*/src/webpart.ts` shim that `extends HeadlessWebPart` and delegates to `createXAdapter` via `this.renderComponent`. Add `@deprecated` JSDoc linking to `defineWebPart`. Remove shim only in next major. Provide codemod `scripts/migrate-headless.mjs`. |
| **WeakMap memory leak across hot reload** — `disposers`/`instances`/`roots` maps retain after `update` | Medium | `update` always `disposers.get(root)?.()` before re-`render`; `unmount` always `delete`. Add `headless.test.ts` asserting `WeakMap` empty after `unmount` (via `jsdom` + `FinalizationRegistry` smoke). |
| **Svelte 4 vs 5 `$destroy`/`mount`/`unmount` dual path** — `SvelteComponentTyped<TProps>` at `framework-svelte/src/webpart.ts:2` types `svelte` 4, but Phase 7 will need `mount`/`unmount` from `svelte` 5 | Medium | Adapter checks `if ('$destroy' in instance) instance.$destroy() else (await import('svelte')).unmount(instance)`; keep both. Test matrix pinned `svelte@4` baseline, `svelte@5` tried locally. |
| **React `createRoot` called twice on same `root` (StrictMode double mount)** | High | Keep per-`root` `WeakMap<HTMLElement,Root>` at `headless.ts:3`; `mount` if `roots.has(root)` reuses `roots.get(root)!.render(...)` else `createRoot(root)`. Add `mount twice` test. |
| **Core zero-deps re-break by accidental import** | High | Add local guard script `scripts/check-zero-deps.mjs:1` (not CI, local `pnpm build` pre-check) that asserts `grep -r "from '@" packages/core/src --include="*.ts"` only hits `headless.ts` type-only imports? Actually Phase 0 guard stays local — `core` must have zero deps; review checklist blocks merge if `core/src/*.ts` imports `@microsoft` or `@mbsks`. |
| **`defineWebPart` loses `context` typing for property pane** — `IPropertyPaneConfiguration` still lives in `@microsoft/sp-property-pane` | Low | `webpart-base` re-exports `IPropertyPaneConfiguration` type from `@microsoft/sp-webpart-base` (peer) but `core` keeps `Version`/`PropertyPaneFieldType` enums. Consumer that configures property pane imports from `webpart-base` not `core`. Document in `docs/internal-api.md`. |

---

## 2.9 Effort Estimate

**8 days single engineer; ~5 days with two engineers (adapter + package in parallel):**

* Day 1: `core/src/headless.ts` contract + `webpart-base` package scaffold + `tsconfig.build.json` wiring (1d). Parallelizable with Vanilla adapter.
* Day 2: Vanilla + Solid + Svelte adapters + `headless.test.ts` (1.5d). Engineer B takes React+Vue+Preact simultaneously.
* Day 3: React+Vue+Preact adapters + WeakMap/React root tests (1d). Sync with Engineer's shims.
* Day 4: Rewrite all 6 `webpart.ts` shims + `sharepoint-runtime/context.ts` + `dev-runtime/local-page.ts` (1d).
* Day 5: `fluent-adapter` + `defineWebPart` factory + selector wiring (1d).
* Day 6: Templates + docs (`frameworks.md`, `architecture.md`, `internal-api.md`) + Agent Note (0.5d) + codemod stub (0.5d).
* Day 7–8: Verification — `pnpm build` ESM `.js` imports, `pnpm typecheck` strict, `pnpm test` jsdom mount matrix, `parity.test.ts` hash diff, `core` zero-deps audit, preview manual smoke, review (1.5d).

Parallel split: Engineer A — `headless` contract + `webpart-base` + Vanilla/Solid/Svelte; Engineer B — React/Vue/Preact adapters + shims + runtime wiring.
