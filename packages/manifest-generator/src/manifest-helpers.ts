import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { RspfxError } from './errors.js';
import { SP_COMPONENT_IDS } from './data/component-ids.js';
import type { ManifestContext } from './types.js';

function getComponentIdsOverlaySync(): Map<string, { id: string; version: string; preloadComponents?: string[] }> {
  const overlay = new Map<string, { id: string; version: string; preloadComponents?: string[] }>();
  try {
    const req = createRequire(import.meta.url);
    const api = req('@mbsks/rspfx-plugin-api') as {
      getPlugins?: () => readonly { componentIds?: Record<string, { id: string; version: string; preloadComponents?: string[] }> }[];
      getActivePlugins?: () => readonly { componentIds?: Record<string, { id: string; version: string; preloadComponents?: string[] }> }[];
      getComponentIdsOverlay?: () => ReadonlyMap<string, { id: string; version: string; preloadComponents?: string[] }>;
    };
    if (api?.getComponentIdsOverlay) for (const [k, v] of api.getComponentIdsOverlay()) overlay.set(k, v);
    if (overlay.size > 0) return overlay;
    if (api?.getActivePlugins) for (const p of api.getActivePlugins()) if (p.componentIds) for (const [k, v] of Object.entries(p.componentIds)) if (!overlay.has(k)) overlay.set(k, v);
    if (api?.getPlugins) for (const p of api.getPlugins()) if (p.componentIds) for (const [k, v] of Object.entries(p.componentIds)) if (!overlay.has(k)) overlay.set(k, v);
  } catch {}
  return overlay;
}

function getMergedComponentIds(): Record<string, { id: string; version: string; preloadComponents?: string[] }> {
  const overlay = getComponentIdsOverlaySync();
  if (overlay.size === 0) return SP_COMPONENT_IDS;
  return { ...SP_COMPONENT_IDS, ...Object.fromEntries(overlay) };
}

function findNonSpExternalManifest(
  projectRoot: string,
  pkgName: string
): { id: string; version: string } | undefined {
  const distDir = path.join(projectRoot, 'node_modules', pkgName, 'dist');
  let files: string[];
  try {
    files = fs.readdirSync(distDir);
  } catch {
    return undefined;
  }
  const manifestFile = files.filter((file) => file.endsWith('.manifest.json') && !file.startsWith('.')).sort()[0];
  if (!manifestFile) return undefined;
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(distDir, manifestFile), 'utf8')) as { id?: unknown; version?: unknown };
    if (typeof manifest.id === 'string' && typeof manifest.version === 'string') return { id: manifest.id, version: manifest.version };
  } catch {}
  return undefined;
}

export function buildScriptResources(
  ctx: ManifestContext,
  spDependencies: Map<string, { id: string; version: string; manifestPath: string }>,
  entryModuleId: string
): Record<string, unknown> {
  const scriptResources: Record<string, unknown> = {
    [entryModuleId]: {
      type: 'path',
      path: ctx.bundleFiles.get(entryModuleId) ?? `${entryModuleId}.js`
    }
  };
  const localizedNames = new Set((ctx.localizedResources ?? []).map((resource) => resource.name));
  const externalNames = [...ctx.externals].filter((name) => name !== entryModuleId && !localizedNames.has(name)).sort();
  for (const externalName of externalNames) {
    const spDependency = spDependencies.get(externalName);
    if (spDependency) {
      scriptResources[externalName] = { type: 'component', id: spDependency.id, version: spDependency.version };
      continue;
    }
    const nonSpDependency = findNonSpExternalManifest(ctx.projectRoot, externalName);
    if (!nonSpDependency) {
      const mergedIds = getMergedComponentIds();
      const fallback = (mergedIds as Record<string, { id: string; version: string }>)[externalName];
      if (fallback) {
        scriptResources[externalName] = { type: 'component', id: fallback.id, version: fallback.version };
        continue;
      }
      throw new RspfxError(
        'UNRESOLVED_EXTERNAL',
        `External '${externalName}' could not be resolved to a component manifest (expected a .manifest.json under node_modules/${externalName}/dist)`
      );
    }
    scriptResources[externalName] = { type: 'component', id: nonSpDependency.id, version: nonSpDependency.version };
  }
  for (const resource of ctx.localizedResources ?? []) {
    const paths: Record<string, { path: string; integrity: string }> = {};
    const defaultLocale = resource.locales.find((locale) => locale.toLowerCase() === 'en-us') ?? resource.locales[0];
    if (defaultLocale !== undefined) paths['default'] = { path: `${resource.name}_${defaultLocale.toLowerCase()}.js`, integrity: '' };
    for (const locale of resource.locales) {
      const normalized = locale.toLowerCase();
      paths[normalized] = { path: `${resource.name}_${normalized}.js`, integrity: '' };
    }
    scriptResources[resource.name] = { type: 'localizedPath', paths };
  }
  return scriptResources;
}

export function stripPreReleaseVersion(version: string): string {
  const index = version.indexOf('-');
  return index >= 0 ? version.slice(0, index) : version;
}

export function toPascalSynthetic(name: string): string {
  return name.split(/[-_]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}
