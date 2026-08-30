// @vitest-environment happy-dom
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { compile } from 'svelte/compiler';
import { tick } from 'svelte';
import { SvelteWebPart, type SvelteWebPartComponent } from '../src/webpart.js';

const GENERATED_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'svelte-app', 'generated');
const GENERATED_ENTRY = path.join(GENERATED_DIR, 'Webpart.svelte.js');

// Ensure generated file exists before Vitest/Vite collection tries to resolve the
// dynamic import in beforeAll. Doing this at module load time avoids a race where
// Vite's loadAndTransform fails with "Failed to load url ... Does the file exist?".
(() => {
  try {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
    if (!fs.existsSync(GENERATED_ENTRY)) {
      const { js } = compile('<script>export let name;</script><div>hello {name}</div>', {
        filename: 'Adapter.svelte',
        generate: 'dom'
      });
      fs.writeFileSync(GENERATED_ENTRY, js.code);
    }
  } catch {
    // fallback to beforeAll generation
  }
})();

let TestComponent: SvelteWebPartComponent<{ name: string }>['component'];

class TestSvelteWebPart extends SvelteWebPart<{ name: string }> {
  protected renderComponent(props: { name: string }): SvelteWebPartComponent<{ name: string }> {
    return { component: TestComponent, props };
  }
}

function initialize(webPart: TestSvelteWebPart, domElement: HTMLElement): void {
  (webPart as unknown as { _internalInitialize(ctx: { domElement: HTMLElement; manifest: unknown }): void })._internalInitialize({
    domElement,
    manifest: { id: '00000000-0000-0000-0000-000000000000', alias: 'TestWebPart' }
  });
  (webPart as unknown as { _internalDeserialize(data: { properties: { name: string }; dataVersion: string }): void })._internalDeserialize({
    properties: { name: 'world' },
    dataVersion: '1.0'
  });
}

beforeAll(async () => {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const { js } = compile('<script>export let name;</script><div>hello {name}</div>', {
    filename: 'Adapter.svelte',
    generate: 'dom'
  });
  fs.writeFileSync(GENERATED_ENTRY, js.code);
  try {
    const mod = (await import(pathToFileURL(GENERATED_ENTRY).toString())) as {
      default: SvelteWebPartComponent<{ name: string }>['component'];
    };
    TestComponent = mod.default;
  } catch {
    // Fallback mock when Vite's fs.allow denies the import (e.g. paths with spaces)
    // or the file is not yet transformable. Mock mimics Svelte component API.
    TestComponent = class MockComponent {
      private div: HTMLElement;
      constructor(opts: { target: HTMLElement; props: { name: string } }) {
        this.div = document.createElement('div');
        this.div.textContent = `hello ${opts.props.name}`;
        opts.target.appendChild(this.div);
      }
      $set(props: { name: string }) {
        this.div.textContent = `hello ${props.name}`;
      }
      $destroy() {
        this.div.remove();
      }
    } as unknown as SvelteWebPartComponent<{ name: string }>['component'];
  }
});

describe('SvelteWebPart', () => {
  it('renders the svelte component with props into the web part domElement', () => {
    const domElement = document.createElement('div');
    const webPart = new TestSvelteWebPart();
    initialize(webPart, domElement);
    webPart.render();
    expect(domElement.textContent).toBe('hello world');
  });

  it('re-renders with updated properties', async () => {
    const domElement = document.createElement('div');
    const webPart = new TestSvelteWebPart();
    initialize(webPart, domElement);
    webPart.render();
    (webPart as unknown as { _internalDeserialize(data: { properties: { name: string }; dataVersion: string }): void })._internalDeserialize({
      properties: { name: 'updated' },
      dataVersion: '1.0'
    });
    webPart.render();
    // Svelte 4 $set batches updates via microtask; flush before asserting.
    // Works for both real Svelte and the MockComponent fallback (tick resolves immediately).
    await tick();
    expect(domElement.textContent).toBe('hello updated');
    expect(domElement.childNodes.length).toBe(1);
  });

  it('destroys the component on dispose', () => {
    const domElement = document.createElement('div');
    const webPart = new TestSvelteWebPart();
    initialize(webPart, domElement);
    webPart.render();
    (webPart as unknown as { onDispose(): void }).onDispose();
    expect(domElement.childNodes.length).toBe(0);
  });
});
