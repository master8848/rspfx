import fs from 'node:fs';
import path from 'node:path';
import { RspfxError } from './errors.js';
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
  const webpartsDir = path.join(ctx.projectRoot, 'src', 'webparts');
  let webpartDirs: fs.Dirent[];
  try {
    webpartDirs = fs.readdirSync(webpartsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const spDependencies = findSpDependencies(ctx.projectRoot);
  const manifests: ComponentManifest[] = [];
  for (const dirEntry of webpartDirs) {
    if (!dirEntry.isDirectory() || dirEntry.name.startsWith('.')) {
      continue;
    }
    const dirPath = path.join(webpartsDir, dirEntry.name);
    const manifestFiles = fs
      .readdirSync(dirPath)
      .filter((file) => file.endsWith('.manifest.json') && !file.startsWith('.'));
    if (manifestFiles.length === 0) {
      continue;
    }
    if (manifestFiles.length > 1) {
      throw new RspfxError(
        'MULTIPLE_MANIFESTS',
        `Expected exactly one manifest per web part folder but found ${manifestFiles.length} in ${dirPath}: ${manifestFiles.join(', ')}`
      );
    }
    const source = JSON.parse(
      fs.readFileSync(path.join(dirPath, manifestFiles[0]!), 'utf8')
    ) as Record<string, unknown>;
    delete source.$schema;
    if (source.version === '*') {
      source.version = stripPreReleaseVersion(ctx.packageVersion);
    }
    const entryModuleId = dirEntry.name;
    const scriptResources: Record<string, unknown> = {
      [entryModuleId]: {
        type: 'path',
        path: ctx.bundleFiles.get(entryModuleId) ?? `${entryModuleId}.js`
      }
    };
    const externalNames = [...ctx.externals]
      .filter((name) => name !== entryModuleId)
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
    source.loaderConfig = {
      internalModuleBaseUrls: ctx.production ? ctx.baseUrls.release : [ctx.baseUrls.debug],
      entryModuleId,
      scriptResources
    };
    manifests.push(source as ComponentManifest);
  }
  return manifests;
}
