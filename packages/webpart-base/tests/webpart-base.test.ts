import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeadlessWebPart, BaseWebPart } from '../src/index.js';
import { defineWebPart } from '../src/define.js';

function init(webPart: HeadlessWebPart<any>, domElement: HTMLElement, properties: Record<string, unknown> = { title: 'Hello' }): void {
  (webPart as unknown as { _internalInitialize(ctx: unknown): void })._internalInitialize({
    domElement,
    manifest: { id: '00000000-0000-0000-0000-000000000000', alias: 'Test' },
  });
  (webPart as unknown as { _internalDeserialize(data: unknown): void })._internalDeserialize({
    properties,
    dataVersion: '1.0',
  });
}

// ---------------------------------------------------------------------------
// HeadlessWebPart directly
// ---------------------------------------------------------------------------
describe('HeadlessWebPart', () => {
  class Concrete extends HeadlessWebPart<{ title: string }> {
    public createAdapterCallCount = 0;
    public mount = vi.fn();
    public update = vi.fn();
    public unmount = vi.fn();
    public superDisposeCalled = false;
    protected createAdapter() {
      this.createAdapterCallCount++;
      return { mount: this.mount, update: this.update, unmount: this.unmount };
    }
    protected override getComponentProps(): { title: string } {
      return this.properties as { title: string };
    }
    protected override onDispose(): void {
      super.onDispose();
      // track via spy on prototype? we expose flag by checking unmount etc
    }
  }

  it('render lazy adapter mount once, second render not create second adapter', () => {
    const dom = {} as HTMLElement;
    const wp = new Concrete();
    init(wp, dom, { title: 'Hello' });
    wp.render();
    wp.render();
    expect(wp.createAdapterCallCount).toBe(1);
    expect(wp.mount).toHaveBeenCalledTimes(2);
    // both calls with same domElement and props
    expect(wp.mount).toHaveBeenNthCalledWith(1, dom, { title: 'Hello' });
    expect(wp.mount).toHaveBeenNthCalledWith(2, dom, { title: 'Hello' });
  });

  it('onDispose unmount only if exists then super.onDispose', () => {
    const dom = {} as HTMLElement;
    const wp = new Concrete();
    const superSpy = vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(wp)) as any, 'onDispose');
    // without render, adapter undefined -> unmount not called
    init(wp, dom);
    (wp as unknown as { onDispose(): void }).onDispose();
    expect(wp.unmount).not.toHaveBeenCalled();
    expect(superSpy).toHaveBeenCalledTimes(1);
    superSpy.mockRestore();

    // with render, adapter exists -> unmount called
    const dom2 = {} as HTMLElement;
    const wp2 = new Concrete();
    const superSpy2 = vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(wp2)) as any, 'onDispose');
    init(wp2, dom2);
    wp2.render();
    (wp2 as unknown as { onDispose(): void }).onDispose();
    expect(wp2.unmount).toHaveBeenCalledTimes(1);
    expect(wp2.unmount).toHaveBeenCalledWith(dom2);
    expect(superSpy2).toHaveBeenCalledTimes(1);
    superSpy2.mockRestore();
  });

  it('updateProps no-op before mount', () => {
    const dom = {} as HTMLElement;
    const wp = new Concrete();
    init(wp, dom);
    expect(() => (wp as unknown as { updateProps(next: unknown): void }).updateProps({ title: 'Next' })).not.toThrow();
    expect(wp.update).not.toHaveBeenCalled();
  });

  it('updateProps delegates to adapter.update after mount', () => {
    const dom = {} as HTMLElement;
    const wp = new Concrete();
    init(wp, dom);
    wp.render();
    (wp as unknown as { updateProps(next: unknown): void }).updateProps({ title: 'Next' });
    expect(wp.update).toHaveBeenCalledWith(dom, { title: 'Next' });
  });

  it('BaseWebPart alias equals HeadlessWebPart', () => {
    expect(BaseWebPart).toBe(HeadlessWebPart);
  });
});

