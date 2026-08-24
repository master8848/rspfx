import type { HeadlessAdapter } from '@mbsks/rspfx-core/headless';

export function createVanillaAdapter<TProps extends Record<string, unknown>>(
  render: (props: TProps) => HTMLElement | string,
): HeadlessAdapter<TProps> {
  return {
    mount(root, props) {
      const node = render(props);
      root.replaceChildren(typeof node === 'string' ? document.createTextNode(node) : node);
    },
    update(root, props) {
      const node = render(props);
      root.replaceChildren(typeof node === 'string' ? document.createTextNode(node) : node);
    },
    unmount(root) {
      root.replaceChildren();
    },
  };
}
