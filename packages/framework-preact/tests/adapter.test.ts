// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { h } from 'preact';
import { adapter } from '../src/index.js';

describe('preact framework adapter', () => {
  it('mounts a preact vnode into the container', () => {
    const container = document.createElement('div');
    adapter.mount(container, h('div', null, 'hi'));
    expect(container.childNodes.length).toBeGreaterThan(0);
    expect(container.textContent).toBe('hi');
  });

  it('update re-renders without throwing', () => {
    const container = document.createElement('div');
    adapter.mount(container, h('div', null, 'hi'));
    expect(() => adapter.update(container)).not.toThrow();
    expect(container.textContent).toBe('hi');
  });

  it('unmount clears the container', () => {
    const container = document.createElement('div');
    adapter.mount(container, h('div', null, 'hi'));
    adapter.unmount(container);
    expect(container.childNodes.length).toBe(0);
  });

  it('supports fast refresh', () => {
    expect(adapter.supportsFastRefresh()).toBe(true);
  });
});
