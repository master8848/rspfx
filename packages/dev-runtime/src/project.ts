import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '@mbsks/rspfx-diagnostics';
import type { BuildConfig, FrameworkId, RspfxConfig } from '@mbsks/rspfx-core';
import type { BundleEntry, CompileContext } from '@mbsks/rspfx-compiler-rspack';

export interface WebPartBundle {
  bundleName: string;
  entrypoint: string;
  manifestPath: string;
}

export interface DiscoveredWebParts {
  entries: BundleEntry[];
  bundles: WebPartBundle[];
  manifestIds: string[];
  packageVersion: string;
}

export interface ProjectConfigJson {
  bundles?: Record<string, { components: { entrypoint: string; manifest: string }[] }>;
  externals?: Record<string, string>;
}

export interface ProjectServeConfigJson {
  port?: number;
  https?: boolean;
  hostname?: string;
  initialPage?: string;
  ipAddress?: string;
}

export interface ReadProjectResult {
  webParts: DiscoveredWebParts;
  configJson: ProjectConfigJson | undefined;
  serveJson: ProjectServeConfigJson | undefined;
  externals: string[];
}

export function readProject(projectRoot: string): ReadProjectResult {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  let packageJson: { name?: string; version?: string } = {};
  if (fs.existsSync(packageJsonPath)) {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  }

  const configJsonPath = path.join(projectRoot, 'config', 'config.json');
  let configJson: ProjectConfigJson | undefined;
  if (fs.existsSync(configJsonPath)) {
    configJson = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
  }

  const serveJsonPath = path.join(projectRoot, 'config', 'serve.json');
  let serveJson: ProjectServeConfigJson | undefined;
  if (fs.existsSync(serveJsonPath)) {
    serveJson = JSON.parse(fs.readFileSync(serveJsonPath, 'utf8'));
  }

  const webParts = discoverWebParts(projectRoot, configJson);
  return { webParts, configJson, serveJson, externals: readExternals(projectRoot, configJson) };
}

function readExternals(projectRoot: string, configJson: ProjectConfigJson | undefined): string[] {
  const externals = new Set<string>();
  if (configJson?.externals) {
    for (const key of Object.keys(configJson.externals)) {
      externals.add(key);
    }
  }
  return [...externals];
}

export function discoverWebParts(
  projectRoot: string,
  configJson: ProjectConfigJson | undefined
): DiscoveredWebParts {
  const bundleMap: WebPartBundle[] = [];
  if (configJson?.bundles) {
    for (const [bundleName, entry] of Object.entries(configJson.bundles)) {
      for (const component of entry.components) {
        const entrypoint = path.resolve(projectRoot, component.entrypoint);
        const manifestPath = path.resolve(projectRoot, component.manifest);
        if (!fs.existsSync(entrypoint)) {
          throw new Error(`Bundle "${bundleName}" entrypoint not found: ${entrypoint}`);
        }
        if (!fs.existsSync(manifestPath)) {
          throw new Error(`Bundle "${bundleName}" manifest not found: ${manifestPath}`);
        }
        bundleMap.push({ bundleName, entrypoint, manifestPath });
      }
    }
  } else {
    const webpartsDir = path.join(projectRoot, 'src', 'webparts');
    if (fs.existsSync(webpartsDir)) {
      for (const dir of fs.readdirSync(webpartsDir, { withFileTypes: true })) {
        if (!dir.isDirectory() || dir.name.startsWith('.')) {
          continue;
        }
        const dirPath = path.join(webpartsDir, dir.name);
        const manifests = fs
          .readdirSync(dirPath)
          .filter((file) => file.endsWith('.manifest.json') && !file.startsWith('.'));
        if (manifests.length === 0) {
          continue;
        }
        const entrypoint = pickEntrypoint(dirPath, dir.name);
        if (!entrypoint) {
          continue;
        }
        bundleMap.push({
          bundleName: dir.name,
          entrypoint,
          manifestPath: path.join(dirPath, manifests[0]!)
        });
      }
    }
  }

  if (bundleMap.length === 0) {
    throw new Error('No web part bundles found. Expected src/webparts/<name>/<name>WebPart.ts + <name>.manifest.json');
  }

  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version?: string };
  const packageVersion = (packageJson.version ?? '1.0.0').split('-')[0]!;

  const entries: BundleEntry[] = bundleMap.map((bundle) => ({
    name: bundle.bundleName,
    import: bundle.entrypoint,
    componentIds: [],
    version: packageVersion
  }));

  const manifestIds: string[] = [];
  for (const bundle of bundleMap) {
    const manifest = JSON.parse(fs.readFileSync(bundle.manifestPath, 'utf8')) as { id?: string };
    if (!manifest.id) {
      throw new Error(`Manifest missing "id": ${bundle.manifestPath}`);
    }
    manifestIds.push(manifest.id);
    const entry = entries.find((e) => e.name === bundle.bundleName)!;
    entry.componentIds.push(manifest.id);
  }

  return { entries, bundles: bundleMap, manifestIds, packageVersion };
}

function pickEntrypoint(dirPath: string, dirName: string): string | undefined {
  const candidates = [
    path.join(dirPath, 'index.ts'),
    path.join(dirPath, 'index.tsx'),
    path.join(dirPath, `${dirName}WebPart.ts`),
    path.join(dirPath, `${dirName}WebPart.tsx`)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  const tsFiles = fs.readdirSync(dirPath).filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
  if (tsFiles.length === 1) {
    return path.join(dirPath, tsFiles[0]!);
  }
  return undefined;
}

export function createCompileContext(opts: {
  projectRoot: string;
  config: RspfxConfig;
  entries: BundleEntry[];
  externals: string[];
  fastRefresh: boolean;
  production: boolean;
  serveMode: boolean;
  build: BuildConfig;
}): CompileContext {
  return {
    projectRoot: opts.projectRoot,
    framework: opts.config.framework,
    fastRefresh: opts.fastRefresh,
    production: opts.production,
    entries: opts.entries,
    externals: opts.externals,
    build: opts.build,
    serveMode: opts.serveMode,
    tailwind: opts.config.styling === 'tailwind'
  };
}

export async function loadFrameworkPreset(framework: FrameworkId): Promise<unknown> {
  try {
    const mod = (await import(`@mbsks/rspfx-framework-${framework}`)) as {
      preset?: { contributions(opts: { fastRefresh: boolean }): unknown };
    };
    if (!mod.preset) {
      throw new Error(`Framework package @mbsks/rspfx-framework-${framework} does not export a preset`);
    }
    return mod.preset;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Cannot find') || error.message.includes('does not export a preset'))
    ) {
      createLogger('rspfx').warn(
        `Framework package @mbsks/rspfx-framework-${framework} has no preset; running without framework compiler contributions.`
      );
      return { contributions: (): Record<string, unknown> => ({}) };
    }
    throw error;
  }
}
