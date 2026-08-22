// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

vi.mock('solid-js/web', async () => {
  const require = createRequire(import.meta.url);
  const clientPath = require.resolve('../node_modules/solid-js/web/dist/dev.js');
  const mod = require(clientPath) as Record<string, unknown>;
  return mod;
});

import type { JSX } from 'solid-js';
import { SolidWebPart } from '../src/webpart.js';

class TestSolidWebPart extends SolidWebPart<{ title: string }> {
  protected renderComponent(props: { title: string }): JSX.Element {
    return (() => props.title) as unknown as JSX.Element;
  }
}

function initialize(webPart: TestSolidWebPart, domElement: HTMLElement): void {
  (webPart as unknown as { _internalInitialize(ctx: { domElement: HTMLElement; manifest: unknown }): void })._internalInitialize({
    domElement,
    manifest: { id: '00000000-0000-0000-0000-000000000000', alias: 'TestWebPart' }
  });
  (webPart as unknown as { _internalDeserialize(data: { properties: { title: string }; dataVersion: string }): void })._internalDeserialize({
    properties: { title: 'Hello' },
    dataVersion: '1.0'
  });
}

describe('SolidWebPart', () => {
  it('renders the solid component into the web part domElement', () => {
    const domElement = document.createElement('div');
    const webPart = new TestSolidWebPart();
    initialize(webPart, domElement);
    webPart.render();
    expect(domElement.childNodes.length).toBeGreaterThan(0);
    expect(domElement.textContent).toBe('Hello');
  });

  it('re-mounts on the same domElement without duplicating', () => {
    const domElement = document.createElement('div');
    const webPart = new TestSolidWebPart();
    initialize(webPart, domElement);
    webPart.render();
    webPart.render();
    expect(domElement.textContent).toBe('Hello');
  });

  it('re-renders with updated properties', () => {
    const domElement = document.createElement('div');
    const webPart = new TestSolidWebPart();
    initialize(webPart, domElement);
    webPart.render();
    (webPart as unknown as { _internalDeserialize(data: { properties: { title: string }; dataVersion: string }): void })._internalDeserialize({
      properties: { title: 'Updated' },
      dataVersion: '1.0'
    });
    webPart.render();
    expect(domElement.textContent).toBe('Updated');
  });

  it('disposes the component and clears the container on dispose', () => {
    const domElement = document.createElement('div');
    const webPart = new TestSolidWebPart();
    initialize(webPart, domElement);
    webPart.render();
    (webPart as unknown as { onDispose(): void }).onDispose();
    expect(domElement.childNodes.length).toBe(0);
  });
});
