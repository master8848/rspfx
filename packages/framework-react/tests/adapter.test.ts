// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { adapter } from '../src/index.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('react framework adapter', () => {
  it('mounts a react element into the container', () => {
    const container = document.createElement('div');
    act(() => {
      adapter.mount(container, createElement('div', null, 'hi'));
    });
    expect(container.childNodes.length).toBeGreaterThan(0);
    expect(container.textContent).toBe('hi');
  });

  it('re-mounts on the same root without duplicating', () => {
    const container = document.createElement('div');
    act(() => {
      adapter.mount(container, createElement('div', null, 'hi'));
    });
    act(() => {
      adapter.mount(container, createElement('div', null, 'bye'));
    });
    expect(container.childNodes.length).toBe(1);
    expect(container.textContent).toBe('bye');
  });

  it('update re-renders without throwing', () => {
    const container = document.createElement('div');
    act(() => {
      adapter.mount(container, createElement('div', null, 'hi'));
    });
    expect(() =>
      act(() => {
        adapter.update(container);
      })
    ).not.toThrow();
    expect(container.textContent).toBe('hi');
  });

  it('unmount clears the container', () => {
    const container = document.createElement('div');
    act(() => {
      adapter.mount(container, createElement('div', null, 'hi'));
    });
    act(() => {
      adapter.unmount(container);
    });
    expect(container.childNodes.length).toBe(0);
  });

  it('supports fast refresh', () => {
    expect(adapter.supportsFastRefresh()).toBe(true);
  });
});
