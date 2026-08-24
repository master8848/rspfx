import * as spWebpartBase from '@microsoft/sp-webpart-base';
import type { BaseClientSideWebPart as SPBase } from '@microsoft/sp-webpart-base';

export interface HeadlessAdapter<TProps extends Record<string, unknown> = Record<string, unknown>> {
  readonly mount: (root: HTMLElement, props: TProps) => void;
  readonly update: (root: HTMLElement, props: TProps) => void;
  readonly unmount: (root: HTMLElement) => void;
}

const SPBaseCtor = (
  spWebpartBase as unknown as {
    BaseClientSideWebPart: new <T extends Record<string, unknown>>() => SPBase<T>;
  }
).BaseClientSideWebPart;

export abstract class HeadlessWebPart<TProps extends Record<string, unknown> = Record<string, unknown>> extends SPBaseCtor<TProps> {
  protected abstract createAdapter(): HeadlessAdapter<TProps>;

  private adapter?: HeadlessAdapter<TProps>;

  protected getComponentProps(): TProps {
    return this.properties as TProps;
  }

  public override render(): void {
    this.adapter ??= this.createAdapter();
    this.adapter.mount(this.domElement, this.getComponentProps());
  }

  protected override onDispose(): void {
    if (this.adapter) {
      this.adapter.unmount(this.domElement);
    }
    super.onDispose();
  }

  protected updateProps(next: TProps): void {
    this.adapter?.update(this.domElement, next);
  }
}

/** @deprecated use HeadlessWebPart — kept for one major */
export const BaseWebPart = HeadlessWebPart;

export { defineWebPart } from './define.js';
