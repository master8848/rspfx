// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ITheme } from '@fluentui/react';

import { FluentWebPart } from '../src/index.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface MockAdapter {
  name: string;
  mount: ReturnType<typeof vi.fn>;
  unmount: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  supportsFastRefresh: () => boolean;
}

function createMockAdapter(): MockAdapter {
  let root: Root | undefined;
  return {
    name: 'react-test',
    mount: vi.fn((host: HTMLElement, component: unknown) => {
      if (!root) {
        root = createRoot(host);
      }
      root.render(component as ReactElement);
    }),
    unmount: vi.fn(() => {
      root?.unmount();
    }),
    update: vi.fn(),
    supportsFastRefresh: () => false
  };
}

function createFakeThemeProvider(palette: Record<string, string>) {
  const addChangeListener = vi.fn();
  const removeChangeListener = vi.fn();
  return {
    palette,
    addChangeListener,
    removeChangeListener,
    getTheme: () => ({ palette })
  };
}

class TestWebPart extends FluentWebPart<{ title: string }> {
  public constructor(private readonly adapter: MockAdapter) {
    super();
  }

  protected override get frameworkAdapter(): MockAdapter | null {
    return this.adapter;
  }

  protected override getComponentProps(): { title: string } {
    return this.properties;
  }

  protected override renderFluentComponent(): ReactElement {
    return createElement('div', { className: 'fluent-child' }, this.getComponentProps().title);
  }
}

function initialize(webPart: TestWebPart, domElement: HTMLElement, context: Record<string, unknown>): void {
  (webPart as unknown as { _internalInitialize(ctx: unknown): void })._internalInitialize({
    domElement,
    manifest: { id: '00000000-0000-0000-0000-000000000000', alias: 'TestWebPart' },
    ...context
  });
  (webPart as unknown as { _internalDeserialize(data: unknown): void })._internalDeserialize({
    properties: { title: 'Hello' },
    dataVersion: '1.0'
  });
}

describe('FluentWebPart', () => {
  it('renders the fluent component wrapped in a ThemeProvider', async () => {
    const adapter = createMockAdapter();
    const domElement = document.createElement('div');
    const webPart = new TestWebPart(adapter);
    initialize(webPart, domElement, { themeProvider: createFakeThemeProvider({}) });

    await webPart.onInit();
    act(() => {
      webPart.render();
    });

    expect(domElement.childNodes.length).toBeGreaterThan(0);
    const child = domElement.querySelector('.fluent-child');
    expect(child).not.toBeNull();
    expect(child?.textContent).toBe('Hello');
  });

  it('maps the spfx theme palette into the fluent theme', async () => {
    const adapter = createMockAdapter();
    const webPart = new TestWebPart(adapter);
    initialize(webPart, document.createElement('div'), {
      themeProvider: createFakeThemeProvider({
        themePrimary: '#aa0000',
        themeDarker: '#bb0000',
        themeLighter: '#cc0000',
        neutralPrimary: '#111111',
        neutralSecondary: '#222222',
        neutralTertiary: '#333333',
        white: '#ffffff',
        black: '#000000',
        themeDarkAlt: '#444444',
        themeTertiary: '#555555',
        themeLight: '#666666'
      })
    });

    await webPart.onInit();

    const theme = (webPart as unknown as { _fluentTheme: ITheme })._fluentTheme;
    expect(theme.palette.themePrimary).toBe('#aa0000');
    expect(theme.palette.themeDark).toBe('#bb0000');
    expect(theme.palette.themeDarkAlt).toBe('#444444');
    expect(theme.palette.themeLighter).toBe('#cc0000');
    expect(theme.palette.neutralPrimary).toBe('#111111');
    expect(theme.palette.white).toBe('#ffffff');
    expect(theme.palette.themeLighterAlt).toBe('#eff6fc');
  });

  it('renders with a neutral default theme when no themeProvider exists', async () => {
    const adapter = createMockAdapter();
    const domElement = document.createElement('div');
    const webPart = new TestWebPart(adapter);
    initialize(webPart, domElement, {});

    await expect(webPart.onInit()).resolves.toBeUndefined();
    expect(() =>
      act(() => {
        webPart.render();
      })
    ).not.toThrow();

    const theme = (webPart as unknown as { _fluentTheme: ITheme })._fluentTheme;
    expect(theme.palette.themePrimary).toBe('#0078d4');
    expect(domElement.childNodes.length).toBeGreaterThan(0);
  });

  it('subscribes to theme changes on init and unsubscribes on dispose', async () => {
    const adapter = createMockAdapter();
    const themeProvider = createFakeThemeProvider({});
    const webPart = new TestWebPart(adapter);
    initialize(webPart, document.createElement('div'), { themeProvider });

    await webPart.onInit();
    expect(themeProvider.addChangeListener).toHaveBeenCalledTimes(1);

    (webPart as unknown as { onDispose(): void }).onDispose();
    expect(themeProvider.removeChangeListener).toHaveBeenCalledTimes(1);
  });

  it('re-renders with the updated theme when the themeProvider emits a change', async () => {
    const adapter = createMockAdapter();
    const themeProvider = createFakeThemeProvider({ themePrimary: '#123456' });
    const domElement = document.createElement('div');
    const webPart = new TestWebPart(adapter);
    initialize(webPart, domElement, { themeProvider });

    await webPart.onInit();
    act(() => {
      webPart.render();
    });
    expect((webPart as unknown as { _fluentTheme: ITheme })._fluentTheme.palette.themePrimary).toBe(
      '#123456'
    );

    themeProvider.palette.themePrimary = '#654321';
    const listener = themeProvider.addChangeListener.mock.calls[0]?.[0] as () => void;
    act(() => {
      listener();
    });

    expect((webPart as unknown as { _fluentTheme: ITheme })._fluentTheme.palette.themePrimary).toBe(
      '#654321'
    );
    expect(domElement.querySelector('.fluent-child')?.textContent).toBe('Hello');
  });
});
