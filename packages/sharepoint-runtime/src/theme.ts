import type { ISpfxTheme, ThemeProvider } from '@mbsks/rspfx-core';

/**
 * Fluent (v8) default token sets for the local preview, mirroring what
 * `@microsoft/sp-component-base` theme providers deliver on a real page:
 * palette, semantic colors, fonts, effects, spacing and `isInverted`.
 * Member names and light values are taken from `@fluentui/theme`'s
 * `DefaultPalette`, `DefaultFontStyles`, `DefaultEffects`, `DefaultSpacing`
 * and the `makeSemanticColors` algorithm. Light is the default site theme;
 * dark approximates the SharePoint "Dark gray" theme.
 */

const FONT_FAMILY =
  "'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif";

interface FluentTheme extends ISpfxTheme {
  palette: Record<string, string>;
  semanticColors: Record<string, string>;
  fonts: Record<string, { fontFamily: string; fontSize: string; fontWeight: number }>;
  effects: Record<string, string>;
  spacing: Record<string, string>;
  isInverted: boolean;
}

function fluentTheme(isInverted: boolean): FluentTheme {
  const light = !isInverted;
  const palette = light
    ? {
        themeDarker: '#004578',
        themeDark: '#005a9e',
        themeDarkAlt: '#106ebe',
        themePrimary: '#0078d4',
        themeSecondary: '#2b88d8',
        themeTertiary: '#71afe5',
        themeLight: '#c7e0f4',
        themeLighter: '#deecf9',
        themeLighterAlt: '#eff6fc',
        black: '#000000',
        blackTranslucent40: 'rgba(0,0,0,.4)',
        neutralDark: '#201f1e',
        neutralPrimary: '#323130',
        neutralPrimaryAlt: '#3b3a39',
        neutralSecondary: '#605e5c',
        neutralSecondaryAlt: '#8a8886',
        neutralTertiary: '#a19f9d',
        neutralTertiaryAlt: '#c8c6c4',
        neutralQuaternary: '#d2d0ce',
        neutralQuaternaryAlt: '#e1dfdd',
        neutralLight: '#edebe9',
        neutralLighter: '#f3f2f1',
        neutralLighterAlt: '#faf9f8',
        accent: '#0078d4',
        white: '#ffffff',
        whiteTranslucent40: 'rgba(255,255,255,.4)',
        yellowDark: '#d29200',
        yellow: '#ffb900',
        yellowLight: '#fff100',
        orange: '#d83b01',
        orangeLight: '#ea4300',
        orangeLighter: '#ff8c00',
        redDark: '#a4262c',
        red: '#e81123',
        magentaDark: '#5c005c',
        magenta: '#b4009e',
        magentaLight: '#e3008c',
        purpleDark: '#32145a',
        purple: '#5c2d91',
        purpleLight: '#b4a0ff',
        blueDark: '#002050',
        blueMid: '#00188f',
        blue: '#0078d4',
        blueLight: '#00bcf2',
        tealDark: '#004b50',
        teal: '#008272',
        tealLight: '#00b294',
        greenDark: '#004b1c',
        green: '#107c10',
        greenLight: '#bad80a'
      }
    : {
        themePrimary: '#2899f5',
        themeLighterAlt: '#02060a',
        themeLighter: '#082238',
        themeLight: '#0e3f5c',
        themeTertiary: '#1d6ea8',
        themeSecondary: '#2498e6',
        themeDarkAlt: '#46a6f6',
        themeDark: '#62b4f8',
        themeDarker: '#8ac9fb',
        neutralLighterAlt: '#0b0b0c',
        neutralLighter: '#161616',
        neutralLight: '#222222',
        neutralQuaternaryAlt: '#282828',
        neutralQuaternary: '#303030',
        neutralTertiaryAlt: '#494949',
        neutralTertiary: '#bdbdbd',
        neutralSecondary: '#d0d0d0',
        neutralSecondaryAlt: '#6b6b6b',
        neutralPrimaryAlt: '#dadada',
        neutralPrimary: '#e6e6e6',
        neutralDark: '#f4f4f4',
        black: '#f8f8f8',
        blackTranslucent40: 'rgba(0,0,0,.4)',
        accent: '#2899f5',
        white: '#1b1a19',
        whiteTranslucent40: 'rgba(255,255,255,.4)',
        yellowDark: '#d29200',
        yellow: '#ffb900',
        yellowLight: '#fff100',
        orange: '#d83b01',
        orangeLight: '#ea4300',
        orangeLighter: '#ff8c00',
        redDark: '#f1707b',
        red: '#e81123',
        magentaDark: '#5c005c',
        magenta: '#b4009e',
        magentaLight: '#e3008c',
        purpleDark: '#32145a',
        purple: '#5c2d91',
        purpleLight: '#b4a0ff',
        blueDark: '#002050',
        blueMid: '#00188f',
        blue: '#2899f5',
        blueLight: '#00bcf2',
        tealDark: '#004b50',
        teal: '#008272',
        tealLight: '#00b294',
        greenDark: '#004b1c',
        green: '#107c10',
        greenLight: '#92c353'
      };
  const semanticColors: Record<string, string> = {
    primaryButtonBorder: 'transparent',
    errorText: light ? '#a4262c' : '#F1707B',
    messageText: light ? '#323130' : '#F3F2F1',
    messageLink: light ? '#005A9E' : '#6CB8F6',
    messageLinkHovered: light ? '#004578' : '#82C7FF',
    infoIcon: light ? '#605e5c' : '#C8C6C4',
    errorIcon: light ? '#A80000' : '#F1707B',
    blockingIcon: light ? '#FDE7E9' : '#442726',
    warningIcon: light ? '#797775' : '#C8C6C4',
    severeWarningIcon: light ? '#D83B01' : '#FCE100',
    successIcon: light ? '#107C10' : '#92C353',
    infoBackground: light ? '#f3f2f1' : '#323130',
    errorBackground: light ? '#FDE7E9' : '#442726',
    blockingBackground: light ? '#FDE7E9' : '#442726',
    warningBackground: light ? '#FFF4CE' : '#433519',
    severeWarningBackground: light ? '#FED9CC' : '#4F2A0F',
    successBackground: light ? '#DFF6DD' : '#393D1B',
    warningHighlight: light ? '#ffb900' : '#fff100',
    successText: light ? '#107C10' : '#92c353',
    bodyBackground: palette.white,
    bodyFrameBackground: palette.white,
    accentButtonText: palette.white,
    buttonBackground: palette.white,
    primaryButtonText: palette.white,
    primaryButtonTextHovered: palette.white,
    primaryButtonTextPressed: palette.white,
    inputBackground: palette.white,
    inputForegroundChecked: palette.white,
    listBackground: palette.white,
    menuBackground: palette.white,
    cardStandoutBackground: palette.white,
    bodyTextChecked: palette.black,
    buttonTextCheckedHovered: palette.black,
    link: palette.themePrimary,
    primaryButtonBackground: palette.themePrimary,
    inputBackgroundChecked: palette.themePrimary,
    inputIcon: palette.themePrimary,
    inputFocusBorderAlt: palette.themePrimary,
    menuIcon: palette.themePrimary,
    menuHeader: palette.themePrimary,
    accentButtonBackground: palette.accent,
    primaryButtonBackgroundPressed: palette.themeDark,
    inputBackgroundCheckedHovered: palette.themeDark,
    inputIconHovered: palette.themeDark,
    linkHovered: palette.themeDarker,
    primaryButtonBackgroundHovered: palette.themeDarkAlt,
    inputPlaceholderBackgroundChecked: palette.themeLighter,
    bodyBackgroundChecked: palette.neutralLight,
    bodyFrameDivider: palette.neutralLight,
    bodyDivider: palette.neutralLight,
    variantBorder: palette.neutralLight,
    buttonBackgroundCheckedHovered: palette.neutralLight,
    buttonBackgroundPressed: palette.neutralLight,
    listItemBackgroundChecked: palette.neutralLight,
    listHeaderBackgroundPressed: palette.neutralLight,
    menuItemBackgroundPressed: palette.neutralLight,
    menuItemBackgroundChecked: palette.neutralLight,
    bodyBackgroundHovered: palette.neutralLighter,
    buttonBackgroundHovered: palette.neutralLighter,
    buttonBackgroundDisabled: palette.neutralLighter,
    buttonBorderDisabled: palette.neutralLighter,
    primaryButtonBackgroundDisabled: palette.neutralLighter,
    disabledBackground: palette.neutralLighter,
    listItemBackgroundHovered: palette.neutralLighter,
    listHeaderBackgroundHovered: palette.neutralLighter,
    menuItemBackgroundHovered: palette.neutralLighter,
    primaryButtonTextDisabled: palette.neutralQuaternary,
    disabledSubtext: palette.neutralQuaternary,
    listItemBackgroundCheckedHovered: palette.neutralQuaternaryAlt,
    disabledBodyText: palette.neutralTertiary,
    variantBorderHovered: palette.neutralTertiary,
    buttonTextDisabled: palette.neutralTertiary,
    inputIconDisabled: palette.neutralTertiary,
    disabledText: palette.neutralTertiary,
    bodyText: palette.neutralPrimary,
    actionLink: palette.neutralPrimary,
    buttonText: palette.neutralPrimary,
    inputBorderHovered: palette.neutralPrimary,
    inputText: palette.neutralPrimary,
    listText: palette.neutralPrimary,
    menuItemText: palette.neutralPrimary,
    bodyStandoutBackground: palette.neutralLighterAlt,
    defaultStateBackground: palette.neutralLighterAlt,
    actionLinkHovered: palette.neutralDark,
    buttonTextHovered: palette.neutralDark,
    buttonTextChecked: palette.neutralDark,
    buttonTextPressed: palette.neutralDark,
    inputTextHovered: palette.neutralDark,
    menuItemTextHovered: palette.neutralDark,
    bodySubtext: palette.neutralSecondary,
    focusBorder: palette.neutralSecondary,
    inputBorder: palette.neutralSecondary,
    smallInputBorder: palette.neutralSecondary,
    inputPlaceholderText: palette.neutralSecondary,
    buttonBorder: palette.neutralSecondaryAlt,
    disabledBodySubtext: palette.neutralTertiaryAlt,
    disabledBorder: palette.neutralTertiaryAlt,
    buttonBackgroundChecked: palette.neutralTertiaryAlt,
    menuDivider: palette.neutralTertiaryAlt,
    cardShadow:
      '0 1.6px 3.6px 0 rgba(0, 0, 0, 0.132), 0 0.3px 0.9px 0 rgba(0, 0, 0, 0.108)',
    cardShadowHovered: light
      ? '0 3.2px 7.2px 0 rgba(0, 0, 0, 0.132), 0 0.6px 1.8px 0 rgba(0, 0, 0, 0.108)'
      : '0 0 1px #bdbdbd',
    listTextColor: palette.neutralPrimary,
    warningText: light ? '#323130' : '#F3F2F1'
  };
  const fonts: FluentTheme['fonts'] = {
    tiny: { fontFamily: FONT_FAMILY, fontSize: '10px', fontWeight: 400 },
    xSmall: { fontFamily: FONT_FAMILY, fontSize: '10px', fontWeight: 400 },
    small: { fontFamily: FONT_FAMILY, fontSize: '12px', fontWeight: 400 },
    smallPlus: { fontFamily: FONT_FAMILY, fontSize: '12px', fontWeight: 400 },
    medium: { fontFamily: FONT_FAMILY, fontSize: '14px', fontWeight: 400 },
    mediumPlus: { fontFamily: FONT_FAMILY, fontSize: '16px', fontWeight: 400 },
    large: { fontFamily: FONT_FAMILY, fontSize: '18px', fontWeight: 400 },
    xLarge: { fontFamily: FONT_FAMILY, fontSize: '20px', fontWeight: 600 },
    xLargePlus: { fontFamily: FONT_FAMILY, fontSize: '24px', fontWeight: 600 },
    xxLarge: { fontFamily: FONT_FAMILY, fontSize: '28px', fontWeight: 600 },
    xxLargePlus: { fontFamily: FONT_FAMILY, fontSize: '32px', fontWeight: 600 },
    superLarge: { fontFamily: FONT_FAMILY, fontSize: '42px', fontWeight: 600 },
    mega: { fontFamily: FONT_FAMILY, fontSize: '68px', fontWeight: 600 }
  };
  const effects = {
    elevation4:
      '0 1.6px 3.6px 0 rgba(0, 0, 0, 0.132), 0 0.3px 0.9px 0 rgba(0, 0, 0, 0.108)',
    elevation8:
      '0 3.2px 7.2px 0 rgba(0, 0, 0, 0.132), 0 0.6px 1.8px 0 rgba(0, 0, 0, 0.108)',
    elevation16:
      '0 6.4px 14.4px 0 rgba(0, 0, 0, 0.132), 0 1.2px 3.6px 0 rgba(0, 0, 0, 0.108)',
    elevation64:
      '0 25.6px 57.6px 0 rgba(0, 0, 0, 0.22), 0 4.8px 14.4px 0 rgba(0, 0, 0, 0.18)',
    roundedCorner2: '2px',
    roundedCorner4: '4px',
    roundedCorner6: '6px'
  };
  return {
    palette,
    semanticColors,
    fonts,
    effects,
    spacing: {
      s2: '4px',
      s1: '8px',
      m: '16px',
      l1: '20px',
      l2: '32px'
    },
    isInverted
  };
}

