import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, normalizeLocaleTag, resolveLocale } from '../src/locales.js';

describe('resolveLocale', () => {
  it('defaults to en-us (1033, not RTL)', () => {
    const resolved = resolveLocale(undefined);
    expect(resolved.locale).toBe(DEFAULT_LOCALE);
    expect(resolved.language).toBe(1033);
    expect(resolved.languageName).toBe('English (United States)');
    expect(resolved.cultureInfo).toEqual({
      currentCultureName: 'en-US',
      currentUICultureName: 'en-US',
      isRightToLeft: false
    });
  });

  it('maps fr-fr to French (France) / 1036', () => {
    const resolved = resolveLocale('fr-fr');
    expect(resolved.locale).toBe('fr-fr');
    expect(resolved.language).toBe(1036);
    expect(resolved.languageName).toBe('French (France)');
    expect(resolved.cultureInfo.currentCultureName).toBe('fr-FR');
    expect(resolved.cultureInfo.isRightToLeft).toBe(false);
  });

  it('normalizes case and region casing', () => {
    const resolved = resolveLocale('FR-FR');
    expect(resolved.locale).toBe('fr-fr');
    expect(resolved.language).toBe(1036);
  });

  it('marks RTL locales as right-to-left', () => {
    for (const tag of ['ar-sa', 'he-il', 'fa-ir', 'ur-pk']) {
      expect(resolveLocale(tag).cultureInfo.isRightToLeft, tag).toBe(true);
    }
    expect(resolveLocale('ar-sa').language).toBe(1025);
    expect(resolveLocale('he-il').language).toBe(1037);
  });

  it('falls back to en-us for unknown locales', () => {
    const resolved = resolveLocale('xx-xx');
    expect(resolved.locale).toBe(DEFAULT_LOCALE);
    expect(resolved.language).toBe(1033);
  });

  it('takes the first tag of a comma-separated list', () => {
    expect(resolveLocale('fr-fr,en-us').locale).toBe('fr-fr');
    expect(resolveLocale('en-us,fr-fr').locale).toBe('en-us');
  });

  it('covers the built-in table with plausible LCIDs', () => {
    const expected: Record<string, number> = {
      'de-de': 1031,
      'es-es': 3082,
      'it-it': 1040,
      'ja-jp': 1041,
      'ko-kr': 1042,
      'pt-br': 1046,
      'ru-ru': 1049,
      'zh-cn': 2052,
      'zh-tw': 1028,
      'nl-nl': 1043,
      'sv-se': 1053,
      'pl-pl': 1045,
      'tr-tr': 1055,
      'fa-ir': 1065,
      'hi-in': 1081
    };
    for (const [tag, lcid] of Object.entries(expected)) {
      expect(resolveLocale(tag).language, tag).toBe(lcid);
    }
  });
});

describe('normalizeLocaleTag', () => {
  it('handles empty and whitespace-only input', () => {
    expect(normalizeLocaleTag('')).toBe(DEFAULT_LOCALE);
    expect(normalizeLocaleTag('   ')).toBe(DEFAULT_LOCALE);
    expect(normalizeLocaleTag(undefined)).toBe(DEFAULT_LOCALE);
  });
});
