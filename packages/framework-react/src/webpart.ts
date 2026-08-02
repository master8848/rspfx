import { BaseWebPart } from '@mbsks/rspfx-core/webpart';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactElement } from 'react';

const roots = new WeakMap<HTMLElement, Root>();

export abstract class ReactWebPart<TProps extends Record<string, unknown>, TState = unknown>
  extends BaseWebPart<TProps> {
  protected abstract renderComponent(props: TProps): ReactElement;

  protected renderInto(root: HTMLElement): void {
    const reactRoot = roots.get(root) ?? createRoot(root);
    roots.set(root, reactRoot);
    reactRoot.render(this.renderComponent(this.getComponentProps()));
  }

  protected disposeFrom(root: HTMLElement): void {
    const reactRoot = roots.get(root);
    if (reactRoot) {
      reactRoot.unmount();
      roots.delete(root);
    }
  }

  protected getComponentProps(): TProps {
    return this.properties;
  }
}
