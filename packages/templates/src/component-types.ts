export const EXTENSION_TYPES = ['applicationcustomizer', 'fieldcustomizer', 'listviewcommandset', 'formcustomizer'] as const;
export type ExtensionType = (typeof EXTENSION_TYPES)[number];
export type ComponentType = 'webpart' | ExtensionType | 'library';