// ---------------------------------------------------------------------------
// defineWebPart
// ---------------------------------------------------------------------------
describe('defineWebPart', () => {
  it('passthrough (no selector/schema) returns raw properties', () => {
    const mount = vi.fn();
    const Cls = defineWebPart<{ title: string }>({
      adapterFactory: () => ({ mount, update: vi.fn(), unmount: vi.fn() }),
    });
    const dom = {} as HTMLElement;
    const inst = new Cls();
    init(inst as unknown as HeadlessWebPart<any>, dom, { title: 'Raw' });
    inst.render();
    expect(mount).toHaveBeenCalledWith(dom, { title: 'Raw' });
  });

  it('propertiesSchema takes precedence over selector and raw', () => {
    const mount = vi.fn();
    const schema = vi.fn((raw: unknown) => ({ title: (raw as any).title + ':schema' }));
    const selector = vi.fn(() => ({ title: 'selector' }));
    const Cls = defineWebPart<{ title: string }>({
      adapterFactory: () => ({ mount, update: vi.fn(), unmount: vi.fn() }),
      propertiesSchema: schema,
      selector,
    });
    const dom = {} as HTMLElement;
    const inst = new Cls();
    init(inst as unknown as HeadlessWebPart<any>, dom, { title: 'Hello' });
    inst.render();
    expect(schema).toHaveBeenCalledWith({ title: 'Hello' });
    expect(selector).not.toHaveBeenCalled();
    expect(mount).toHaveBeenCalledWith(dom, { title: 'Hello:schema' });
  });

  it('selector receives raw and ctx with domElement/cultureName/environment/theme', () => {
    const mount = vi.fn();
    const selector = vi.fn((raw: Record<string, unknown>, ctx: unknown) => {
      const c = ctx as { domElement: HTMLElement; cultureName: string; environment: number; theme: unknown; themeProvider: unknown };
      return { title: `${String(raw.title)}-${c.cultureName}-${c.environment}-${c.domElement === dom ? 'domOk' : 'domFail'}` };
    });
    const Cls = defineWebPart<{ title: string }>({
      adapterFactory: () => ({ mount, update: vi.fn(), unmount: vi.fn() }),
      selector,
    });
    const dom = {} as HTMLElement;
    const inst = new Cls();
    init(inst as unknown as HeadlessWebPart<any>, dom, { title: 'Hi' });
    inst.render();
    expect(selector).toHaveBeenCalledTimes(1);
    const [raw, ctx] = selector.mock.calls[0] as [Record<string, unknown>, any];
    expect(raw).toEqual({ title: 'Hi' });
    expect(ctx.domElement).toBe(dom);
    expect(ctx.cultureName).toBe('en-US');
    expect(ctx.environment).toBe(0);
    expect(ctx.theme).toBeUndefined();
    expect(ctx.themeProvider).toBeUndefined();
    expect(mount).toHaveBeenCalledWith(dom, { title: 'Hi-en-US-0-domOk' });
  });

  it('getPropertyPaneConfiguration with callback vs without', () => {
    const ClsWith = defineWebPart<{ x: string }>({
      adapterFactory: () => ({ mount: vi.fn(), update: vi.fn(), unmount: vi.fn() }),
      getPropertyPaneConfiguration: () => ({ pages: [{ header: 'h' }] } as unknown as never),
    });
    const instWith = new ClsWith();
    init(instWith as unknown as HeadlessWebPart<any>, {} as HTMLElement, { x: '1' });
    const cfgWith = (instWith as unknown as { getPropertyPaneConfiguration(): unknown }).getPropertyPaneConfiguration();
    expect(cfgWith).toEqual({ pages: [{ header: 'h' }] });

    const ClsWithout = defineWebPart<{ x: string }>({
      adapterFactory: () => ({ mount: vi.fn(), update: vi.fn(), unmount: vi.fn() }),
    });
    const instWithout = new ClsWithout();
    init(instWithout as unknown as HeadlessWebPart<any>, {} as HTMLElement, { x: '1' });
    const cfgWithout = (instWithout as unknown as { getPropertyPaneConfiguration(): unknown }).getPropertyPaneConfiguration();
    expect(cfgWithout).toEqual({ pages: [] });
  });

  it('displayName via defineProperty sets class name', () => {
    const Cls = defineWebPart<{ x: string }>({
      adapterFactory: () => ({ mount: vi.fn(), update: vi.fn(), unmount: vi.fn() }),
      displayName: 'MyWebPart',
    });
    expect(Cls.name).toBe('MyWebPart');
  });

  it('without displayName does not set custom name (retains default)', () => {
    const Cls = defineWebPart<{ x: string }>({
      adapterFactory: () => ({ mount: vi.fn(), update: vi.fn(), unmount: vi.fn() }),
    });
    // should be something like "Cls" not "MyWebPart"
    expect(Cls.name).not.toBe('MyWebPart');
  });

  it('createAdapter called with host.domElement and getComponentProps pipeline integrates', () => {
    const factory = vi.fn((host: { domElement: HTMLElement }) => ({
      mount: vi.fn(),
      update: vi.fn(),
      unmount: vi.fn(),
    }));
    const schema = vi.fn((raw: unknown) => ({ mapped: (raw as any).title + '-mapped' }) as unknown as { mapped: string });
    const Cls = defineWebPart<{ mapped: string }>({
      adapterFactory: factory,
      propertiesSchema: schema,
    });
    const dom = {} as HTMLElement;
    const inst = new Cls();
    init(inst as unknown as HeadlessWebPart<any>, dom, { title: 'A' });
    inst.render();
    expect(factory).toHaveBeenCalledWith({ domElement: dom });
    expect(schema).toHaveBeenCalledWith({ title: 'A' });
    const adapter = (factory.mock.results[0]!.value as { mount: ReturnType<typeof vi.fn> });
    expect(adapter.mount).toHaveBeenCalledWith(dom, { mapped: 'A-mapped' });
  });
});
