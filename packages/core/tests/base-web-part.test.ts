import { describe, it, expect, vi } from 'vitest';

import { BaseWebPart } from '../src/base-web-part.js';

class TestWebPart extends BaseWebPart<{ title: string }> {
  public constructor(
    public readonly mountFn: (root: HTMLElement, props: { title: string }) => void,
    public readonly unmountFn: (root: HTMLElement) => void,
  ) {
    super();
  }

  protected createAdapter() {
    return {
      mount: this.mountFn,
      update: vi.fn(),
      unmount: this.unmountFn,
    };
  }

  protected override getComponentProps(): { title: string } {
    return this.properties as { title: string };
  }
}

function initialize(webPart: TestWebPart, domElement: unknown): void {
  (webPart as unknown as { _internalInitialize(ctx: unknown): void })._internalInitialize({
    domElement,
    manifest: { id: '00000000-0000-0000-0000-000000000000', alias: 'TestWebPart' },
  });
  (webPart as unknown as { _internalDeserialize(data: unknown): void })._internalDeserialize({
    properties: { title: 'Hello' },
    dataVersion: '1.0',
  });
}

describe('BaseWebPart', () => {
  it('invokes adapter mount with the domElement on render()', () => {
    const mount = vi.fn();
    const domElement = {} as HTMLElement;
    const webPart = new TestWebPart(mount, vi.fn());
    initialize(webPart, domElement);

    webPart.render();

    expect(mount).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledWith(domElement, { title: 'Hello' });
  });

  it('invokes adapter unmount with the domElement on onDispose()', () => {
    const unmount = vi.fn();
    const domElement = {} as HTMLElement;
    const webPart = new TestWebPart(vi.fn(), unmount);
    initialize(webPart, domElement);
    webPart.render();

    (webPart as unknown as { onDispose(): void }).onDispose();

    expect(unmount).toHaveBeenCalledTimes(1);
    expect(unmount).toHaveBeenCalledWith(domElement);
  });

  it('render() does not throw and passes the domElement through', () => {
    const mount = vi.fn();
    const domElement = {} as HTMLElement;
    const webPart = new TestWebPart(mount, vi.fn());
    initialize(webPart, domElement);

    expect(() => webPart.render()).not.toThrow();
    expect(mount).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledWith(domElement, { title: 'Hello' });
  });

  it('derives component props from this.properties', () => {
    const webPart = new TestWebPart(vi.fn(), vi.fn());
    initialize(webPart, {} as HTMLElement);

    const props = (webPart as unknown as { getComponentProps(): { title: string } }).getComponentProps();
    expect(props).toEqual({ title: 'Hello' });
  });
});
