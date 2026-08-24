import { render, type ComponentChild } from 'preact';
import type { HeadlessAdapter } from '@mbsks/rspfx-core/headless';

export function createPreactAdapter<TProps extends Record<string, unknown>>(
  renderComponent: (props: TProps) => ComponentChild,
): HeadlessAdapter<TProps> {
  return {
    mount(root, props) {
      render(renderComponent(props), root);
    },
    update(root, props) {
      render(renderComponent(props), root);
    },
    unmount(root) {
      render(null, root);
    },
  };
}
