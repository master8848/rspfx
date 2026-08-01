import { BaseWebPart } from '@mbsks/rspfx-core/webpart';
import { adapter } from './index.js';
import type { FrameworkAdapter } from '@mbsks/rspfx-plugin-api';

export abstract class VanillaWebPart<TProps extends Record<string, unknown>, TState = unknown>
  extends BaseWebPart<TProps> {
  protected abstract renderComponent(props: TProps): HTMLElement | string;

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
