import { BaseWebPart } from '@mbsks/rspfx-core/webpart';
import { render, type ComponentChild } from 'preact';

export abstract class PreactWebPart<TProps extends Record<string, unknown>, TState = unknown>
  extends BaseWebPart<TProps> {
  protected abstract renderComponent(props: TProps): ComponentChild;

  protected renderInto(root: HTMLElement): void {
    render(this.renderComponent(this.getComponentProps()), root);
  }

  protected disposeFrom(root: HTMLElement): void {
    render(null, root);
  }

  protected getComponentProps(): TProps {
    return this.properties;
  }
}
