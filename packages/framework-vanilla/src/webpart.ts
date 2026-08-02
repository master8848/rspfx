import { BaseWebPart } from '@mbsks/rspfx-core/webpart';

export abstract class VanillaWebPart<TProps extends Record<string, unknown>, TState = unknown>
  extends BaseWebPart<TProps> {
  protected abstract renderComponent(props: TProps): HTMLElement | string;

  protected renderInto(root: HTMLElement): void {
    root.replaceChildren(this.renderComponent(this.getComponentProps()));
  }

  protected disposeFrom(root: HTMLElement): void {
    root.replaceChildren();
  }

  protected getComponentProps(): TProps {
    return this.properties;
  }
}
