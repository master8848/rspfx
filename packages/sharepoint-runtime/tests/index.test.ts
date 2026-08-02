// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { EnvironmentType } from '@mbsks/rspfx-core';
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
  it('mounts into the root via the supplied mount closure and unmounts via the teardown closure', () => {
    const mount = vi.fn();
    const unmount = vi.fn();
    const loader = createPlaygroundLoader(mount, unmount);
    const root = document.createElement('div');

    loader.mount(root);
    loader.unmount();

    expect(mount).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledWith(root);
    expect(unmount).toHaveBeenCalledTimes(1);
    expect(unmount).toHaveBeenCalledWith(root);
  });

  it('no-ops on unmount when no teardown closure is supplied', () => {
    const mount = vi.fn();
    const loader = createPlaygroundLoader(mount);

    loader.mount(document.createElement('div'));
    expect(() => loader.unmount()).not.toThrow();
  });

  it('exports the playground service key', () => {
    expect(PLAYGROUND_SERVICE_KEY).toBe('__rspfx_playground__');
  });
});
