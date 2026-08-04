import fs from 'node:fs';
import path from 'node:path';
import { RspfxError } from './errors.js';
import { SP_COMPONENT_IDS } from './data/component-ids.js';
import { findSpDependencies } from './sp-dependencies.js';
import type { ComponentManifest, ManifestContext } from './types.js';

function stripPreReleaseVersion(version: string): string {
  const index = version.indexOf('-');
  return index >= 0 ? version.slice(0, index) : version;
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

export async function generateComponentManifests(ctx: ManifestContext): Promise<ComponentManifest[]> {
  const spDependencies = findSpDependencies(ctx.projectRoot);
  const manifests: ComponentManifest[] = [];
  scanComponentsDir(ctx, manifests, spDependencies, ctx.webpartsDir ?? 'src/webparts');
  scanComponentsDir(ctx, manifests, spDependencies, ctx.extensionsDir ?? 'src/extensions');
  return manifests;
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
        const fallback = SP_COMPONENT_IDS[externalName];
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
      const defaultLocale = resource.locales.find((locale) => locale === 'en-us');
      if (defaultLocale !== undefined) {
        paths['default'] = { path: `${resource.name}_${defaultLocale}.js`, integrity: '' };
      }
      for (const locale of resource.locales) {
        paths[locale] = { path: `${resource.name}_${locale}.js`, integrity: '' };
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
