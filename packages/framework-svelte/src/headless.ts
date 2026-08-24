import type { ComponentConstructorOptions, SvelteComponentTyped } from 'svelte';
import type { HeadlessAdapter } from '@mbsks/rspfx-core/headless';

export interface SvelteWebPartComponent<TProps extends Record<string, unknown>> {
  component: new (options: ComponentConstructorOptions<TProps>) => SvelteComponentTyped<TProps>;
  props: TProps;
}

export function createSvelteAdapter<TProps extends Record<string, unknown>>(
  factory: (props: TProps) => SvelteWebPartComponent<TProps>,
): HeadlessAdapter<TProps> {
  const instances = new WeakMap<HTMLElement, SvelteComponentTyped<Record<string, unknown>>>();
  return {
    mount(root, props) {
      const prev = instances.get(root);
      if (prev) {
        if ('$destroy' in prev && typeof (prev as unknown as { $destroy: () => void }).$destroy === 'function') {
          (prev as unknown as { $destroy: () => void }).$destroy();
        }
      }
      const { component, props: p } = factory(props);
      const instance = new component({ target: root, props: p }) as unknown as SvelteComponentTyped<Record<string, unknown>>;
      instances.set(root, instance);
    },
    update(root, props) {
      const prev = instances.get(root);
      if (prev) {
        if ('$destroy' in prev && typeof (prev as unknown as { $destroy: () => void }).$destroy === 'function') {
          (prev as unknown as { $destroy: () => void }).$destroy();
        }
      }
      const { component, props: p } = factory(props);
      const instance = new component({ target: root, props: p }) as unknown as SvelteComponentTyped<Record<string, unknown>>;
      instances.set(root, instance);
    },
    unmount(root) {
      const inst = instances.get(root);
      if (inst) {
        if ('$destroy' in inst && typeof (inst as unknown as { $destroy: () => void }).$destroy === 'function') {
          (inst as unknown as { $destroy: () => void }).$destroy();
        }
        instances.delete(root);
      }
    },
  };
}
