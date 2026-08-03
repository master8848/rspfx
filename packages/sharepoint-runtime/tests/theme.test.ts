import { describe, expect, it, vi } from 'vitest';

import { LOCAL_THEMES, createMockThemeProvider, type LocalThemeProvider } from '../src/theme.js';

const PALETTE_KEYS = [
  'themeDarker',
  'themeDark',
  'themeDarkAlt',
  'themePrimary',
  'themeSecondary',
  'themeTertiary',
  'themeLight',
  'themeLighter',
  'themeLighterAlt',
  'black',
  'blackTranslucent40',
  'neutralDark',
  'neutralPrimary',
  'neutralPrimaryAlt',
  'neutralSecondary',
  'neutralSecondaryAlt',
  'neutralTertiary',
  'neutralTertiaryAlt',
  'neutralQuaternary',
  'neutralQuaternaryAlt',
  'neutralLight',
  'neutralLighter',
  'neutralLighterAlt',
  'accent',
  'white',
  'whiteTranslucent40',
  'yellowDark',
  'yellow',
  'yellowLight',
  'orange',
  'orangeLight',
  'orangeLighter',
  'redDark',
  'red',
  'magentaDark',
  'magenta',
  'magentaLight',
  'purpleDark',
  'purple',
  'purpleLight',
  'blueDark',
  'blueMid',
  'blue',
  'blueLight',
  'tealDark',
  'teal',
  'tealLight',
  'greenDark',
  'green',
  'greenLight'
];

const SEMANTIC_COLORS_KEYS = [
  'bodyText',
  'bodyTextChecked',
  'bodySubtext',
  'actionLink',
  'actionLinkHovered',
  'link',
  'linkHovered',
  'disabledText',
  'disabledBodyText',
  'disabledSubtext',
  'disabledBodySubtext',
  'errorText',
  'messageText',
  'inputText',
  'inputTextHovered',
  'inputPlaceholderText',
  'buttonText',
  'buttonTextHovered',
  'buttonTextChecked',
  'buttonTextCheckedHovered',
  'buttonTextPressed',
  'buttonTextDisabled',
  'primaryButtonText',
  'primaryButtonTextHovered',
  'primaryButtonTextPressed',
  'primaryButtonTextDisabled',
  'accentButtonText',
  'listText',
  'listTextColor',
  'warningText',
  'successText',
  'bodyBackground',
  'bodyBackgroundHovered',
  'bodyBackgroundChecked',
  'bodyStandoutBackground',
  'bodyFrameBackground',
  'bodyFrameDivider',
  'bodyDivider',
  'disabledBackground',
  'disabledBorder',
  'focusBorder',
  'cardStandoutBackground',
  'cardShadow',
  'cardShadowHovered',
  'variantBorder',
  'variantBorderHovered',
  'defaultStateBackground',
  'infoBackground',
  'errorBackground',
  'blockingBackground',
  'warningBackground',
  'severeWarningBackground',
  'successBackground',
  'infoIcon',
  'errorIcon',
  'blockingIcon',
  'warningIcon',
  'severeWarningIcon',
  'successIcon',
  'messageLink',
  'messageLinkHovered',
  'inputBorder',
  'smallInputBorder',
  'inputBorderHovered',
  'inputBackground',
  'inputBackgroundChecked',
  'inputBackgroundCheckedHovered',
  'inputPlaceholderBackgroundChecked',
  'inputForegroundChecked',
  'inputFocusBorderAlt',
  'inputIconDisabled',
  'inputIcon',
  'inputIconHovered',
  'buttonBackground',
  'buttonBackgroundChecked',
  'buttonBackgroundHovered',
  'buttonBackgroundCheckedHovered',
  'buttonBackgroundDisabled',
  'buttonBackgroundPressed',
  'buttonBorder',
  'buttonBorderDisabled',
  'primaryButtonBackground',
  'primaryButtonBackgroundHovered',
  'primaryButtonBackgroundPressed',
  'primaryButtonBackgroundDisabled',
  'primaryButtonBorder',
  'accentButtonBackground',
  'menuBackground',
  'menuDivider',
  'menuIcon',
  'menuHeader',
  'menuItemBackgroundHovered',
  'menuItemBackgroundPressed',
  'menuItemText',
  'menuItemTextHovered',
  'listBackground',
  'listItemBackgroundHovered',
  'listItemBackgroundChecked',
  'listItemBackgroundCheckedHovered',
  'listHeaderBackgroundHovered',
  'listHeaderBackgroundPressed',
  'menuItemBackgroundChecked',
  'warningHighlight'
];

const INVENTED_SEMANTIC_COLORS = [
  'bodyBlockingBackground',
  'bodyDisabledBackground',
  'bodyDisabledText',
  'bodyHoverBackground',
  'bodyHighlight',
  'bodyHighlightBackground',
  'bodyBackgroundCheckedHovered',
  'bodyBackgroundSelected',
  'linkPressed',
  'linkDisabled',
  'inputBackgroundHovered',
  'errorBorder',
  'infoText'
];

