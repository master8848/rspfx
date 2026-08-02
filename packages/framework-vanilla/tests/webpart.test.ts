// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { VanillaWebPart } from '../src/webpart.js';

class TestVanillaWebPart extends VanillaWebPart<{ title: string }> {
  protected renderComponent(props: { title: string }): HTMLElement {
    const element = document.createElement('div');
    element.textContent = props.title;
    return element;
  }
}

class TestStringVanillaWebPart extends VanillaWebPart<{ title: string }> {
  protected renderComponent(props: { title: string }): string {
    return props.title;
  }
}

function initialize(webPart: VanillaWebPart<{ title: string }>, domElement: HTMLElement): void {
  (webPart as unknown as { _internalInitialize(ctx: { domElement: HTMLElement; manifest: unknown }): void })._internalInitialize({
    domElement,
    manifest: { id: '00000000-0000-0000-0000-000000000000', alias: 'TestWebPart' }
  });
  (webPart as unknown as { _internalDeserialize(data: { properties: { title: string }; dataVersion: string }): void })._internalDeserialize({
    properties: { title: 'Hello' },
    dataVersion: '1.0'
  });
}

describe('VanillaWebPart', () => {
  it('renders the component into the web part domElement', () => {
    const domElement = document.createElement('div');
    const webPart = new TestVanillaWebPart();
    initialize(webPart, domElement);
    webPart.render();
    expect(domElement.childNodes.length).toBe(1);
    expect(domElement.textContent).toBe('Hello');
  });

  it('re-renders with updated properties, replacing the previous content', () => {
    const domElement = document.createElement('div');
    const webPart = new TestVanillaWebPart();
    initialize(webPart, domElement);
    webPart.render();
    (webPart as unknown as { _internalDeserialize(data: { properties: { title: string }; dataVersion: string }): void })._internalDeserialize({
      properties: { title: 'Updated' },
      dataVersion: '1.0'
    });
    webPart.render();
    expect(domElement.childNodes.length).toBe(1);
    expect(domElement.textContent).toBe('Updated');
  });

  it('unmounts the component on dispose', () => {
    const domElement = document.createElement('div');
    const webPart = new TestVanillaWebPart();
    initialize(webPart, domElement);
    webPart.render();
    (webPart as unknown as { onDispose(): void }).onDispose();
    expect(domElement.childNodes.length).toBe(0);
  });

  it('renders a string return value as a text node', () => {
    const domElement = document.createElement('div');
    const webPart = new TestStringVanillaWebPart();
    initialize(webPart, domElement);
    webPart.render();
    expect(domElement.childNodes.length).toBe(1);
    expect(domElement.childNodes[0]!.nodeType).toBe(3);
    expect(domElement.textContent).toBe('Hello');
  });
});
