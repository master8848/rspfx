import { BaseWebPart } from '@mbsks/rspfx-core/webpart';
import type { ReactElement } from 'react';
import { adapter } from './index.js';
import type { FrameworkAdapter } from '@mbsks/rspfx-plugin-api';

export abstract class ReactWebPart<TProps extends Record<string, unknown>, TState = unknown>
  extends BaseWebPart<TProps> {
  protected abstract renderComponent(props: TProps): ReactElement;

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
