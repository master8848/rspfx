import * as spWebpartBase from '@microsoft/sp-webpart-base';
import type { BaseClientSideWebPart as BaseClientSideWebPartType } from '@microsoft/sp-webpart-base';

const BaseClientSideWebPart = (
  spWebpartBase as unknown as {
    BaseClientSideWebPart: new <TProps extends Record<string, unknown>>() => BaseClientSideWebPartType<TProps>;
  }
).BaseClientSideWebPart;

export abstract class BaseWebPart<TProps extends Record<string, unknown> = Record<string, unknown>>
  extends BaseClientSideWebPart<TProps> {
  protected abstract getComponentProps(): TProps;

  protected abstract renderInto(root: HTMLElement): void;

  protected abstract disposeFrom(root: HTMLElement): void;

  public override render(): void {
    this.renderInto(this.domElement);
  }

  protected override onDispose(): void {
    this.disposeFrom(this.domElement);
    super.onDispose();
  }
}
