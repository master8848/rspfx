// @vitest-environment happy-dom
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { compile } from 'svelte/compiler';
import { adapter } from '../src/index.js';

const GENERATED_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'svelte-app', 'generated');
const GENERATED_ENTRY = path.join(GENERATED_DIR, 'Adapter.svelte.js');

interface CompiledComponent {
  new (options: { target: HTMLElement; props: Record<string, unknown> }): {
    $set(props: Record<string, unknown>): void;
    $destroy(): void;
  };
}

let TestComponent: CompiledComponent;

beforeAll(async () => {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const { js } = compile('<script>export let name;</script><div>hello {name}</div>', {
    filename: 'Adapter.svelte',
    generate: 'dom'
  });
  fs.writeFileSync(GENERATED_ENTRY, js.code);
  const mod = (await import(pathToFileURL(GENERATED_ENTRY).toString())) as { default: CompiledComponent };
  TestComponent = mod.default;
});

describe('svelte framework adapter', () => {
  it('mounts a svelte component into the container with props', () => {
    const container = document.createElement('div');
    adapter.mount(container, { component: TestComponent, props: { name: 'world' } });
    expect(container.childNodes.length).toBeGreaterThan(0);
    expect(container.textContent).toBe('hello world');
  });

  it('update pushes props via $set without throwing', () => {
    const container = document.createElement('div');
    adapter.mount(container, { component: TestComponent, props: { name: 'world' } });
    expect(() => adapter.update(container)).not.toThrow();
    expect(container.textContent).toBe('hello world');
  });

  it('unmount destroys the component and clears the container', () => {
    const container = document.createElement('div');
    adapter.mount(container, { component: TestComponent, props: { name: 'world' } });
    adapter.unmount(container);
    expect(container.childNodes.length).toBe(0);
  });

  it('supports fast refresh', () => {
    expect(adapter.supportsFastRefresh()).toBe(true);
  });
});
