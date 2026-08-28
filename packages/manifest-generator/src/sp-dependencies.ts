import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { SP_COMPONENT_IDS } from './data/component-ids.js';

let native: { findSpDependencies?: (root: string) => Map<string, SpDependency> } | undefined;
try {
  const req = createRequire(import.meta.url);
  native = req('../../crates/rspfx-manifest/index.node');
} catch {}

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

function getComponentIdsOverlay(): Map<string, { id: string; version: string; preloadComponents?: string[] }> {
  const overlay = new Map<string, { id: string; version: string; preloadComponents?: string[] }>();
  try {
    const req = createRequire(import.meta.url);
    const api = req('@mbsks/rspfx-plugin-api') as {
      getPlugins?: () => readonly { componentIds?: Record<string, { id: string; version: string; preloadComponents?: string[] }> }[];
      getActivePlugins?: () => readonly { componentIds?: Record<string, { id: string; version: string; preloadComponents?: string[] }> }[];
      getComponentIdsOverlay?: () => ReadonlyMap<string, { id: string; version: string; preloadComponents?: string[] }>;
    };
    if (api?.getComponentIdsOverlay) {
      for (const [k, v] of api.getComponentIdsOverlay()) overlay.set(k, v);
      if (overlay.size > 0) return overlay;
    }
    const active = api?.getActivePlugins ? api.getActivePlugins() : [];
    for (const p of active as readonly { componentIds?: Record<string, { id: string; version: string }> }[]) {
      if (!p.componentIds) continue;
      for (const [k, v] of Object.entries(p.componentIds)) if (!overlay.has(k)) overlay.set(k, v as { id: string; version: string });
    }
    if (api?.getPlugins) {
      for (const p of api.getPlugins()) {
        if (!p.componentIds) continue;
        for (const [k, v] of Object.entries(p.componentIds)) if (!overlay.has(k)) overlay.set(k, v);
      }
    }
  } catch {}
  return overlay;
}

function getMergedComponentIds(): Record<string, { id: string; version: string; preloadComponents?: string[] }> {
  const overlay = getComponentIdsOverlay();
  if (overlay.size === 0) return SP_COMPONENT_IDS;
  return { ...SP_COMPONENT_IDS, ...Object.fromEntries(overlay) };
}

function findSpDependenciesBase(projectRoot: string): Map<string, SpDependency> {
  if (native?.findSpDependencies) {
    try { return native.findSpDependencies(projectRoot); } catch {}
  }
  const mergedIds = getMergedComponentIds();
  const dependencies = new Map<string, SpDependency>();
  const microsoftDir = path.join(projectRoot, 'node_modules', '@microsoft');
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(microsoftDir, { withFileTypes: true });
  } catch {
    return dependencies;
  }
  for (const entry of entries) {
    if ((!entry.isDirectory() && !entry.isSymbolicLink()) || entry.name.startsWith('.')) {
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
      const fallback = (mergedIds as Record<string, { id: string; version: string }>)[pkgName];
      if (fallback) {
        dependencies.set(pkgName, { id: fallback.id, version: fallback.version, manifestPath: '' });
      }
    }
  }
  return dependencies;
}

function getFindSpDependencyPatches(): Array<(projectRoot: string, original: (root: string) => Map<string, SpDependency>) => Map<string, SpDependency> | Promise<Map<string, SpDependency>>> {
  const patches: Array<(projectRoot: string, original: (root: string) => Map<string, SpDependency>) => Map<string, SpDependency> | Promise<Map<string, SpDependency>>> = [];
  try {
    const req = createRequire(import.meta.url);
    const api = req('@mbsks/rspfx-plugin-api') as { getPlugins?: () => readonly unknown[]; getActivePlugins?: () => readonly unknown[] };
    const collect = (plugins: readonly unknown[]) => {
      for (const p of plugins as readonly { patches?: { findSpDependencies?: unknown } }[]) {
        const fn = p.patches?.findSpDependencies as unknown;
        if (typeof fn === 'function') (patches as unknown as Array<unknown>).push(fn as (a: unknown, b: unknown) => unknown);
      }
    };
    if (api?.getActivePlugins) { try { collect(api.getActivePlugins()); } catch {} }
    if (api?.getPlugins) { try { collect(api.getPlugins()); } catch {} }
  } catch {}
  return patches;
}

