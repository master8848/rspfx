import type { FrameworkAdapter, FrameworkPreset, FrameworkRspackContributions } from '@mbsks/rspfx-plugin-api';
import { render, type ComponentChild } from 'preact';
import PreactRefreshRspackPlugin from '@rspack/plugin-preact-refresh';

const components = new WeakMap<HTMLElement, ComponentChild>();

const adapter: FrameworkAdapter = {
  name: 'preact',
  mount(root: HTMLElement, component: unknown): void {
    const element = component as ComponentChild;
    components.set(root, element);
    render(element, root);
  },
  unmount(root: HTMLElement): void {
    render(null, root);
    components.delete(root);
  },
  update(root: HTMLElement): void {
    const element = components.get(root);
    if (element !== undefined) {
      render(element, root);
    }
  },
  supportsFastRefresh(): boolean {
    return true;
  }
};

export { adapter };

export const preset: FrameworkPreset = {
  name: 'preact',
  adapter(): FrameworkAdapter {
    return adapter;
  },
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions {
    return {
      swc: {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          transform: {
            react: {
              runtime: 'automatic',
              importSource: 'preact',
              development: opts.fastRefresh
            }
          }
        }
      },
      plugins: opts.fastRefresh ? [new PreactRefreshRspackPlugin({})] : []
    };
  }
};
