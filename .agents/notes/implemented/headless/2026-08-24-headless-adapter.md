# Agent Note: Headless Adapter

Status: implemented

## Context

`packages/core/src/base-web-part.ts:1` imported `@microsoft/sp-webpart-base` via `as unknown as` cast, violating `ARCHITECTURE.md:102` zero-deps and leaking `IPropertyPaneConfiguration` into every `defineConfig` consumer. Framework `webpart.ts` files each duplicated WeakMap disposal (`framework-solid/src/webpart.ts:5`, `framework-svelte/src/webpart.ts:9`, `framework-react/src/webpart.ts:5`) with drift, and `BaseWebPart<TProps extends Record<string,unknown>>` constrained props to `Record` rather than Phase 1 `ComponentId` brands, making `getComponentProps` untestable off-DOM and blocking local preview (`dev-runtime/src/local-page.ts:40`).

## Decision

`packages/core/src/headless.ts` defines `HeadlessAdapter<TProps>` `{ mount, update, unmount }` plus `HeadlessContext`/`PropsSelector` with `ThemeProvider`/`EnvironmentType`/`CultureName` from `core/src/context.ts`/`environment.ts`/`newtypes.ts`. `packages/webpart-base/src/index.ts` owns `@microsoft/sp-webpart-base` and implements `HeadlessWebPart<TProps> extends SPBase<TProps>` binding `adapter.mount`/`unmount` in `render()`/`onDispose()`; `packages/webpart-base/src/define.ts` provides `defineWebPart` factory with `adapterFactory`/`selector`/`propertiesSchema`. Each framework now exports `createXAdapter` in `src/headless.ts` (React `WeakMap<Root>`, Solid `WeakMap<()=>void>`, Svelte `WeakMap<SvelteComponentTyped>`, Vue `WeakMap<App>`, Vanilla `replaceChildren`, Preact `render`) plus thin `src/webpart.ts` shim `extends HeadlessWebPart` delegating via `createXAdapter`. `packages/core/src/base-web-part.ts` is a deprecated re-export with `console.warn` once; `packages/sharepoint-runtime/src/context.ts` adds `createHeadlessContext`; `packages/dev-runtime/src/local-page.ts` adds `renderHeadlessPreview`.

## Consequences

`core` is zero-deps (`grep -r "@microsoft/sp-webpart-base" packages/core/src` is 0, `packages/webpart-base` owns the peer). Framework adapters are testable off-DOM (`createSolidAdapter(...).mount(fakeDiv, props)`). `defineWebPart` replaces `extends XWebPart` subclassing, and `dev-runtime` local preview can mount adapters without SPFx host. Compat shims remain for one major (`framework-*/webpart` deprecated, `core/webpart` re-export warns). Fact homes: `docs/architecture.md` package map, `docs/frameworks.md` adapter contract, `docs/internal-api.md` `HeadlessAdapter`/`createXAdapter` surfaces.