const FONT_KEYS = [
  'tiny',
  'xSmall',
  'small',
  'smallPlus',
  'medium',
  'mediumPlus',
  'large',
  'xLarge',
  'xLargePlus',
  'xxLarge',
  'xxLargePlus',
  'superLarge',
  'mega'
];

const EFFECTS_KEYS = ['elevation4', 'elevation8', 'elevation16', 'elevation64', 'roundedCorner2', 'roundedCorner4', 'roundedCorner6'];

const SPACING_KEYS = ['s2', 's1', 'm', 'l1', 'l2'];

function expectExactKeys(actual: Record<string, unknown>, expected: string[]): void {
  expect(Object.keys(actual).sort()).toEqual([...expected].sort());
}

describe('LOCAL_THEMES token sets', () => {
  it('light palette matches the full real IPalette key set', () => {
    expectExactKeys(LOCAL_THEMES.light.palette, PALETTE_KEYS);
  });

  it('dark palette matches the full real IPalette key set', () => {
    expectExactKeys(LOCAL_THEMES.dark.palette, PALETTE_KEYS);
  });

  it('light palette uses the real Fluent default values', () => {
    expect(LOCAL_THEMES.light.palette.themePrimary).toBe('#0078d4');
    expect(LOCAL_THEMES.light.palette.neutralQuaternary).toBe('#d2d0ce');
    expect(LOCAL_THEMES.light.palette.neutralSecondaryAlt).toBe('#8a8886');
    expect(LOCAL_THEMES.light.palette.accent).toBe('#0078d4');
    expect(LOCAL_THEMES.light.palette.blackTranslucent40).toBe('rgba(0,0,0,.4)');
    expect(LOCAL_THEMES.light.palette.whiteTranslucent40).toBe('rgba(255,255,255,.4)');
  });

  it('semanticColors contain exactly the real ISemanticColors member names', () => {
    for (const theme of [LOCAL_THEMES.light, LOCAL_THEMES.dark]) {
      expectExactKeys(theme.semanticColors, SEMANTIC_COLORS_KEYS);
    }
  });

  it('semanticColors no longer contain invented names', () => {
    for (const theme of [LOCAL_THEMES.light, LOCAL_THEMES.dark]) {
      for (const invented of INVENTED_SEMANTIC_COLORS) {
        expect(theme.semanticColors).not.toHaveProperty(invented);
      }
    }
  });

  it('effects contain exactly the 7 real IEffects keys', () => {
    expectExactKeys(LOCAL_THEMES.light.effects, EFFECTS_KEYS);
    expectExactKeys(LOCAL_THEMES.dark.effects, EFFECTS_KEYS);
    expect(LOCAL_THEMES.light.effects.roundedCorner2).toBe('2px');
    expect(LOCAL_THEMES.light.effects.roundedCorner4).toBe('4px');
    expect(LOCAL_THEMES.light.effects.roundedCorner6).toBe('6px');
  });

  it('spacing contains exactly the 5 real ISpacing keys with real values', () => {
    expectExactKeys(LOCAL_THEMES.light.spacing, SPACING_KEYS);
    expectExactKeys(LOCAL_THEMES.dark.spacing, SPACING_KEYS);
    expect(LOCAL_THEMES.light.spacing).toEqual({ s2: '4px', s1: '8px', m: '16px', l1: '20px', l2: '32px' });
  });

  it('fonts contain exactly the 13 real IFontStyles keys with the real size ramp', () => {
    expectExactKeys(LOCAL_THEMES.light.fonts, FONT_KEYS);
    expectExactKeys(LOCAL_THEMES.dark.fonts, FONT_KEYS);
    expect(LOCAL_THEMES.light.fonts.medium).toEqual({ fontFamily: expect.any(String), fontSize: '14px', fontWeight: 400 });
    expect(LOCAL_THEMES.light.fonts.xLarge).toEqual({ fontFamily: expect.any(String), fontSize: '20px', fontWeight: 600 });
    expect(LOCAL_THEMES.light.fonts.xxLargePlus).toEqual({ fontFamily: expect.any(String), fontSize: '32px', fontWeight: 600 });
    expect(LOCAL_THEMES.light.fonts.mega).toEqual({ fontFamily: expect.any(String), fontSize: '68px', fontWeight: 600 });
  });

  it('themes have no shadows or type properties', () => {
    for (const theme of [LOCAL_THEMES.light, LOCAL_THEMES.dark]) {
      expect(theme).not.toHaveProperty('shadows');
      expect(theme).not.toHaveProperty('type');
    }
  });

  it('dark is inverted and differs from light', () => {
    expect(LOCAL_THEMES.light.isInverted).toBe(false);
    expect(LOCAL_THEMES.dark.isInverted).toBe(true);
    expect(LOCAL_THEMES.dark.palette.themePrimary).not.toBe(LOCAL_THEMES.light.palette.themePrimary);
    expect(LOCAL_THEMES.dark.semanticColors.bodyBackground).not.toBe(LOCAL_THEMES.light.semanticColors.bodyBackground);
    expect(LOCAL_THEMES.dark.palette.white).toBe('#1b1a19');
  });
});

