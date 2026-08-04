import { describe, expect, it } from 'vitest';
import { createMockPageContextData } from '../src/context.js';

describe('createMockPageContextData locale override', () => {
  it('keeps the en-us defaults when no locale is given', () => {
    const data = createMockPageContextData();
    expect(data.cultureInfo).toEqual({
      currentCultureName: 'en-US',
      currentUICultureName: 'en-US',
      isRightToLeft: false
    });
    expect(data.web.language).toBe(1033);
    expect(data.web.languageName).toBe('English (United States)');
  });

  it('derives cultureInfo and web language from the locale', () => {
    const data = createMockPageContextData({ locale: 'fr-fr' });
    expect(data.cultureInfo.currentCultureName).toBe('fr-FR');
    expect(data.cultureInfo.currentUICultureName).toBe('fr-FR');
    expect(data.cultureInfo.isRightToLeft).toBe(false);
    expect(data.web.language).toBe(1036);
    expect(data.web.languageName).toBe('French (France)');
  });

  it('marks RTL locales in the web context', () => {
    const data = createMockPageContextData({ locale: 'ar-sa' });
    expect(data.cultureInfo.isRightToLeft).toBe(true);
    expect(data.web.language).toBe(1025);
    expect(data.web.languageName).toBe('Arabic (Saudi Arabia)');
  });

  it('falls back to en-us for unknown locales', () => {
    const data = createMockPageContextData({ locale: 'zz-zz' });
    expect(data.cultureInfo.currentCultureName).toBe('en-US');
    expect(data.web.language).toBe(1033);
  });

  it('explicit overrides still win over the locale derivation', () => {
    const data = createMockPageContextData({ locale: 'fr-fr', web: { language: 1043 } });
    expect(data.web.language).toBe(1043);
    expect(data.cultureInfo.currentCultureName).toBe('fr-FR');
  });
});
