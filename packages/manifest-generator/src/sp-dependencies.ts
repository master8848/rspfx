import fs from 'node:fs';
import path from 'node:path';
import { SP_COMPONENT_IDS } from './data/component-ids.js';

export interface SpDependency {
  id: string;
  version: string;
  manifestPath: string;
}

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return undefined;
  }
}

function findDistManifest(pkgDir: string): string | undefined {
  const distDir = path.join(pkgDir, 'dist');
  let files: string[];
  try {
    files = fs.readdirSync(distDir);
  } catch {
    return undefined;
  }
  const manifestFiles = files
    .filter((file) => file.endsWith('.manifest.json') && !file.startsWith('.'))
    .sort();
  if (manifestFiles.length === 0) {
    return undefined;
  }
  return path.join(distDir, manifestFiles[0]!);
}

export function findSpDependencies(projectRoot: string): Map<string, SpDependency> {
  const dependencies = new Map<string, SpDependency>();
  const microsoftDir = path.join(projectRoot, 'node_modules', '@microsoft');
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(microsoftDir, { withFileTypes: true });
  } catch {
    return dependencies;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }
    const pkgDir = path.join(microsoftDir, entry.name);
    const pkgJson = readJson(path.join(pkgDir, 'package.json')) as { name?: unknown } | undefined;
    const pkgName =
      pkgJson && typeof pkgJson.name === 'string' && pkgJson.name.startsWith('@microsoft/')
        ? pkgJson.name
        : `@microsoft/${entry.name}`;
    const manifestPath = findDistManifest(pkgDir);
    if (manifestPath) {
      const manifest = readJson(manifestPath) as { id?: unknown; version?: unknown } | undefined;
      if (typeof manifest?.id === 'string' && typeof manifest.version === 'string') {
        dependencies.set(pkgName, { id: manifest.id, version: manifest.version, manifestPath });
      }
    } else {
      const fallback = SP_COMPONENT_IDS[pkgName];
      if (fallback) {
        dependencies.set(pkgName, { id: fallback.id, version: fallback.version, manifestPath: '' });
      }
    }
  }
  return dependencies;
}
