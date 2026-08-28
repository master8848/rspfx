import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { RspfxError } from './errors.js';
import { SP_COMPONENT_IDS } from './data/component-ids.js';
import { findSpDependencies } from './sp-dependencies.js';
import type { ComponentManifest, ManifestContext } from './types.js';

let native:
  | { scanComponentsDir?: (opts: unknown) => Promise<ComponentManifest[]>; generateComponentManifests?: (ctx: ManifestContext) => Promise<ComponentManifest[]> }
  | undefined;
try {
  const req = createRequire(import.meta.url);
  native = req('../../crates/rspfx-manifest/index.node');
} catch {}

function stripPreReleaseVersion(version: string): string {
  const index = version.indexOf('-');
  return index >= 0 ? version.slice(0, index) : version;
}

function getComponentIdsOverlay(): Map<string, { id: string; version: string; preloadComponents?: string[] }> {
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
  const overlay = getComponentIdsOverlay();
  if (overlay.size === 0) return SP_COMPONENT_IDS;
  return { ...SP_COMPONENT_IDS, ...Object.fromEntries(overlay) };
}

function collectGeneratePatches(): Array<(ctx: ManifestContext, next: (ctx: ManifestContext) => Promise<ComponentManifest[]>) => Promise<ComponentManifest[]>> {
  const patches: Array<(ctx: ManifestContext, next: (ctx: ManifestContext) => Promise<ComponentManifest[]>) => Promise<ComponentManifest[]>> = [];
  try {
    const req = createRequire(import.meta.url);
    const api = req('@mbsks/rspfx-plugin-api') as { getPlugins?: () => readonly unknown[]; getActivePlugins?: () => readonly unknown[] };
    const seen = new Set<unknown>();
    const collect = (plugins: readonly unknown[]) => {
      for (const p of plugins as readonly { patches?: { generateComponentManifests?: unknown } }[]) {
        const fn = p.patches?.generateComponentManifests;
        if (typeof fn === 'function' && !seen.has(fn)) { seen.add(fn); patches.push(fn as typeof patches[number]); }
      }
    };
    if (api?.getActivePlugins) { try { collect(api.getActivePlugins()); } catch {} }
    if (api?.getPlugins) { try { collect(api.getPlugins()); } catch {} }
  } catch {}
  return patches;
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
  const manifestFile = files
    .filter((file) => file.endsWith('.manifest.json') && !file.startsWith('.'))
    .sort()[0];
  if (!manifestFile) {
    return undefined;
  }
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(distDir, manifestFile), 'utf8')
    ) as { id?: unknown; version?: unknown };
    if (typeof manifest.id === 'string' && typeof manifest.version === 'string') {
      return { id: manifest.id, version: manifest.version };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function generateComponentManifestsBase(ctx: ManifestContext): Promise<ComponentManifest[]> {
  if (native?.generateComponentManifests) {
    try { return await native.generateComponentManifests(ctx); } catch {}
  }
  if (native?.scanComponentsDir) {
    try {
      const res = await native.scanComponentsDir({
        projectRoot: ctx.projectRoot,
        webpartsDir: ctx.webpartsDir ?? 'src/webparts',
        extensionsDir: ctx.extensionsDir ?? 'src/extensions',
        librariesDir: ctx.librariesDir ?? 'src/libraries',
        packageVersion: ctx.packageVersion,
        production: ctx.production,
      } as unknown);
      if (Array.isArray(res)) return res as ComponentManifest[];
    } catch {}
  }
  const spDependencies = findSpDependencies(ctx.projectRoot);
  const manifests: ComponentManifest[] = [];
  const webpartsDir = ctx.webpartsDir?.trim() ? ctx.webpartsDir : 'src/webparts';
  const extensionsDir = ctx.extensionsDir?.trim() ? ctx.extensionsDir : 'src/extensions';
  const librariesDir = ctx.librariesDir?.trim() ? ctx.librariesDir : 'src/libraries';
  scanComponentsDir(ctx, manifests, spDependencies, webpartsDir);
  scanComponentsDir(ctx, manifests, spDependencies, extensionsDir);
  scanComponentsDir(ctx, manifests, spDependencies, librariesDir);
  return manifests;
}

export async function generateComponentManifests(ctx: ManifestContext): Promise<ComponentManifest[]> {
  const patches = collectGeneratePatches();
  if (patches.length === 0) return generateComponentManifestsBase(ctx);
  let idx = 0;
  const next = (a: ManifestContext): Promise<ComponentManifest[]> => {
    if (idx < patches.length) {
      const fn = patches[idx++]!;
      return fn(a, next);
    }
    return generateComponentManifestsBase(a);
  };
  try { return await next(ctx); } catch { return generateComponentManifestsBase(ctx); }
}

function scanComponentsDir(
  ctx: ManifestContext,
  manifests: ComponentManifest[],
  spDependencies: Map<string, { id: string; version: string; manifestPath: string }>,
  componentsDir: string
): void {
  const resolvedDir = path.join(ctx.projectRoot, componentsDir);
  let componentDirs: fs.Dirent[];
  try {
    componentDirs = fs.readdirSync(resolvedDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const dirEntry of componentDirs) {
    if (!dirEntry.isDirectory() || dirEntry.name.startsWith('.')) {
      continue;
    }
    const dirPath = path.join(resolvedDir, dirEntry.name);
    const manifestFiles = fs
      .readdirSync(dirPath)
      .filter((file) => file.endsWith('.manifest.json') && !file.startsWith('.'));
    if (manifestFiles.length === 0) {
      continue;
    }
    if (manifestFiles.length > 1) {
      throw new RspfxError(
        'MULTIPLE_MANIFESTS',
        `Expected exactly one manifest per web part/extension folder but found ${manifestFiles.length} in ${dirPath}: ${manifestFiles.join(', ')}`
      );
    }
    const source = JSON.parse(
      fs.readFileSync(path.join(dirPath, manifestFiles[0]!), 'utf8')
    ) as Record<string, unknown>;
    delete source.$schema;
    if (source.version === '*') {
      source.version = stripPreReleaseVersion(ctx.packageVersion);
    }
    const manifestId = typeof source.id === 'string' ? source.id : undefined;
    const entryModuleId =
      (manifestId !== undefined ? ctx.entryModuleIds?.[manifestId] : undefined) ?? dirEntry.name;
    const scriptResources: Record<string, unknown> = {
      [entryModuleId]: {
        type: 'path',
        path: ctx.bundleFiles.get(entryModuleId) ?? `${entryModuleId}.js`
      }
    };
    const localizedNames = new Set((ctx.localizedResources ?? []).map((resource) => resource.name));
    const externalNames = [...ctx.externals]
      .filter((name) => name !== entryModuleId && !localizedNames.has(name))
      .sort();
    for (const externalName of externalNames) {
      const spDependency = spDependencies.get(externalName);
      if (spDependency) {
        scriptResources[externalName] = {
          type: 'component',
          id: spDependency.id,
          version: spDependency.version
        };
        continue;
      }
      const nonSpDependency = findNonSpExternalManifest(ctx.projectRoot, externalName);
      if (!nonSpDependency) {
        const mergedIds = getMergedComponentIds();
        const fallback = (mergedIds as Record<string, { id: string; version: string }>)[externalName];
        if (fallback) {
          scriptResources[externalName] = {
            type: 'component',
            id: fallback.id,
            version: fallback.version
          };
          continue;
        }
        throw new RspfxError(
          'UNRESOLVED_EXTERNAL',
          `External '${externalName}' could not be resolved to a component manifest (expected a .manifest.json under node_modules/${externalName}/dist)`
        );
      }
      scriptResources[externalName] = {
        type: 'component',
        id: nonSpDependency.id,
        version: nonSpDependency.version
      };
    }
    for (const resource of ctx.localizedResources ?? []) {
      const paths: Record<string, { path: string; integrity: string }> = {};
      const defaultLocale =
        resource.locales.find((locale) => locale.toLowerCase() === 'en-us') ?? resource.locales[0];
      if (defaultLocale !== undefined) {
        paths['default'] = { path: `${resource.name}_${defaultLocale.toLowerCase()}.js`, integrity: '' };
      }
      for (const locale of resource.locales) {
        const normalized = locale.toLowerCase();
        paths[normalized] = { path: `${resource.name}_${normalized}.js`, integrity: '' };
      }
      scriptResources[resource.name] = { type: 'localizedPath', paths };
    }
    source.loaderConfig = {
      internalModuleBaseUrls: ctx.production ? ctx.baseUrls.release : [ctx.baseUrls.debug],
      entryModuleId,
      scriptResources
    };
    manifests.push(source as ComponentManifest);
  }
}
