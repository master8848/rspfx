import type { FrameworkAdapter, FrameworkPreset, FrameworkRspackContributions } from '@mbsks/rspfx-plugin-api';
import { render } from 'solid-js/web';
import type { JSX } from 'solid-js';

const disposers = new WeakMap<HTMLElement, () => void>();

const adapter: FrameworkAdapter = {
  name: 'solid',
  mount(root: HTMLElement, component: unknown): void {
    const previous = disposers.get(root);
    if (previous) {
      previous();
    }
    const dispose = render(() => component as JSX.Element, root);
    disposers.set(root, dispose);
  },
  unmount(root: HTMLElement): void {
    const dispose = disposers.get(root);
    if (dispose) {
      dispose();
      disposers.delete(root);
    }
  },
  update(): void {},
  supportsFastRefresh(): boolean {
    return false;
  }
};

export { adapter };

export const preset: FrameworkPreset = {
  name: 'solid',
  adapter(): FrameworkAdapter {
    return adapter;
  },
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions {
    return {
      rules: [
        {
          test: /\.(t|j)sx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [['babel-preset-solid', { generate: 'dom' }]],
              plugins: []
            }
          }
        }
      ]
    };
  }
};
