import { vi } from 'vitest';

const { MockBaseClientSideWebPart } = vi.hoisted(() => {
  class MockBaseClientSideWebPart<TProps extends {}> {
    private _context: { domElement: unknown; manifest: unknown } | undefined;
    private _properties: TProps | undefined;

    protected get domElement(): unknown {
      return this._context?.domElement;
    }

    protected get properties(): TProps | undefined {
      return this._properties;
    }

    protected onDispose(): void {}

    _internalInitialize(webPartContext: { domElement: unknown; manifest: unknown }): void {
      this._context = webPartContext;
    }

    _internalDeserialize(data: { properties: TProps }): void {
      this._properties = data.properties;
    }
  }
  return { MockBaseClientSideWebPart };
});

vi.mock('@microsoft/sp-webpart-base', () => ({
  BaseClientSideWebPart: MockBaseClientSideWebPart
}));
