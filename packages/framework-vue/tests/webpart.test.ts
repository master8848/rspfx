// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { h, type Component } from 'vue';
import { VueWebPart } from '../src/webpart.js';

class TestVueWebPart extends VueWebPart<{ title: string }> {
  protected renderComponent(props: { title: string }): Component {
    return { render: () => h('div', null, props.title) };
  }
}

function initialize(webPart: TestVueWebPart, domElement: HTMLElement): void {
  (webPart as unknown as { _internalInitialize(ctx: { domElement: HTMLElement; manifest: unknown }): void })._internalInitialize({
    domElement,
    manifest: { id: '00000000-0000-0000-0000-000000000000', alias: 'TestWebPart' }
  });
  (webPart as unknown as { _internalDeserialize(data: { properties: { title: string }; dataVersion: string }): void })._internalDeserialize({
    properties: { title: 'Hello' },
    dataVersion: '1.0'
  });
}

describe('VueWebPart', () => {
  it('renders the vue component into the web part domElement', () => {
    const domElement = document.createElement('div');
    const webPart = new TestVueWebPart();
    initialize(webPart, domElement);
    webPart.render();
    expect(domElement.textContent).toBe('Hello');
  });

  it('re-renders with updated properties', () => {
    const domElement = document.createElement('div');
    const webPart = new TestVueWebPart();
    initialize(webPart, domElement);
    webPart.render();
    (webPart as unknown as { _internalDeserialize(data: { properties: { title: string }; dataVersion: string }): void })._internalDeserialize({
      properties: { title: 'Updated' },
      dataVersion: '1.0'
    });
    webPart.render();
    expect(domElement.textContent).toBe('Updated');
    expect(domElement.childNodes.length).toBe(1);
  });

  it('unmounts the app on dispose', () => {
    const domElement = document.createElement('div');
    const webPart = new TestVueWebPart();
    initialize(webPart, domElement);
    webPart.render();
    (webPart as unknown as { onDispose(): void }).onDispose();
    expect(domElement.childNodes.length).toBe(0);
  });
});
