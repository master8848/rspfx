// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

vi.mock('solid-js/web', async () => {
  const require = createRequire(import.meta.url);
  const clientPath = require.resolve('../node_modules/solid-js/web/dist/dev.js');
  const mod = await import(pathToFileURL(clientPath).toString());
  return mod;
});

import { adapter } from '../src/index.js';

describe('solid framework adapter', () => {
  it('mounts a solid component into the container', () => {
    const container = document.createElement('div');
    const component = () => 'hi';
    adapter.mount(container, component);
    expect(container.childNodes.length).toBeGreaterThan(0);
    expect(container.textContent).toBe('hi');
  });

  it('re-mounts on the same container without duplicating', () => {
    const container = document.createElement('div');
    const component = () => 'hi';
    adapter.mount(container, component);
    adapter.mount(container, component);
    expect(container.textContent).toBe('hi');
  });

  it('update does not throw', () => {
    const container = document.createElement('div');
    adapter.mount(container, () => 'hi');
    expect(() => adapter.update(container)).not.toThrow();
    expect(container.textContent).toBe('hi');
  });

  it('unmount disposes the component and clears the container', () => {
    const container = document.createElement('div');
    adapter.mount(container, () => 'hi');
    adapter.unmount(container);
    expect(container.childNodes.length).toBe(0);
  });

  it('does not support fast refresh (solid-refresh not installed)', () => {
    expect(adapter.supportsFastRefresh()).toBe(false);
  });
});
