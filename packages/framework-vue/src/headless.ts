import { createApp, type App as VueApp, type Component } from 'vue';
import type { HeadlessAdapter } from '@mbsks/rspfx-core/headless';

export function createVueAdapter<TProps extends Record<string, unknown>>(
  factory: (props: TProps) => Component,
): HeadlessAdapter<TProps> {
  const apps = new WeakMap<HTMLElement, VueApp>();
  return {
    mount(root, props) {
      const prev = apps.get(root);
      if (prev) prev.unmount();
      const app = createApp(factory(props));
      apps.set(root, app);
      app.mount(root);
    },
    update(root, props) {
      const prev = apps.get(root);
      if (prev) prev.unmount();
      const app = createApp(factory(props));
      apps.set(root, app);
      app.mount(root);
    },
    unmount(root) {
      const app = apps.get(root);
      if (app) {
        app.unmount();
        apps.delete(root);
      }
    },
  };
}
