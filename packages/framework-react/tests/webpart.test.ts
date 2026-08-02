// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { act, createElement, type ReactElement } from 'react';
import { ReactWebPart } from '../src/webpart.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class TestReactWebPart extends ReactWebPart<{ title: string }> {
  protected renderComponent(props: { title: string }): ReactElement {
    return createElement('div', { className: 'title' }, props.title);
  }
}

function initialize(webPart: TestReactWebPart, domElement: HTMLElement): void {
  (webPart as unknown as { _internalInitialize(ctx: { domElement: HTMLElement; manifest: unknown }): void })._internalInitialize({
    domElement,
    manifest: { id: '00000000-0000-0000-0000-000000000000', alias: 'TestWebPart' }
  });
  (webPart as unknown as { _internalDeserialize(data: { properties: { title: string }; dataVersion: string }): void })._internalDeserialize({
    properties: { title: 'Hello' },
    dataVersion: '1.0'
  });
}

describe('ReactWebPart', () => {
  it('renders the react component into the web part domElement', () => {
    const domElement = document.createElement('div');
    const webPart = new TestReactWebPart();
    initialize(webPart, domElement);
    act(() => {
      webPart.render();
    });
    expect(domElement.textContent).toBe('Hello');
  });

  it('re-renders with updated properties', () => {
    const domElement = document.createElement('div');
    const webPart = new TestReactWebPart();
    initialize(webPart, domElement);
    act(() => {
      webPart.render();
    });
    (webPart as unknown as { _internalDeserialize(data: { properties: { title: string }; dataVersion: string }): void })._internalDeserialize({
      properties: { title: 'Updated' },
      dataVersion: '1.0'
    });
    act(() => {
      webPart.render();
    });
    expect(domElement.textContent).toBe('Updated');
  });

  it('unmounts the component tree on dispose', () => {
    const domElement = document.createElement('div');
    const webPart = new TestReactWebPart();
    initialize(webPart, domElement);
    act(() => {
      webPart.render();
    });
    act(() => {
      (webPart as unknown as { onDispose(): void }).onDispose();
    });
    expect(domElement.childNodes.length).toBe(0);
  });
});
