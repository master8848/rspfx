import { BaseWebPart } from '@mbsks/rspfx-core/webpart';
import { createApp, type App as VueApp, type Component } from 'vue';

const apps = new WeakMap<HTMLElement, VueApp>();

export abstract class VueWebPart<TProps extends Record<string, unknown>, TState = unknown>
  extends BaseWebPart<TProps> {
  protected abstract renderComponent(props: TProps): Component;

  protected renderInto(root: HTMLElement): void {
    const previous = apps.get(root);
    if (previous) {
      previous.unmount();
    }
    const app = createApp(this.renderComponent(this.getComponentProps()));
    apps.set(root, app);
    app.mount(root);
  }

  protected disposeFrom(root: HTMLElement): void {
    const app = apps.get(root);
    if (app) {
      app.unmount();
      apps.delete(root);
    }
  }

  protected getComponentProps(): TProps {
    return this.properties;
  }
}
