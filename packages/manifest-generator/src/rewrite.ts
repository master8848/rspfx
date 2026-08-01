import fs from 'node:fs';
import { findSpDependencies } from './sp-dependencies.js';
import type { ComponentManifest } from './types.js';

export function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

export function joinUrlSegments(baseUrl: string, relativePath: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}/${relativePath.replace(/^\/+/, '')}`;
}

export function rewriteSpManifestForDebug(
  spManifest: unknown,
  relativePath: string,
  baseUrl: string
): unknown {
  const manifest = spManifest as {
    loaderConfig?: { internalModuleBaseUrls?: string[] };
  };
  if (!manifest.loaderConfig) {
    return spManifest;
  }
  const encodedPath = encodeURI(relativePath.replace(/\\/g, '/'));
  const url = joinUrlSegments(baseUrl, encodedPath);
  const internalModuleBaseUrls = manifest.loaderConfig.internalModuleBaseUrls;
  if (!internalModuleBaseUrls || internalModuleBaseUrls.length === 0) {
    manifest.loaderConfig.internalModuleBaseUrls = [url];
  } else {
    const firstUrl = internalModuleBaseUrls[0];
    if (firstUrl === undefined || !firstUrl.startsWith(url)) {
      internalModuleBaseUrls.unshift(url);
    }
  }
  manifest.loaderConfig.internalModuleBaseUrls =
    (manifest.loaderConfig.internalModuleBaseUrls ?? [url]).map(ensureTrailingSlash);
  return spManifest;
}

export interface CollectDebugManifestsOptions {
  projectRoot: string;
  componentManifests: ComponentManifest[];
  serverOrigin: string;
}

export async function collectDebugManifests(
  opts: CollectDebugManifestsOptions
): Promise<unknown[]> {
  const result: unknown[] = [...opts.componentManifests];
  const spDependencies = findSpDependencies(opts.projectRoot);
  const entries = [...spDependencies.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [pkgName, dependency] of entries) {
    if (!dependency.manifestPath) {
      continue;
    }
    const raw = await fs.promises.readFile(dependency.manifestPath, 'utf8');
    const manifest = JSON.parse(raw) as unknown;
    const relativePath = `node_modules/${pkgName}/dist`;
    result.push(rewriteSpManifestForDebug(manifest, relativePath, opts.serverOrigin));
  }
  return result;
}
