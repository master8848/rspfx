import { findSpDependencies } from '@mbsks/rspfx-manifest-generator';
import { isPlatformOnlyModule } from '@mbsks/rspfx-core';

export function collectExternals(
  root: string,
  projectExternals: string[],
  localizedResources: { name: string }[]
): string[] {
  return [
    ...new Set([
      ...findSpDependencies(root).keys(),
      ...projectExternals,
      ...localizedResources.map((resource) => resource.name)
    ])
  ];
}

export function platformOnlyExternal(data: { request?: string }): string | undefined {
  return typeof data.request === 'string' && isPlatformOnlyModule(data.request) ? `amd ${data.request}` : undefined;
}
