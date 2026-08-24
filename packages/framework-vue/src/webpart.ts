import { HeadlessWebPart } from '@mbsks/rspfx-webpart-base';
import { createVueAdapter } from './headless.js';
import type { Component } from 'vue';

/** @deprecated use createVueAdapter from @mbsks/rspfx-framework-vue/headless + defineWebPart */
export abstract class VueWebPart<TProps extends Record<string, unknown> = Record<string, unknown>, TState = unknown> extends HeadlessWebPart<TProps> {
  protected abstract renderComponent(props: TProps): Component;

  protected createAdapter() {
    return createVueAdapter<TProps>((p) => this.renderComponent(p));
  }
}
