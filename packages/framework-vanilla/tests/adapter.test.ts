// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { adapter } from '../src/index.js';

describe('vanilla framework adapter', () => {
  it('mounts an element by appending it to the container', () => {
    const container = document.createElement('div');
    const component = document.createElement('p');
    component.textContent = 'hi';
    adapter.mount(container, component);
    expect(container.childNodes.length).toBe(1);
    expect(container.textContent).toBe('hi');
  });

  it('mounts an html string by appending it to the container', () => {
    const container = document.createElement('div');
    adapter.mount(container, '<p>hi</p>');
    expect(container.childNodes.length).toBe(1);
    expect(container.textContent).toBe('hi');
  });

  it('update is a no-op and does not throw', () => {
    const container = document.createElement('div');
    adapter.mount(container, '<p>hi</p>');
    expect(() => adapter.update(container)).not.toThrow();
    expect(container.textContent).toBe('hi');
  });

  it('unmount removes the mounted content', () => {
    const container = document.createElement('div');
    adapter.mount(container, '<p>hi</p>');
    adapter.unmount(container);
    expect(container.childNodes.length).toBe(0);
  });

  it('does not support fast refresh', () => {
    expect(adapter.supportsFastRefresh()).toBe(false);
  });
});
