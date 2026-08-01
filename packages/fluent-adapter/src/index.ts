import type { ThemeProvider as ThemeProviderLike } from '@mbsks/rspfx-core';
import { ReactWebPart } from '@mbsks/rspfx-framework-react/webpart';
import { ThemeProvider, createTheme, type ITheme } from '@fluentui/react';
import { createElement, type ReactElement } from 'react';

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
  { fluentKey: 'black', spfxKeys: ['black'], fallback: '#000000' }
];

export abstract class FluentWebPart<
  TProps extends Record<string, unknown>,
  TState = unknown
> extends ReactWebPart<TProps, TState> {
  private _fluentTheme: ITheme = createTheme({
    palette: this._buildNeutralPalette()
  });

  private readonly _handleThemeChanged = (): void => {
    this._fluentTheme = this._buildFluentTheme();
    this.render();
  };

  protected abstract override getComponentProps(): TProps;

  protected abstract renderFluentComponent(): ReactElement;

  public override async onInit(): Promise<void> {
    const themeProvider = this._themeProvider();
    if (themeProvider) {
      themeProvider.addChangeListener(this._handleThemeChanged);
    }
    this._fluentTheme = this._buildFluentTheme();
    await super.onInit();
  }

  protected override renderComponent(): ReactElement {
    return createElement(
      ThemeProvider,
      { theme: this._fluentTheme },
      this.renderFluentComponent()
    );
  }

  protected override onDispose(): void {
    this._themeProvider()?.removeChangeListener(this._handleThemeChanged);
    super.onDispose();
  }

  private _themeProvider(): ThemeProviderLike | undefined {
    return (this.context as unknown as { themeProvider?: ThemeProviderLike }).themeProvider;
  }

  private _buildNeutralPalette(): Record<string, string> {
    const palette: Record<string, string> = {};
    for (const entry of PALETTE_ENTRIES) {
      palette[entry.fluentKey] = entry.fallback;
    }
    return palette;
  }

  private _resolvePaletteValue(
    spfxPalette: Record<string, string> | undefined,
    spfxKeys: string[],
    fallback: string
  ): string {
    for (const key of spfxKeys) {
      const value = spfxPalette?.[key];
      if (value) {
        return value;
      }
    }
    return fallback;
  }

  private _buildFluentTheme(): ITheme {
    const spfxPalette = this._themeProvider()?.getTheme()?.palette;
    const palette: Record<string, string> = {};
    for (const entry of PALETTE_ENTRIES) {
      palette[entry.fluentKey] = this._resolvePaletteValue(spfxPalette, entry.spfxKeys, entry.fallback);
    }
    return createTheme({ palette });
  }
}
