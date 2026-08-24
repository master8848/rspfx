import type { ThemeProvider as ThemeProviderLike } from '@mbsks/rspfx-core';
import type { HeadlessAdapter } from '@mbsks/rspfx-core/headless';
import { HeadlessWebPart } from '@mbsks/rspfx-webpart-base';
import { createReactAdapter } from '@mbsks/rspfx-framework-react/headless';
import { ThemeProvider, createTheme, type ITheme } from '@fluentui/react';
import { createElement, type ReactElement, type ReactNode } from 'react';

const PALETTE_ENTRIES: { fluentKey: string; spfxKeys: string[]; fallback: string }[] = [
  { fluentKey: 'themePrimary', spfxKeys: ['themePrimary'], fallback: '#0078d4' },
  { fluentKey: 'themeLighter', spfxKeys: ['themeLighter'], fallback: '#deecf9' },
  { fluentKey: 'themeLighterAlt', spfxKeys: ['themeLighterAlt'], fallback: '#eff6fc' },
  { fluentKey: 'themeDark', spfxKeys: ['themeDark', 'themeDarker'], fallback: '#005a9e' },
  { fluentKey: 'themeDarkAlt', spfxKeys: ['themeDarkAlt'], fallback: '#106ebe' },
  { fluentKey: 'themeTertiary', spfxKeys: ['themeTertiary'], fallback: '#71afe5' },
  { fluentKey: 'themeLight', spfxKeys: ['themeLight'], fallback: '#c7e0f4' },
  { fluentKey: 'neutralPrimary', spfxKeys: ['neutralPrimary'], fallback: '#323130' },
  { fluentKey: 'neutralSecondary', spfxKeys: ['neutralSecondary'], fallback: '#605e5c' },
  { fluentKey: 'neutralTertiary', spfxKeys: ['neutralTertiary'], fallback: '#a19f9d' },
  { fluentKey: 'white', spfxKeys: ['white'], fallback: '#ffffff' },
  { fluentKey: 'black', spfxKeys: ['black'], fallback: '#000000' },
];

function buildNeutralPalette(): Record<string, string> {
  const palette: Record<string, string> = {};
  for (const entry of PALETTE_ENTRIES) {
    palette[entry.fluentKey] = entry.fallback;
  }
  return palette;
}

function resolvePaletteValue(
  spfxPalette: Record<string, string> | undefined,
  spfxKeys: string[],
  fallback: string,
): string {
  for (const key of spfxKeys) {
    const value = spfxPalette?.[key];
    if (value) return value;
  }
  return fallback;
}

function buildFluentTheme(themeProvider?: ThemeProviderLike): ITheme {
  const spfxPalette = themeProvider?.getTheme()?.palette;
  const palette: Record<string, string> = {};
  for (const entry of PALETTE_ENTRIES) {
    palette[entry.fluentKey] = resolvePaletteValue(spfxPalette, entry.spfxKeys, entry.fallback);
  }
  return createTheme({ palette });
}

export function createFluentAdapter<TProps extends Record<string, unknown>>(
  renderFluent: (props: TProps, theme: ITheme) => ReactNode,
  getThemeProvider?: () => ThemeProviderLike | undefined,
  getTheme?: () => ITheme,
): HeadlessAdapter<TProps> {
  return createReactAdapter<TProps>((props) => {
    const theme = getTheme ? getTheme() : createTheme({ palette: buildNeutralPalette() });
    const maybeProvider = getThemeProvider?.();
    const inner = renderFluent(props, theme);
    if (maybeProvider) {
      return createElement(ThemeProvider, { theme }, inner as ReactElement);
    }
    return createElement(ThemeProvider, { theme }, inner as ReactElement);
  });
}

export abstract class FluentWebPart<
  TProps extends Record<string, unknown>,
  TState = unknown
> extends HeadlessWebPart<TProps> {
  private _fluentTheme: ITheme = createTheme({
    palette: buildNeutralPalette(),
  });

  private readonly _handleThemeChanged = (): void => {
    this._fluentTheme = buildFluentTheme(this._themeProvider());
    this.render();
  };

  protected abstract override getComponentProps(): TProps;

  protected abstract renderFluentComponent(props?: TProps): ReactElement;

  public override async onInit(): Promise<void> {
    const themeProvider = this._themeProvider();
    if (themeProvider) {
      themeProvider.addChangeListener(this._handleThemeChanged);
    }
    this._fluentTheme = buildFluentTheme(themeProvider);
    await super.onInit();
  }

  protected override createAdapter(): HeadlessAdapter<TProps> {
    return createReactAdapter<TProps>(() => {
      const props = this.getComponentProps();
      let inner: ReactNode;
      try {
        inner = (this.renderFluentComponent as unknown as (p: TProps) => ReactElement)(props);
      } catch {
        inner = (this.renderFluentComponent as unknown as () => ReactElement)();
      }
      return createElement(ThemeProvider, { theme: this._fluentTheme }, inner as ReactElement);
    });
  }

  protected override onDispose(): void {
    this._themeProvider()?.removeChangeListener(this._handleThemeChanged);
    super.onDispose();
  }

  private _themeProvider(): ThemeProviderLike | undefined {
    return (this.context as unknown as { themeProvider?: ThemeProviderLike }).themeProvider;
  }
}
