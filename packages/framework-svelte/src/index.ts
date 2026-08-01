import type { FrameworkAdapter, FrameworkPreset, FrameworkRspackContributions } from '@mbsks/rspfx-plugin-api';

interface SvelteInstance {
  $set(props: Record<string, unknown>): void;
  $destroy(): void;
}

interface SvelteConfig {
  component: new (options: { target: HTMLElement; props: Record<string, unknown> }) => SvelteInstance;
  props: Record<string, unknown>;
}

interface SvelteEntry {
  instance: SvelteInstance;
  config: SvelteConfig;
}

const entries = new WeakMap<HTMLElement, SvelteEntry>();

const adapter: FrameworkAdapter = {
  name: 'svelte',
  mount(root: HTMLElement, component: unknown): void {
    const config = component as SvelteConfig;
    const instance = new config.component({ target: root, props: config.props });
    entries.set(root, { instance, config });
  },
  unmount(root: HTMLElement): void {
    const entry = entries.get(root);
    if (entry) {
      entry.instance.$destroy();
      entries.delete(root);
    }
  },
  update(root: HTMLElement): void {
    const entry = entries.get(root);
    if (entry) {
      entry.instance.$set(entry.config.props);
    }
  },
  supportsFastRefresh(): boolean {
    return true;
  }
};

export { adapter };

export const preset: FrameworkPreset = {
  name: 'svelte',
  adapter(): FrameworkAdapter {
    return adapter;
  },
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions {
    return {
      rules: [
        {
          test: /\.svelte$/,
          use: {
            loader: 'svelte-loader',
            options: {
              hotReload: opts.fastRefresh,
              compilerOptions: { dev: opts.fastRefresh }
            }
          }
        }
      ],
      resolve: { extensions: ['.svelte'] }
    };
  }
};
