import { describe, it, expect, vi } from 'vitest';

import { BaseWebPart } from '../src/base-web-part.js';

class TestWebPart extends BaseWebPart<{ title: string }> {
  public constructor(
    public readonly onRenderInto: (root: HTMLElement) => void,
    public readonly onDisposeFrom: (root: HTMLElement) => void
  ) {
    super();
  }
  protected renderInto(root: HTMLElement): void {
    this.onRenderInto(root);
  }
  protected disposeFrom(root: HTMLElement): void {
    this.onDisposeFrom(root);
  }
  protected getComponentProps(): { title: string } {
    return this.properties;
  }
}

function initialize(webPart: TestWebPart, domElement: unknown): void {
  (webPart as unknown as { _internalInitialize(ctx: unknown): void })._internalInitialize({
    domElement,
    manifest: { id: '00000000-0000-0000-0000-000000000000', alias: 'TestWebPart' }
  });
  (webPart as unknown as { _internalDeserialize(data: unknown): void })._internalDeserialize({
    properties: { title: 'Hello' },
    dataVersion: '1.0'
  });
}

describe('BaseWebPart', () => {
  it('invokes renderInto with the domElement on render()', () => {
    const renderInto = vi.fn();
    const domElement = {} as HTMLElement;
    const webPart = new TestWebPart(renderInto, vi.fn());
    initialize(webPart, domElement);

    webPart.render();

    expect(renderInto).toHaveBeenCalledTimes(1);
    expect(renderInto).toHaveBeenCalledWith(domElement);
  });

  it('invokes disposeFrom with the domElement on onDispose()', () => {
    const disposeFrom = vi.fn();
    const domElement = {} as HTMLElement;
    const webPart = new TestWebPart(vi.fn(), disposeFrom);
    initialize(webPart, domElement);

    (webPart as unknown as { onDispose(): void }).onDispose();

    expect(disposeFrom).toHaveBeenCalledTimes(1);
    expect(disposeFrom).toHaveBeenCalledWith(domElement);
  });

  it('render() does not throw and passes the domElement through', () => {
    const renderInto = vi.fn();
    const domElement = {} as HTMLElement;
    const webPart = new TestWebPart(renderInto, vi.fn());
    initialize(webPart, domElement);

    expect(() => webPart.render()).not.toThrow();
    expect(renderInto).toHaveBeenCalledTimes(1);
    expect(renderInto).toHaveBeenCalledWith(domElement);
  });

  it('derives component props from this.properties', () => {
    const webPart = new TestWebPart(vi.fn(), vi.fn());
    initialize(webPart, {} as HTMLElement);

    const props = (webPart as unknown as { getComponentProps(): { title: string } }).getComponentProps();
    expect(props).toEqual({ title: 'Hello' });
  });
});