export const LOCAL_THEMES = {
  light: fluentTheme(false),
  dark: fluentTheme(true)
} as const;

export interface LocalThemeProvider extends ThemeProvider {
  tryGetTheme(): ISpfxTheme | undefined;
  tryGetThemeV2(): unknown;
  getTheme(): ISpfxTheme | undefined;
  themeChangedEvent: {
    add(
      observer: unknown,
      callback?: (args: { theme: ISpfxTheme | undefined }) => void
    ): void;
    remove(
      observer: unknown,
      callback?: (args: { theme: ISpfxTheme | undefined }) => void
    ): void;
  };
  setTheme(theme: ISpfxTheme | undefined): void;
  dispose(): void;
}

interface ThemeChangedEntry {
  observer: unknown;
  callback: (args: { theme: ISpfxTheme | undefined }) => void;
}

export function createMockThemeProvider(initialTheme?: ISpfxTheme): LocalThemeProvider {
  let theme: ISpfxTheme | undefined = initialTheme ?? LOCAL_THEMES.light;
  const entries = new Set<ThemeChangedEntry>();
  const changeListeners = new Set<() => void>();
  const themeChangedEvent: LocalThemeProvider['themeChangedEvent'] = {
    add(observer: unknown, callback?: (args: { theme: ISpfxTheme | undefined }) => void): void {
      const handler = callback ?? (observer as (args: { theme: ISpfxTheme | undefined }) => void);
      entries.add({ observer, callback: handler });
    },
    remove(observer: unknown, callback?: (args: { theme: ISpfxTheme | undefined }) => void): void {
      for (const entry of [...entries]) {
        if (entry.observer === observer && (callback === undefined || entry.callback === callback)) {
          entries.delete(entry);
        }
      }
    }
  };
  const notify = (next: ISpfxTheme | undefined): void => {
    for (const entry of [...entries]) {
      try {
        entry.callback({ theme: next });
      } catch {
        // A theme change listener must not break other listeners.
      }
    }
    for (const listener of [...changeListeners]) {
      try {
        listener();
      } catch {
        // A theme change listener must not break other listeners.
      }
    }
  };
  return {
    tryGetTheme: () => theme,
    tryGetThemeV2: () => undefined,
    getTheme: () => theme,
    themeChangedEvent,
    addChangeListener: (listener) => {
      changeListeners.add(listener);
    },
    removeChangeListener: (listener) => {
      changeListeners.delete(listener);
    },
    setTheme: (next) => {
      theme = next;
      notify(next);
    },
    dispose: () => {
      entries.clear();
      changeListeners.clear();
      theme = undefined;
    }
  };
}
