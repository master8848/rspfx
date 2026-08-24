import { HeadlessWebPart } from '@mbsks/rspfx-webpart-base';
import { createSolidAdapter } from './headless.js';
import type { JSX } from 'solid-js';

/** @deprecated use createSolidAdapter from @mbsks/rspfx-framework-solid/headless + defineWebPart */
export abstract class SolidWebPart<TProps extends Record<string, unknown> = Record<string, unknown>, TState = unknown> extends HeadlessWebPart<TProps> {
  protected abstract renderComponent(props: TProps): JSX.Element;

  protected createAdapter() {
    return createSolidAdapter<TProps>((p) => this.renderComponent(p));
  }
}
