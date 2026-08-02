import { BaseWebPart } from '@mbsks/rspfx-core/webpart';
import { render } from 'solid-js/web';
import type { JSX } from 'solid-js';

const disposers = new WeakMap<HTMLElement, () => void>();

export abstract class SolidWebPart<TProps extends Record<string, unknown>, TState = unknown>
  extends BaseWebPart<TProps> {
  protected abstract renderComponent(props: TProps): JSX.Element;

  protected renderInto(root: HTMLElement): void {
    const previous = disposers.get(root);
    if (previous) {
      previous();
    }
    const dispose = render(() => this.renderComponent(this.getComponentProps()), root);
    disposers.set(root, dispose);
  }

  protected disposeFrom(root: HTMLElement): void {
    const dispose = disposers.get(root);
    if (dispose) {
      dispose();
      disposers.delete(root);
    }
  }

  protected getComponentProps(): TProps {
    return this.properties;
  }
}
