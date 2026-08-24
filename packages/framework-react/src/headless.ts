import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import type { HeadlessAdapter } from '@mbsks/rspfx-core/headless';

const roots = new WeakMap<HTMLElement, Root>();

export function createReactAdapter<TProps extends Record<string, unknown>>(
  renderComponent: (props: TProps) => ReactNode,
): HeadlessAdapter<TProps> {
  return {
    mount(root, props) {
      let reactRoot = roots.get(root);
      if (!reactRoot) {
        reactRoot = createRoot(root);
        roots.set(root, reactRoot);
      }
      reactRoot.render(renderComponent(props));
    },
    update(root, props) {
      let reactRoot = roots.get(root);
      if (!reactRoot) {
        reactRoot = createRoot(root);
        roots.set(root, reactRoot);
      }
      reactRoot.render(renderComponent(props));
    },
    unmount(root) {
      const reactRoot = roots.get(root);
      if (reactRoot) {
        reactRoot.unmount();
        roots.delete(root);
      }
    },
  };
}
