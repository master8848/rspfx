// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { EnvironmentType } from '@mbsks/rspfx-core';
import { RspfxError } from '@mbsks/rspfx-diagnostics';
import {
  createMockWebPartContext,
  createPlaygroundLoader,
  PLAYGROUND_SERVICE_KEY
} from '../src/index.js';

describe('createMockWebPartContext', () => {
  it('builds a local workbench context from manifest preconfigured entries', () => {
    const context = createMockWebPartContext({
      preconfiguredEntries: [
        { title: 'Hello Web Part', properties: { title: 'Hello', description: 'World' } }
      ]
    });

    expect(context.instanceId).toBeTruthy();
    expect(context.webPartTag).toBe(`MockWebPart.${context.instanceId}`);
    expect(context.domElement).toBeInstanceOf(HTMLElement);
    expect(context.properties).toEqual({ title: 'Hello', description: 'World' });
    expect(context.environment.type).toBe(EnvironmentType.Local);
    expect(context.pageContext.web).toEqual({
      title: 'Local Workbench',
      absoluteUrl: 'http://localhost:3000'
    });
    expect(context.pageContext.site).toEqual({ absoluteUrl: 'http://localhost:3000' });
    expect(context.propertyPane).toEqual({});
    expect(context.themeProvider).toBeUndefined();
  });

  it('spreads overrides last', () => {
    const themeProvider = {
      getTheme: () => ({ palette: { themePrimary: '#123456' } }),
      addChangeListener: vi.fn(),
      removeChangeListener: vi.fn()
    };
    const context = createMockWebPartContext(
      { preconfiguredEntries: [{ properties: { title: 'Hello' } }] },
      { instanceId: 'fixed-id', themeProvider }
    );

    expect(context.instanceId).toBe('fixed-id');
    expect(context.themeProvider).toBe(themeProvider);
    expect(context.properties).toEqual({ title: 'Hello' });
  });

  it('does not throw for a minimal manifest', () => {
    expect(() => createMockWebPartContext({})).not.toThrow();
    expect(createMockWebPartContext({}).properties).toEqual({});
    expect(createMockWebPartContext(undefined).properties).toEqual({});
  });
});

describe('createPlaygroundLoader', () => {
  it('mounts and unmounts the resolved component with a stub adapter', () => {
    const component = { kind: 'fake-component' };
    const adapter = { mount: vi.fn(), unmount: vi.fn() };
    const loader = createPlaygroundLoader({ default: component }, adapter);
    const root = document.createElement('div');

    loader.mount(root);
    loader.unmount();

    expect(adapter.mount).toHaveBeenCalledTimes(1);
    expect(adapter.mount).toHaveBeenCalledWith(root, component);
    expect(adapter.unmount).toHaveBeenCalledTimes(1);
    expect(adapter.unmount).toHaveBeenCalledWith(root);
  });

  it('falls back to the module itself when there is no default export', () => {
    const component = { kind: 'module-export' };
    const adapter = { mount: vi.fn(), unmount: vi.fn() };
    const loader = createPlaygroundLoader(component, adapter);

    loader.mount(document.createElement('div'));

    expect(adapter.mount).toHaveBeenCalledWith(expect.any(HTMLElement), component);
  });

  it('throws RspfxError without an adapter', () => {
    const loader = createPlaygroundLoader({ default: {} });

    expect(() => loader.mount(document.createElement('div'))).toThrowError(
      expect.objectContaining({ code: 'PLAYGROUND_ADAPTER_REQUIRED', name: 'RspfxError' })
    );
    expect(() => loader.mount(document.createElement('div'))).toThrowError(RspfxError);
  });

  it('exports the playground service key', () => {
    expect(PLAYGROUND_SERVICE_KEY).toBe('__rspfx_playground__');
  });
});
