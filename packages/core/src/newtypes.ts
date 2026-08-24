export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export type ComponentId = string & { readonly __brand: 'ComponentId' };

export function parseComponentId(s: string): Result<ComponentId, Error> {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    ? { ok: true, value: s as ComponentId }
    : { ok: false, error: new Error(`invalid ComponentId ${s}`) };
}

export function unsafeComponentId(s: string): ComponentId {
  return s as ComponentId;
}

export type ZipPath = string & { readonly __brand: 'ZipPath' };

export function parseZipPath(s: string): Result<ZipPath, Error> {
  if (s.includes('..') || s.startsWith('/') || s.includes('\\')) {
    return {
      ok: false,
      error: new Error(`traversal in ${s}`)
    };
  }
  return { ok: true, value: s as ZipPath };
}

export function unsafeZipPath(s: string): ZipPath {
  return s as ZipPath;
}

export type Lcid = number & { readonly __brand: 'Lcid' };

export type CultureName = string & { readonly __brand: 'CultureName' };

export type PlatformPrefix =
  | '@msinternal'
  | '@azure/msal-browser-1p'
  | '@azure/msal-browser-legacy-1p'
  | (string & { __platform?: never });

export const LCID_TO_CULTURE: ReadonlyMap<Lcid, CultureName> = new Map<Lcid, CultureName>([
  [1033 as Lcid, 'en-US' as CultureName],
  [1036 as Lcid, 'fr-FR' as CultureName],
  [1031 as Lcid, 'de-DE' as CultureName],
  [1041 as Lcid, 'ja-JP' as CultureName],
  [1042 as Lcid, 'ko-KR' as CultureName],
  [2052 as Lcid, 'zh-CN' as CultureName],
  [1028 as Lcid, 'zh-TW' as CultureName],
  [3082 as Lcid, 'es-ES' as CultureName],
  [1040 as Lcid, 'it-IT' as CultureName],
  [1043 as Lcid, 'nl-NL' as CultureName],
  [1044 as Lcid, 'nb-NO' as CultureName],
  [1045 as Lcid, 'pl-PL' as CultureName],
  [1046 as Lcid, 'pt-BR' as CultureName],
  [1049 as Lcid, 'ru-RU' as CultureName],
  [1053 as Lcid, 'sv-SE' as CultureName],
  [2057 as Lcid, 'en-GB' as CultureName]
]);

export function localeToCultureName(lcid: Lcid): CultureName {
  return LCID_TO_CULTURE.get(lcid) ?? ('en-US' as CultureName);
}

export enum Locale {
  EN_US = 1033,
  FR_FR = 1036,
  DE_DE = 1031,
  JA_JP = 1041,
  KO_KR = 1042,
  ZH_CN = 2052,
  ZH_TW = 1028,
  ES_ES = 3082,
  IT_IT = 1040,
  NL_NL = 1043,
  NB_NO = 1044,
  PL_PL = 1045,
  PT_BR = 1046,
  RU_RU = 1049,
  SV_SE = 1053,
  EN_GB = 2057
}
