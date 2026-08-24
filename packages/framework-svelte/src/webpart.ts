import { HeadlessWebPart } from '@mbsks/rspfx-webpart-base';
import { createSvelteAdapter, type SvelteWebPartComponent } from './headless.js';

export type { SvelteWebPartComponent } from './headless.js';

/** @deprecated use createSvelteAdapter from @mbsks/rspfx-framework-svelte/headless + defineWebPart */
export abstract class SvelteWebPart<TProps extends Record<string, unknown> = Record<string, unknown>, TState = unknown> extends HeadlessWebPart<TProps> {
  protected abstract renderComponent(props: TProps): SvelteWebPartComponent<TProps>;

  protected createAdapter() {
    return createSvelteAdapter<TProps>((p) => this.renderComponent(p));
  }
}
