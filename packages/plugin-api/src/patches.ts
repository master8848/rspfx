import type { RspfxExtension } from './types.js';

export function getPatchedSpfxVersions(base: readonly { target: string; npmVersion: string; toolchain: 'gulp' | 'heft'; status: 'ga' | 'preview' }[], plugins: readonly RspfxExtension[]): readonly { target: string; npmVersion: string; toolchain: 'gulp' | 'heft'; status: 'ga' | 'preview' }[] {
  const extra = plugins.flatMap((p) => p.spfxVersions ?? []);
  if (extra.length === 0) return base;
  const map = new Map<string, { target: string; npmVersion: string; toolchain: 'gulp' | 'heft'; status: 'ga' | 'preview' }>();
  for (const v of base) map.set(v.target, v);
  for (const v of extra) map.set(v.target, v as typeof base[number]);
  return [...map.values()];
}

export function getPatchedComponentIds(base: Record<string, { id: string; version: string }>, plugins: readonly RspfxExtension[]): Record<string, { id: string; version: string }> {
  let out = base;
  let mutated = false;
  for (const p of plugins) {
    if (!p.componentIds) continue;
    if (!mutated) { out = { ...base }; mutated = true; }
    Object.assign(out, p.componentIds);
  }
  return out;
}

export async function applyFindSpDependencies(projectRoot: string, base: (args: { projectRoot: string }) => Map<string, { id: string; version: string; manifestPath: string }>, plugins: readonly RspfxExtension[]): Promise<Map<string, { id: string; version: string; manifestPath: string }>> {
  const patches = plugins.map((p) => p.patches?.findSpDependencies).filter((f): f is NonNullable<typeof f> => !!f);
  if (patches.length === 0) return base({ projectRoot });
  let index = 0;
  const next: (args: { projectRoot: string }) => Map<string, { id: string; version: string; manifestPath: string }> | Promise<Map<string, { id: string; version: string; manifestPath: string }>> = (args: { projectRoot: string }) => {
    if (index < patches.length) {
      const fn: any = patches[index++]!;
      return fn(args, next);
    }
    return base(args);
  };
  const res: any = next({ projectRoot });
  return res instanceof Promise ? await res : res;
}

export async function applyGenerateComponentManifests(args: unknown, base: (args: unknown) => Promise<import('./types.js').ComponentManifest[]>, plugins: readonly RspfxExtension[]): Promise<import('./types.js').ComponentManifest[]> {
  const patches = plugins.map((p) => p.patches?.generateComponentManifests).filter((f): f is NonNullable<typeof f> => !!f);
  if (patches.length === 0) return base(args);
  let index = 0;
  const next = (a: unknown): Promise<import('./types.js').ComponentManifest[]> => {
    if (index < patches.length) {
      const fn = patches[index++]!;
      return (fn as (args: unknown, next: (args: unknown) => Promise<import('./types.js').ComponentManifest[]>) => Promise<import('./types.js').ComponentManifest[]>)(a, next);
    }
    return base(a);
  };
  return next(args);
}

export type BuildAppManifestXmlArgs = { name: string; productId: string; version?: string; skipFeatureDeployment: boolean; isDomainIsolated?: boolean; spfxVersion?: string; developer?: Record<string, unknown>; metadata?: Record<string, unknown>; localizedStrings?: { locale: string; values: Record<string, string> }[]; webApiPermissionRequests?: { resource: string; scope: string }[]; pretty: boolean };

export async function applyBuildAppManifestXml(args: BuildAppManifestXmlArgs, base: (args: BuildAppManifestXmlArgs) => string, plugins: readonly RspfxExtension[]): Promise<string> {
  const patches = plugins.map((p) => p.patches?.buildAppManifestXml).filter((f): f is NonNullable<typeof f> => !!f);
  if (patches.length === 0) return base(args);
  let index = 0;
  const next: (a: BuildAppManifestXmlArgs) => string | Promise<string> = (a: BuildAppManifestXmlArgs) => {
    if (index < patches.length) {
      const fn: any = patches[index++]!;
      return fn(a, next);
    }
    return base(a);
  };
  const res: any = next(args);
  return res instanceof Promise ? await res : res;
}
