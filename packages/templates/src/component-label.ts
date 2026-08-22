import type { TemplateVars } from './types.js';

export function componentLabel(vars: TemplateVars): string {
  switch (vars.componentType) {
    case 'applicationcustomizer':
      return 'application customizer';
    case 'fieldcustomizer':
      return 'field customizer';
    case 'listviewcommandset':
      return 'list view command set';
    case 'formcustomizer':
      return 'form customizer';
    case 'library':
      return 'library';
    default:
      return 'web part';
  }
}
