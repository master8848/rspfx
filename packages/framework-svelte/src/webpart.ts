import { BaseWebPart } from '@mbsks/rspfx-core/webpart';
import type { ComponentConstructorOptions, SvelteComponentTyped } from 'svelte';
import { adapter } from './index.js';
import type { FrameworkAdapter } from '@mbsks/rspfx-plugin-api';

export interface SvelteWebPartComponent<TProps extends Record<string, unknown>> {
  component: new (options: ComponentConstructorOptions<TProps>) => SvelteComponentTyped<TProps>;
  props: TProps;
}


export abstract class SvelteWebPart<TProps extends Record<string, unknown>, TState = unknown>
  extends BaseWebPart<TProps> {
  protected abstract renderComponent(props: TProps): SvelteWebPartComponent<TProps>;

  protected get frameworkAdapter(): FrameworkAdapter | null {
    return adapter;
  }

  protected createComponent(): unknown {
    return this.renderComponent(this.getComponentProps());
  }

  protected getComponentProps(): TProps {
    return this.properties;
  }
}
