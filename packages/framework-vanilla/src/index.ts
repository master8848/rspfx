import type { FrameworkAdapter, FrameworkPreset, FrameworkRspackContributions } from '@mbsks/rspfx-plugin-api';

const adapter: FrameworkAdapter = {
  name: 'vanilla',
  mount(root: HTMLElement, component: unknown): void {
    const node = component as HTMLElement | string;
    if (typeof node === 'string') {
      root.insertAdjacentHTML('beforeend', node);
    } else {
      root.appendChild(node);
    }
  },
  unmount(root: HTMLElement): void {
    root.replaceChildren();
  },
  update(): void {},
  supportsFastRefresh(): boolean {
    return false;
  }
};

export { adapter };

export const preset: FrameworkPreset = {
  name: 'vanilla',
  adapter(): FrameworkAdapter {
    return adapter;
  },
  contributions(): FrameworkRspackContributions {
    return {};
  }
};
