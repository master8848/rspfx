import type { ComponentConstructorOptions, SvelteComponentTyped } from 'svelte';

declare module '*.svelte' {
  const component: new (
    options: ComponentConstructorOptions<Record<string, unknown>>
  ) => SvelteComponentTyped<Record<string, unknown>>;
  export default component;
}