describe('createMockThemeProvider', () => {
  it('tryGetTheme returns the current theme (default light)', () => {
    const provider = createMockThemeProvider();
    expect(provider.tryGetTheme()).toBe(LOCAL_THEMES.light);
    expect(provider.getTheme()).toBe(LOCAL_THEMES.light);
  });

  it('accepts an initial theme and tryGetThemeV2 is undefined', () => {
    const provider = createMockThemeProvider(LOCAL_THEMES.dark);
    expect(provider.tryGetTheme()).toBe(LOCAL_THEMES.dark);
    expect(provider.tryGetThemeV2()).toBeUndefined();
  });

  it('themeChangedEvent.add(observer, callback) fires with the new theme after setTheme', () => {
    const provider = createMockThemeProvider();
    const observer = {};
    const handler = vi.fn();
    provider.themeChangedEvent.add(observer, handler);
    provider.setTheme(LOCAL_THEMES.dark);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ theme: LOCAL_THEMES.dark });
    expect(provider.tryGetTheme()).toBe(LOCAL_THEMES.dark);
  });

  it('themeChangedEvent.remove(observer, callback) stops delivery', () => {
    const provider = createMockThemeProvider();
    const observer = {};
    const handler = vi.fn();
    provider.themeChangedEvent.add(observer, handler);
    provider.themeChangedEvent.remove(observer, handler);
    provider.setTheme(LOCAL_THEMES.dark);
    expect(handler).not.toHaveBeenCalled();
  });

  it('themeChangedEvent.remove(observer) removes every handler of that observer', () => {
    const provider = createMockThemeProvider();
    const observer = {};
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    provider.themeChangedEvent.add(observer, handlerA);
    provider.themeChangedEvent.add(observer, handlerB);
    provider.themeChangedEvent.remove(observer);
    provider.setTheme(LOCAL_THEMES.dark);
    expect(handlerA).not.toHaveBeenCalled();
    expect(handlerB).not.toHaveBeenCalled();
  });

  it('themeChangedEvent.add accepts a 1-arg callback form', () => {
    const provider = createMockThemeProvider();
    const handler = vi.fn();
    provider.themeChangedEvent.add(handler);
    provider.setTheme(LOCAL_THEMES.dark);
    expect(handler).toHaveBeenCalledWith({ theme: LOCAL_THEMES.dark });
  });

  it('a failing handler does not break other listeners', () => {
    const provider = createMockThemeProvider();
    const observerA = {};
    const observerB = {};
    const failing = vi.fn(() => {
      throw new Error('boom');
    });
    const fine = vi.fn();
    provider.themeChangedEvent.add(observerA, failing);
    provider.themeChangedEvent.add(observerB, fine);
    expect(() => provider.setTheme(LOCAL_THEMES.dark)).not.toThrow();
    expect(fine).toHaveBeenCalledWith({ theme: LOCAL_THEMES.dark });
  });

  it('addChangeListener/removeChangeListener roundtrip', () => {
    const provider = createMockThemeProvider();
    const listener = vi.fn();
    provider.addChangeListener(listener);
    provider.setTheme(LOCAL_THEMES.dark);
    expect(listener).toHaveBeenCalledTimes(1);
    provider.removeChangeListener(listener);
    provider.setTheme(LOCAL_THEMES.light);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('setTheme(undefined) clears the theme and reports it', () => {
    const provider = createMockThemeProvider();
    const handler = vi.fn();
    provider.themeChangedEvent.add({}, handler);
    provider.setTheme(undefined);
    expect(provider.tryGetTheme()).toBeUndefined();
    expect(handler).toHaveBeenCalledWith({ theme: undefined });
  });

  it('dispose clears the theme and all listeners', () => {
    const provider = createMockThemeProvider();
    const handler = vi.fn();
    const listener = vi.fn();
    provider.themeChangedEvent.add({}, handler);
    provider.addChangeListener(listener);
    provider.dispose();
    expect(provider.tryGetTheme()).toBeUndefined();
    provider.setTheme(LOCAL_THEMES.dark);
    expect(handler).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it('satisfies the core ThemeProvider contract', () => {
    const provider: LocalThemeProvider = createMockThemeProvider();
    const core: { getTheme(): unknown; addChangeListener(l: () => void): void; removeChangeListener(l: () => void): void } =
      provider;
    expect(core.getTheme()).toBe(LOCAL_THEMES.light);
    expect(() => core.addChangeListener(() => {})).not.toThrow();
    expect(() => core.removeChangeListener(() => {})).not.toThrow();
  });
});
