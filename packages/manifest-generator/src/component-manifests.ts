import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { RspfxError } from './errors.js';
import { findSpDependencies } from './sp-dependencies.js';
import type { ComponentManifest, ManifestContext } from './types.js';
import { buildScriptResources, stripPreReleaseVersion, toPascalSynthetic } from './manifest-helpers.js';

let native:
  | { scanComponentsDir?: (opts: unknown) => Promise<ComponentManifest[]>; generateComponentManifests?: (ctx: ManifestContext) => Promise<ComponentManifest[]> }
  | undefined;
try {
  const req = createRequire(import.meta.url);
  native = req('../../crates/rspfx-manifest/index.node');
} catch {}

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

function generateSyntheticManifests(
  ctx: ManifestContext,
  spDependencies: Map<string, { id: string; version: string; manifestPath: string }>
): ComponentManifest[] {
  const manifests: ComponentManifest[] = [];
  if (!ctx.syntheticManifests || ctx.syntheticManifests.length === 0) return manifests;
  for (const meta of ctx.syntheticManifests) {
    const pascal = toPascalSynthetic(meta.bundleName);
    const title = meta.title ?? pascal;
    const description = meta.description ?? `${meta.bundleName} web part`;
    const iconName = meta.iconName ?? 'Page';
    const source: Record<string, unknown> = {
      $schema: 'https://developer.microsoft.com/json-schemas/spfx/client-side-web-part-manifest.schema.json',
      id: meta.id,
      alias: `${pascal}WebPart`,
      componentType: 'WebPart',
      version: '*',
      manifestVersion: 2,
      safeWithCustomScriptDisabled: true,
      supportedHosts: ['SharePointWebPart', 'TeamsPersonalApp', 'TeamsTab', 'SharePointFullPage'],
      preconfiguredEntries: [
        {
          groupId: '5c31a052-22b4-4f36-8f7d-4b4d8c7c2e7a',
          group: { default: 'Other' },
          title: { default: title },
          description: { default: description },
          officeFabricIconFontName: iconName,
          properties: { description: meta.bundleName }
        }
      ]
    };
    if (source.version === '*') {
      source.version = stripPreReleaseVersion(ctx.packageVersion);
    }
    const entryModuleId = ctx.entryModuleIds?.[meta.id] ?? meta.bundleName;
    source.loaderConfig = {
      internalModuleBaseUrls: ctx.production ? ctx.baseUrls.release : [ctx.baseUrls.debug],
      entryModuleId,
      scriptResources: buildScriptResources(ctx, spDependencies, entryModuleId)
    };
    manifests.push(source as ComponentManifest);
  }
  return manifests;
}

async function generateComponentManifestsBase(ctx: ManifestContext): Promise<ComponentManifest[]> {
  const spDependencies = findSpDependencies(ctx.projectRoot);
  // Synthetic path: if syntheticManifests provided (try mode), generate those directly
  // Also handles case where bundle manifestPath is "__synthetic__" via syntheticManifests
  if (ctx.syntheticManifests && ctx.syntheticManifests.length > 0) {
    const synthetic = generateSyntheticManifests(ctx, spDependencies);
    // In try mode we return synthetic only; if caller also expects filesystem manifests,
    // they can be merged — but spec says synthesize instead of scanning.
    // Return synthetic manifests; optionally also scan if not pure try mode.
    // For devTryMode we return only synthetic to avoid scanning stale manifests.
    return synthetic;
  }
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
    const scriptResources = buildScriptResources(ctx, spDependencies, entryModuleId);
    source.loaderConfig = {
      internalModuleBaseUrls: ctx.production ? ctx.baseUrls.release : [ctx.baseUrls.debug],
      entryModuleId,
      scriptResources
    };
    manifests.push(source as ComponentManifest);
  }
}
