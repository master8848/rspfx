import type { FrameworkAdapter, FrameworkPreset, FrameworkRspackContributions } from '@mbsks/rspfx-plugin-api';
import { createApp, type App as VueApp, type Component } from 'vue';
import { VueLoaderPlugin } from 'vue-loader';

const apps = new WeakMap<HTMLElement, VueApp>();
const components = new WeakMap<HTMLElement, Component>();

const adapter: FrameworkAdapter = {
  name: 'vue',
  mount(root: HTMLElement, component: unknown): void {
    const vueComponent = component as Component;
    const app = createApp(vueComponent);
    components.set(root, vueComponent);
    apps.set(root, app);
    app.mount(root);
  },
  unmount(root: HTMLElement): void {
    const app = apps.get(root);
    if (app) {
      app.unmount();
      apps.delete(root);
      components.delete(root);
    }
  },
  update(root: HTMLElement): void {
    const app = apps.get(root);
    const component = components.get(root);
    if (app && component) {
      app.unmount();
      const next = createApp(component);
      apps.set(root, next);
      next.mount(root);
    }
  },
  supportsFastRefresh(): boolean {
    return true;
  }
};

export { adapter };

export const preset: FrameworkPreset = {
  name: 'vue',
  adapter(): FrameworkAdapter {
    return adapter;
  },
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions {
    return {
      rules: [{ test: /\.vue$/, use: 'vue-loader' }],
      plugins: [new VueLoaderPlugin()],
      resolve: { extensions: ['.vue'] }
    };
  }
};
