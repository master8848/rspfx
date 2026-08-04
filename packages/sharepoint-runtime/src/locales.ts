/**
 * Locale resolution for the local preview. Maps a locale tag from the
 * `?locale=` / `?market=` query parameter to the CultureInfo / language
 * values the emulated page context exposes (LCID + display name + RTL flag).
 */

export interface LocaleInfo {
  language: number;
  languageName: string;
  currentCultureName: string;
  currentUICultureName: string;
  isRightToLeft: boolean;
}

export interface ResolvedLocale {
  /** Normalized locale tag, e.g. `fr-fr`. */
  locale: string;
  cultureInfo: { currentCultureName: string; currentUICultureName: string; isRightToLeft: boolean };
  language: number;
  languageName: string;
}

export const DEFAULT_LOCALE = 'en-us';

export const DEFAULT_LOCALE_INFO: LocaleInfo = {
  language: 1033,
  languageName: 'English (United States)',
  currentCultureName: 'en-US',
  currentUICultureName: 'en-US',
  isRightToLeft: false
};

const LOCALE_TABLE: Record<string, LocaleInfo> = {
  'en-us': DEFAULT_LOCALE_INFO,
  'fr-fr': { language: 1036, languageName: 'French (France)', currentCultureName: 'fr-FR', currentUICultureName: 'fr-FR', isRightToLeft: false },
  'de-de': { language: 1031, languageName: 'German (Germany)', currentCultureName: 'de-DE', currentUICultureName: 'de-DE', isRightToLeft: false },
  'es-es': { language: 3082, languageName: 'Spanish (Spain)', currentCultureName: 'es-ES', currentUICultureName: 'es-ES', isRightToLeft: false },
  'it-it': { language: 1040, languageName: 'Italian (Italy)', currentCultureName: 'it-IT', currentUICultureName: 'it-IT', isRightToLeft: false },
  'ja-jp': { language: 1041, languageName: 'Japanese (Japan)', currentCultureName: 'ja-JP', currentUICultureName: 'ja-JP', isRightToLeft: false },
  'ko-kr': { language: 1042, languageName: 'Korean (Korea)', currentCultureName: 'ko-KR', currentUICultureName: 'ko-KR', isRightToLeft: false },
  'pt-br': { language: 1046, languageName: 'Portuguese (Brazil)', currentCultureName: 'pt-BR', currentUICultureName: 'pt-BR', isRightToLeft: false },
  'ru-ru': { language: 1049, languageName: 'Russian (Russia)', currentCultureName: 'ru-RU', currentUICultureName: 'ru-RU', isRightToLeft: false },
  'zh-cn': { language: 2052, languageName: 'Chinese (Simplified)', currentCultureName: 'zh-CN', currentUICultureName: 'zh-CN', isRightToLeft: false },
  'zh-tw': { language: 1028, languageName: 'Chinese (Traditional)', currentCultureName: 'zh-TW', currentUICultureName: 'zh-TW', isRightToLeft: false },
  'nl-nl': { language: 1043, languageName: 'Dutch (Netherlands)', currentCultureName: 'nl-NL', currentUICultureName: 'nl-NL', isRightToLeft: false },
  'sv-se': { language: 1053, languageName: 'Swedish (Sweden)', currentCultureName: 'sv-SE', currentUICultureName: 'sv-SE', isRightToLeft: false },
  'pl-pl': { language: 1045, languageName: 'Polish (Poland)', currentCultureName: 'pl-PL', currentUICultureName: 'pl-PL', isRightToLeft: false },
  'tr-tr': { language: 1055, languageName: 'Turkish (Turkey)', currentCultureName: 'tr-TR', currentUICultureName: 'tr-TR', isRightToLeft: false },
  'ar-sa': { language: 1025, languageName: 'Arabic (Saudi Arabia)', currentCultureName: 'ar-SA', currentUICultureName: 'ar-SA', isRightToLeft: true },
  'he-il': { language: 1037, languageName: 'Hebrew (Israel)', currentCultureName: 'he-IL', currentUICultureName: 'he-IL', isRightToLeft: true },
  'fa-ir': { language: 1065, languageName: 'Persian (Iran)', currentCultureName: 'fa-IR', currentUICultureName: 'fa-IR', isRightToLeft: true },
  'ur-pk': { language: 1056, languageName: 'Urdu (Pakistan)', currentCultureName: 'ur-PK', currentUICultureName: 'ur-PK', isRightToLeft: true },
  'hi-in': { language: 1081, languageName: 'Hindi (India)', currentCultureName: 'hi-IN', currentUICultureName: 'hi-IN', isRightToLeft: false }
};

export function normalizeLocaleTag(tag: string | undefined): string {
  if (!tag) {
    return DEFAULT_LOCALE;
  }
  const first = tag.split(',')[0]?.trim().toLowerCase();
  return first && first.length > 0 ? first : DEFAULT_LOCALE;
}

export function resolveLocale(query?: string): ResolvedLocale {
  const normalized = normalizeLocaleTag(query);
  const info = LOCALE_TABLE[normalized] ?? DEFAULT_LOCALE_INFO;
  return {
    locale: LOCALE_TABLE[normalized] ? normalized : DEFAULT_LOCALE,
    cultureInfo: {
      currentCultureName: info.currentCultureName,
      currentUICultureName: info.currentUICultureName,
      isRightToLeft: info.isRightToLeft
    },
    language: info.language,
    languageName: info.languageName
  };
}
