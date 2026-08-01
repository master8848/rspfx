// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { h, type Component } from 'vue';
import { adapter } from '../src/index.js';

function createTestComponent(): Component {
  return { render: () => h('div', null, 'hi') };
}

describe('vue framework adapter', () => {
  it('mounts a vue component into the container', () => {
    const container = document.createElement('div');
    adapter.mount(container, createTestComponent());
    expect(container.childNodes.length).toBeGreaterThan(0);
    expect(container.textContent).toBe('hi');
  });

  it('update unmounts and remounts without throwing', () => {
    const container = document.createElement('div');
    adapter.mount(container, createTestComponent());
    expect(() => adapter.update(container)).not.toThrow();
    expect(container.textContent).toBe('hi');
  });

  it('unmount clears the container', () => {
    const container = document.createElement('div');
    adapter.mount(container, createTestComponent());
    adapter.unmount(container);
    expect(container.childNodes.length).toBe(0);
  });

  it('supports fast refresh', () => {
    expect(adapter.supportsFastRefresh()).toBe(true);
  });
});
