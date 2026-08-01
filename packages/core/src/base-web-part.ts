import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

export interface FrameworkAdapter {
  name: string;
  mount(root: HTMLElement, component: unknown): void;
  unmount(root: HTMLElement): void;
  update(root: HTMLElement): void;
  supportsFastRefresh(): boolean;
}

export abstract class BaseWebPart<TProps extends Record<string, unknown> = Record<string, unknown>>
  extends BaseClientSideWebPart<TProps> {
  protected abstract get frameworkAdapter(): FrameworkAdapter | null;

  protected abstract createComponent(): unknown;

  protected abstract getComponentProps(): TProps;

  public override render(): void {
    const adapter = this.frameworkAdapter;
    if (!adapter) {
      return;
    }
    adapter.mount(this.domElement, this.createComponent());
  }

  protected override onDispose(): void {
    const adapter = this.frameworkAdapter;
    if (adapter) {
      adapter.unmount(this.domElement);
    }
    super.onDispose();
  }
}
