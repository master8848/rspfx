import { render } from 'solid-js/web';
import type { JSX } from 'solid-js';
import type { HeadlessAdapter } from '@mbsks/rspfx-core/headless';

export function createSolidAdapter<TProps extends Record<string, unknown>>(
  renderComponent: (props: TProps) => JSX.Element,
): HeadlessAdapter<TProps> {
  const disposers = new WeakMap<HTMLElement, () => void>();
  return {
    mount(root, props) {
      const prev = disposers.get(root);
      if (prev) prev();
      const dispose = render(() => renderComponent(props), root);
      disposers.set(root, dispose);
    },
    update(root, props) {
      const prev = disposers.get(root);
      if (prev) prev();
      const dispose = render(() => renderComponent(props), root);
      disposers.set(root, dispose);
    },
    unmount(root) {
      const d = disposers.get(root);
      if (d) {
        d();
        disposers.delete(root);
      }
    },
  };
}
