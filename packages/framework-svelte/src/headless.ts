// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Svelte 5 Component type only exists in Svelte 5; Svelte 4 builds fallback to any
import type { Component as Svelte5Component } from 'svelte';
import type { ComponentConstructorOptions, SvelteComponentTyped } from 'svelte';
import type { HeadlessAdapter } from '@mbsks/rspfx-core/headless';
import * as svelteRuntime from 'svelte';

type Svelte4Component<TProps extends Record<string, unknown>> = new (
  options: ComponentConstructorOptions<TProps>
) => SvelteComponentTyped<TProps>;

export type SvelteComponent<TProps extends Record<string, unknown>> =
  | Svelte4Component<TProps>
  | Svelte5Component<TProps>;

export interface SvelteWebPartComponent<TProps extends Record<string, unknown>> {
  component: SvelteComponent<TProps>;
  props: TProps;
}

const svelteAny = svelteRuntime as unknown as {
  mount?: (component: unknown, opts: { target: HTMLElement; props: unknown }) => unknown;
  unmount?: (instance: unknown) => void;
};

const isSvelte5 = typeof svelteAny.mount === 'function' && typeof svelteAny.unmount === 'function';

export function createSvelteAdapter<TProps extends Record<string, unknown>>(
  factory: (props: TProps) => SvelteWebPartComponent<TProps>
): HeadlessAdapter<TProps> {
  const instances = new WeakMap<HTMLElement, unknown>();
  return {
    mount(root, props) {
      const prev = instances.get(root);
      if (prev) {
        const maybe = prev as { $set?: (p: TProps) => void; $destroy?: () => void };
        try {
          if (maybe.$set) {
            maybe.$set(factory(props).props);
            return;
          }
        } catch {}
        if (isSvelte5) {
          try {
            svelteAny.unmount?.(prev);
          } catch {}
        } else {
          try {
            maybe.$destroy?.();
          } catch {}
        }
        instances.delete(root);
      }
      const { component, props: p } = factory(props);
      const instance = isSvelte5
        ? svelteAny.mount!(component as Svelte5Component<TProps>, { target: root, props: p })
        : new (component as Svelte4Component<TProps>)({ target: root, props: p });
      instances.set(root, instance);
    },
    update(root, props) {
      const prev = instances.get(root);
      if (prev) {
        const maybe = prev as { $set?: (p: TProps) => void; $destroy?: () => void };
        try {
          if (maybe.$set) {
            maybe.$set(props);
            return;
          }
        } catch {}
        if (isSvelte5) {
          try {
            svelteAny.unmount?.(prev);
          } catch {}
        } else {
          try {
            maybe.$destroy?.();
          } catch {}
        }
        instances.delete(root);
      }
      const { component, props: p } = factory(props);
      const instance = isSvelte5
        ? svelteAny.mount!(component as Svelte5Component<TProps>, { target: root, props: p })
        : new (component as Svelte4Component<TProps>)({ target: root, props: p });
      instances.set(root, instance);
    },
    unmount(root) {
      const inst = instances.get(root);
      if (inst) {
        if (isSvelte5) {
          try {
            svelteAny.unmount?.(inst);
          } catch {}
        } else {
          try {
            (inst as { $destroy?: () => void }).$destroy?.();
          } catch {}
        }
        instances.delete(root);
      }
    }
  };
}
