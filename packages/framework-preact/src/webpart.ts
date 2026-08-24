import { HeadlessWebPart } from '@mbsks/rspfx-webpart-base';
import { createPreactAdapter } from './headless.js';
import type { ComponentChild } from 'preact';

/** @deprecated use createPreactAdapter from @mbsks/rspfx-framework-preact/headless + defineWebPart */
export abstract class PreactWebPart<TProps extends Record<string, unknown> = Record<string, unknown>, TState = unknown> extends HeadlessWebPart<TProps> {
  protected abstract renderComponent(props: TProps): ComponentChild;

  protected createAdapter() {
    return createPreactAdapter<TProps>((p) => this.renderComponent(p));
  }
}
