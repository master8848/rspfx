import { BaseWebPart } from '@mbsks/rspfx-core/webpart';
import type { ComponentConstructorOptions, SvelteComponentTyped } from 'svelte';

export interface SvelteWebPartComponent<TProps extends Record<string, unknown>> {
  component: new (options: ComponentConstructorOptions<TProps>) => SvelteComponentTyped<TProps>;
  props: TProps;
}

const instances = new WeakMap<HTMLElement, SvelteComponentTyped<Record<string, unknown>>>();

export abstract class SvelteWebPart<TProps extends Record<string, unknown>, TState = unknown>
  extends BaseWebPart<TProps> {
  protected abstract renderComponent(props: TProps): SvelteWebPartComponent<TProps>;

  protected renderInto(root: HTMLElement): void {
    const previous = instances.get(root);
    if (previous) {
      previous.$destroy();
    }
    const { component, props } = this.renderComponent(this.getComponentProps());
    instances.set(root, new component({ target: root, props }));
  }

  protected disposeFrom(root: HTMLElement): void {
    const instance = instances.get(root);
    if (instance) {
      instance.$destroy();
      instances.delete(root);
    }
  }

  protected getComponentProps(): TProps {
    return this.properties;
  }
}
