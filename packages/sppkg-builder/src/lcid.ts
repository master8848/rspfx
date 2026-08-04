const LOCALE_TO_LCID: Record<string, number> = {
  'ar-sa': 1025,
  'cs-cz': 1029,
  'da-dk': 1030,
  'de-de': 1031,
  'el-gr': 1032,
  'en-us': 1033,
  'es-es': 3082,
  'fi-fi': 1035,
  'fr-fr': 1036,
  'he-il': 1037,
  'hu-hu': 1038,
  'it-it': 1040,
  'ja-jp': 1041,
  'ko-kr': 1042,
  'nl-nl': 1043,
  'nb-no': 1044,
  'pl-pl': 1045,
  'pt-br': 1046,
  'ro-ro': 1048,
  'ru-ru': 1049,
  'sv-se': 1053,
  'th-th': 1054,
  'tr-tr': 1055,
  'uk-ua': 1058,
  'vi-vn': 1066,
  'zh-cn': 2052,
  'zh-tw': 1028
};

export function localeToLcid(locale: string): number {
  return LOCALE_TO_LCID[locale.toLowerCase()] ?? 1033;
}
