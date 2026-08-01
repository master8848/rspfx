import type { FrameworkAdapter, FrameworkPreset, FrameworkRspackContributions } from '@mbsks/rspfx-plugin-api';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactElement } from 'react';
import ReactRefreshRspackPlugin from '@rspack/plugin-react-refresh';

const roots = new WeakMap<HTMLElement, Root>();
const components = new WeakMap<HTMLElement, ReactElement>();

const adapter: FrameworkAdapter = {
  name: 'react',
  mount(root: HTMLElement, component: unknown): void {
    const element = component as ReactElement;
    components.set(root, element);
    let reactRoot = roots.get(root);
    if (!reactRoot) {
      reactRoot = createRoot(root);
      roots.set(root, reactRoot);
    }
    reactRoot.render(element);
  },
  unmount(root: HTMLElement): void {
    const reactRoot = roots.get(root);
    if (reactRoot) {
      reactRoot.unmount();
      roots.delete(root);
      components.delete(root);
    }
  },
  update(root: HTMLElement): void {
    const reactRoot = roots.get(root);
    const element = components.get(root);
    if (reactRoot && element) {
      reactRoot.render(element);
    }
  },
  supportsFastRefresh(): boolean {
    return true;
  }
};

export { adapter };

export const preset: FrameworkPreset = {
  name: 'react',
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
              development: opts.fastRefresh
            }
          }
        }
      },
      plugins: opts.fastRefresh ? [new ReactRefreshRspackPlugin()] : []
    };
  }
};
