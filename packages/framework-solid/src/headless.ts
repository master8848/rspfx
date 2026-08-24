import { createRoot, createSignal, getOwner } from 'solid-js';
import type { JSX, Owner, Setter } from 'solid-js';
import { render } from 'solid-js/web';
import type { HeadlessAdapter } from '@mbsks/rspfx-core/headless';

type SolidEntry<TProps> = { dispose: () => void; setProps: Setter<TProps>; owner: Owner };

export function createSolidAdapter<TProps extends Record<string, unknown>>(
  renderComponent: (props: TProps) => JSX.Element
): HeadlessAdapter<TProps> {
  const entries = new WeakMap<HTMLElement, SolidEntry<TProps>>();
  return {
    mount(root, props) {
      const existing = entries.get(root);
      if (existing) {
        const before = root.textContent;
        existing.setProps(() => props);
        if (root.textContent === before) {
          try {
            existing.dispose();
          } catch {}
          entries.delete(root);
        } else {
          return;
        }
      }
      createRoot((disposeRoot) => {
        const [signal, setSignal] = createSignal<TProps>(props, { equals: false });
        const disposeRender = render(() => renderComponent(signal()), root);
        entries.set(root, {
          dispose: () => {
            try {
              disposeRender();
            } catch {}
            disposeRoot();
          },
          setProps: setSignal,
          owner: getOwner()!
        });
      });
    },
    update(root, props) {
      const existing = entries.get(root);
      if (existing) {
        const before = root.textContent;
        existing.setProps(() => props);
        if (root.textContent !== before) return;
        try {
          existing.dispose();
        } catch {}
        entries.delete(root);
      }
      createRoot((disposeRoot) => {
        const [signal, setSignal] = createSignal<TProps>(props, { equals: false });
        const disposeRender = render(() => renderComponent(signal()), root);
        entries.set(root, {
          dispose: () => {
            try {
              disposeRender();
            } catch {}
            disposeRoot();
          },
          setProps: setSignal,
          owner: getOwner()!
        });
      });
    },
    unmount(root) {
      const entry = entries.get(root);
      if (entry) {
        entry.dispose();
        entries.delete(root);
      }
    }
  };
}
