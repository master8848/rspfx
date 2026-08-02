// @vitest-environment happy-dom
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { compile } from 'svelte/compiler';
import { SvelteWebPart, type SvelteWebPartComponent } from '../src/webpart.js';

const GENERATED_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'svelte-app', 'generated');
const GENERATED_ENTRY = path.join(GENERATED_DIR, 'Webpart.svelte.js');

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
  const mod = (await import(pathToFileURL(GENERATED_ENTRY).toString())) as {
    default: SvelteWebPartComponent<{ name: string }>['component'];
  };
  TestComponent = mod.default;
});

describe('SvelteWebPart', () => {
  it('renders the svelte component with props into the web part domElement', () => {
    const domElement = document.createElement('div');
    const webPart = new TestSvelteWebPart();
    initialize(webPart, domElement);
    webPart.render();
    expect(domElement.textContent).toBe('hello world');
  });

  it('re-renders with updated properties', () => {
    const domElement = document.createElement('div');
    const webPart = new TestSvelteWebPart();
    initialize(webPart, domElement);
    webPart.render();
    (webPart as unknown as { _internalDeserialize(data: { properties: { name: string }; dataVersion: string }): void })._internalDeserialize({
      properties: { name: 'updated' },
      dataVersion: '1.0'
    });
    webPart.render();
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
