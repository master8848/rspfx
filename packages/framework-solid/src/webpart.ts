import { BaseWebPart } from '@mbsks/rspfx-core/webpart';
import type { JSX } from 'solid-js';
import { adapter } from './index.js';
import type { FrameworkAdapter } from '@mbsks/rspfx-plugin-api';

export abstract class SolidWebPart<TProps extends Record<string, unknown>, TState = unknown>
  extends BaseWebPart<TProps> {
  protected abstract renderComponent(props: TProps): JSX.Element;

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
