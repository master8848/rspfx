import { HeadlessWebPart } from '@mbsks/rspfx-webpart-base';
import { createReactAdapter } from './headless.js';
import type { ReactElement } from 'react';

/** @deprecated use createReactAdapter from @mbsks/rspfx-framework-react/headless + defineWebPart */
export abstract class ReactWebPart<TProps extends Record<string, unknown> = Record<string, unknown>, TState = unknown> extends HeadlessWebPart<TProps> {
  protected abstract renderComponent(props: TProps): ReactElement;

  protected createAdapter() {
    return createReactAdapter<TProps>((p) => this.renderComponent(p));
  }
}
