import { HeadlessWebPart } from '@mbsks/rspfx-webpart-base';
import { createVanillaAdapter } from './headless.js';

/** @deprecated use createVanillaAdapter from @mbsks/rspfx-framework-vanilla/headless + defineWebPart */
export abstract class VanillaWebPart<TProps extends Record<string, unknown> = Record<string, unknown>> extends HeadlessWebPart<TProps> {
  protected abstract renderComponent(props: TProps): HTMLElement | string;

  protected createAdapter() {
    return createVanillaAdapter<TProps>((p) => this.renderComponent(p));
  }
}
