import { describe, it, expect, vi } from 'vitest';

import { BaseWebPart } from '../src/base-web-part.js';

interface MockAdapter {
  name: string;
  mount: ReturnType<typeof vi.fn>;
  unmount: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  supportsFastRefresh: () => boolean;
}

function createMockAdapter(): MockAdapter {
  return {
    name: 'mock',
    mount: vi.fn(),
    unmount: vi.fn(),
    update: vi.fn(),
    supportsFastRefresh: () => false
  };
}

class TestWebPart extends BaseWebPart<{ title: string }> {
  public constructor(
    private readonly adapter: MockAdapter | null,
    private readonly component: unknown
  ) {
    super();
  }

  protected get frameworkAdapter() {
    return this.adapter;
  }

  protected createComponent(): unknown {
    return this.component;
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
  it('mounts the component into the domElement via the framework adapter on render()', () => {
    const adapter = createMockAdapter();
    const component = { kind: 'mock-component' };
    const domElement = {} as HTMLElement;
    const webPart = new TestWebPart(adapter, component);
    initialize(webPart, domElement);

    webPart.render();

    expect(adapter.mount).toHaveBeenCalledTimes(1);
    expect(adapter.mount).toHaveBeenCalledWith(domElement, component);
  });

  it('unmounts the component via the framework adapter on onDispose()', () => {
    const adapter = createMockAdapter();
    const domElement = {} as HTMLElement;
    const webPart = new TestWebPart(adapter, {});
    initialize(webPart, domElement);

    (webPart as unknown as { onDispose(): void }).onDispose();

    expect(adapter.unmount).toHaveBeenCalledTimes(1);
    expect(adapter.unmount).toHaveBeenCalledWith(domElement);
  });

  it('is a no-op when no framework adapter is available', () => {
    const adapter = createMockAdapter();
    const domElement = {} as HTMLElement;
    const webPart = new TestWebPart(null, {});
    initialize(webPart, domElement);

    expect(() => webPart.render()).not.toThrow();
    expect(adapter.mount).not.toHaveBeenCalled();
  });

  it('derives component props from this.properties', () => {
    const adapter = createMockAdapter();
    const webPart = new TestWebPart(adapter, null);
    initialize(webPart, {} as HTMLElement);

    const props = (webPart as unknown as { getComponentProps(): { title: string } }).getComponentProps();
    expect(props).toEqual({ title: 'Hello' });
  });
});