export function findSpDependencies(projectRoot: string): Map<string, SpDependency> {
  const baseResult = findSpDependenciesBase(projectRoot);
  // Quick check for patches
  let patches: Array<(projectRoot: string, original: (root: string) => Map<string, SpDependency>) => Map<string, SpDependency> | Promise<Map<string, SpDependency>>> = [];
  try { patches = getFindSpDependencyPatches(); } catch { patches = []; }
  if (patches.length === 0) {
    // No patch, but still need to merge overlay if base already includes mergedIds, it's already handled.
    // However if native returned result (which doesn't know overlay), we still need to overlay missing entries.
    const overlay = getComponentIdsOverlay();
    if (overlay.size > 0 && baseResult.size === 0) {
      // Native may have failed, but overlay could provide entries for missing packages that weren't on disk.
      // We already handled fallback via mergedIds in base, but for completeness merge overlay-only entries
      for (const [k, v] of overlay) if (!baseResult.has(k)) baseResult.set(k, { id: v.id, version: v.version, manifestPath: '' });
    }
    // Also merge overlay for any missing fallback ids that base didn't include because native bypass overlay
    // If native succeeded, it may have used native logic without overlay; we should ensure overlay entries are present for completeness
    if (overlay.size > 0) {
      for (const [k, v] of overlay) if (!baseResult.has(k)) {
        // Only add if package folder exists or overlay wants to force? We add fallback-style entry
        // Check if package exists on disk? If not, still add as fallback for externals resolution
        // We'll add only if SP_COMPONENT_IDS didn't have it or overlay overrides
        baseResult.set(k, { id: v.id, version: v.version, manifestPath: '' });
      }
    }
    return baseResult;
  }

  // Build middleware chain: patches are in order of discovery; we need to call first patch with (projectRoot, original)
  // Support both signatures: (projectRoot, original) and ({projectRoot}, next)
  const originalFn = (root: string): Map<string, SpDependency> => root === projectRoot ? baseResult : findSpDependenciesBase(root);

  let index = 0;
  const next = (rootOrArgs: string | { projectRoot: string }): Map<string, SpDependency> => {
    if (index >= patches.length) {
      const r = typeof rootOrArgs === 'string' ? rootOrArgs : rootOrArgs.projectRoot;
      return originalFn(r);
    }
    const fn = patches[index++]!;
    // Try (projectRoot, original) signature first
    try {
      const maybeArgs = typeof rootOrArgs === 'string' ? rootOrArgs : rootOrArgs.projectRoot;
      // Try to call with (string, fn) shape
      const res = (fn as unknown as (a: string, b: (r: string) => Map<string, SpDependency>) => unknown)(maybeArgs, (r: string) => next(r));
      if (res instanceof Map) return res as Map<string, SpDependency>;
      if (res instanceof Promise) {
        // Sync path can't await; fallback to base
        return originalFn(maybeArgs);
      }
      if (res !== undefined && res !== null) return res as Map<string, SpDependency>;
    } catch {}
    // Try object signature
    try {
      const args = typeof rootOrArgs === 'string' ? { projectRoot: rootOrArgs } : rootOrArgs;
      const res2 = (fn as unknown as (a: { projectRoot: string }, b: (args: { projectRoot: string }) => Map<string, SpDependency>) => unknown)(args as { projectRoot: string }, (a: { projectRoot: string }) => next(a));
      if (res2 instanceof Map) return res2 as Map<string, SpDependency>;
      if (res2 instanceof Promise) return originalFn((args as { projectRoot: string }).projectRoot);
      if (res2 !== undefined && res2 !== null) return res2 as Map<string, SpDependency>;
    } catch {}
    return originalFn(typeof rootOrArgs === 'string' ? rootOrArgs : rootOrArgs.projectRoot);
  };

  try {
    const result = next(projectRoot);
    if (result instanceof Promise) return baseResult;
    // Merge overlay into result if patch didn't already include overlay but overlay has extra entries
    const overlay = getComponentIdsOverlay();
    if (overlay.size > 0) {
      for (const [k, v] of overlay) if (!result.has(k)) result.set(k, { id: v.id, version: v.version, manifestPath: '' });
    }
    return result;
  } catch {
    return baseResult;
  }
}
