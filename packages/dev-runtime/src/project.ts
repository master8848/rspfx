import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createLogger } from '@mbsks/rspfx-diagnostics';
import {
  resolvePathDefaults,
  type BuildConfig,
  type FrameworkId,
  type PathsConfig,
  type RspfxConfig
} from '@mbsks/rspfx-core';
import type { BundleEntry, CompileContext, LocalizedResource } from '@mbsks/rspfx-compiler-rspack';

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
  externals?: Record<string, unknown>;
  localizedResources?: Record<string, string>;
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
  localizedAliases: Record<string, string>;
  localizedResources: LocalizedResource[];
}

export function readProject(projectRoot: string, paths?: PathsConfig): ReadProjectResult {
  const resolvedPaths = resolvePathDefaults(paths);
  const packageJsonPath = path.join(projectRoot, 'package.json');
  let packageJson: { name?: string; version?: string } = {};
  if (fs.existsSync(packageJsonPath)) {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  }

  const configJsonPath = path.join(projectRoot, resolvedPaths.configDir, 'config.json');
  let configJson: ProjectConfigJson | undefined;
  if (fs.existsSync(configJsonPath)) {
    configJson = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
  }

  const serveJsonPath = path.join(projectRoot, resolvedPaths.configDir, 'serve.json');
  let serveJson: ProjectServeConfigJson | undefined;
  if (fs.existsSync(serveJsonPath)) {
    serveJson = JSON.parse(fs.readFileSync(serveJsonPath, 'utf8'));
  }

  const webParts = discoverWebParts(projectRoot, configJson, resolvedPaths.webpartsDir, packageJson);
  return {
    webParts,
    configJson,
    serveJson,
    externals: readExternals(projectRoot, configJson),
    localizedAliases: readLocalizedAliases(projectRoot, configJson, resolvedPaths.srcDir),
    localizedResources: readLocalizedResources(projectRoot, configJson, resolvedPaths.srcDir)
  };
}

/**
 * Maps `config.json` `localizedResources` entries (the official SPFx mechanism
 * for localized string modules such as `import strings from 'XxxWebPartStrings'`)
 * to the default-locale resource file. Official projects point these at the
 * Heft output convention `lib/.../{locale}.js`; RSPFX resolves them to source
 * (`src/.../en-us.js`/`.ts`), where the Rspack resolver then bundles the module.
 * `node_modules/...` patterns (third-party localized resources) are kept as-is.
 */
export function readLocalizedAliases(
  projectRoot: string,
  configJson: ProjectConfigJson | undefined,
  srcDir = 'src'
): Record<string, string> {
  const aliases: Record<string, string> = {};
  if (!configJson?.localizedResources) {
    return aliases;
  }
  for (const [name, pattern] of Object.entries(configJson.localizedResources)) {
    if (typeof pattern !== 'string' || !pattern.includes('{locale}')) {
      continue;
    }
    let target = pattern.replace('{locale}', 'en-us');
    if (target.startsWith('lib/')) {
      target = srcDir + '/' + target.slice('lib/'.length);
    }
    aliases[name] = path.resolve(projectRoot, target).replace(/\.(js|ts|tsx)$/, '');
  }
  return aliases;
}

/**
 * Maps `config.json` `localizedResources` entries (the official SPFx mechanism
 * for localized string modules such as `import strings from 'XxxWebPartStrings'`)
 * to the locale files on disk. `lib/...` patterns resolve under the source
 * directory (official projects point at Heft output `lib/...`), while
 * `node_modules/...` patterns are kept as-is.
 *
 * The returned resources are externalized in the bundle (the AMD entry lists
 * them as dependencies), emitted to `dist/<name>_<locale>.js`, and declared in
 * the generated manifests as `localizedPath` script resources — mirroring the
 * official toolchain. sp-loader then loads the correct locale per UI language.
 */
export function readLocalizedResources(
  projectRoot: string,
  configJson: ProjectConfigJson | undefined,
  srcDir = 'src'
): LocalizedResource[] {
  const resources: LocalizedResource[] = [];
  if (!configJson?.localizedResources) {
    return resources;
  }
  for (const [name, pattern] of Object.entries(configJson.localizedResources)) {
    if (typeof pattern !== 'string' || !pattern.includes('{locale}')) {
      continue;
    }
    const dirPattern = pattern.slice(0, pattern.lastIndexOf('/') + 1);
    let dirPath: string;
    if (dirPattern.startsWith('lib/')) {
      dirPath = path.resolve(projectRoot, srcDir, dirPattern.slice('lib/'.length));
    } else {
      dirPath = path.resolve(projectRoot, dirPattern);
    }
    let fileNames: string[];
    try {
      fileNames = fs.readdirSync(dirPath);
    } catch {
      continue;
    }
    const files = fileNames
      .filter(
        (file) =>
          (file.endsWith('.js') || (file.endsWith('.ts') && !file.endsWith('.d.ts'))) &&
          !file.startsWith('.')
      )
      .map((file) => ({
        locale: file.replace(/\.(js|ts)$/, ''),
        path: path.join(dirPath, file)
      }));
    if (files.length > 0) {
      resources.push({ name, files });
    }
  }
  return resources;
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
  configJson: ProjectConfigJson | undefined,
  webpartsDir = 'src/webparts',
  packageJson?: { version?: string }
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
    const resolvedWebpartsDir = path.join(projectRoot, webpartsDir);
    if (fs.existsSync(resolvedWebpartsDir)) {
      for (const dir of fs.readdirSync(resolvedWebpartsDir, { withFileTypes: true })) {
        if (!dir.isDirectory() || dir.name.startsWith('.')) {
          continue;
        }
        const dirPath = path.join(resolvedWebpartsDir, dir.name);
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

  if (packageJson === undefined) {
    packageJson = {};
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version?: string };
    }
  }
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
  localizedAliases?: Record<string, string>;
  localizedResources?: LocalizedResource[];
  fastRefresh: boolean;
  production: boolean;
  serveMode: boolean;
  build: BuildConfig;
}): CompileContext {
  const localizedResources = opts.localizedResources ?? [];
  const localizedNames = new Set(localizedResources.map((resource) => resource.name));
  const aliases = Object.fromEntries(
    Object.entries(opts.localizedAliases ?? {}).filter(([name]) => !localizedNames.has(name))
  );
  return {
    projectRoot: opts.projectRoot,
    framework: opts.config.framework,
    fastRefresh: opts.fastRefresh,
    production: opts.production,
    entries: opts.entries,
    externals: [...opts.externals, ...localizedNames],
    aliases,
    localizedResources,
    build: opts.build,
    serveMode: opts.serveMode,
    tailwind: opts.config.styling === 'tailwind'
  };
}

export interface FrameworkPresetModule {
  preset: { contributions(opts: { fastRefresh: boolean }): Record<string, unknown> };
  moduleUrl: string;
}

export async function loadFrameworkPreset(
  framework: FrameworkId,
  projectRoot?: string
): Promise<FrameworkPresetModule> {
  const mod = (await importFramework(framework, projectRoot)) as
    | { preset?: { contributions(opts: { fastRefresh: boolean }): unknown }; __rspfxModuleUrl?: string }
    | undefined;
  if (!mod?.preset) {
    createLogger('rspfx').warn(
      `Framework package @mbsks/rspfx-framework-${framework} has no preset; running without framework compiler contributions.`
    );
    return {
      preset: { contributions: (): Record<string, unknown> => ({}) },
      moduleUrl: ''
    };
  }
  return {
    preset: mod.preset as FrameworkPresetModule['preset'],
    moduleUrl: mod.__rspfxModuleUrl ?? ''
  };
}

export function resolveContributionLoaders(
  contributions: Record<string, unknown>,
  frameworkModuleUrl: string
): Record<string, unknown> {
  if (!frameworkModuleUrl) {
    return contributions;
  }
  contributions = {
    ...contributions,
    rules: Array.isArray(contributions.rules) ? [...(contributions.rules as unknown[])] : contributions.rules
  };
  const requireFromFramework = createRequire(frameworkModuleUrl);
  const resolveLoader = (value: unknown): unknown => {
    if (typeof value === 'string' && !value.startsWith('builtin:')) {
      try {
        return requireFromFramework.resolve(value);
      } catch {
        return value;
      }
    }
    return value;
  };
  const resolveLoaderOptions = (use: Record<string, unknown>): Record<string, unknown> => {
    const options = use.options as Record<string, unknown> | undefined;
    if (options) {
      for (const key of ['presets', 'plugins']) {
        const list = options[key];
        if (Array.isArray(list)) {
          options[key] = list.map((item) => {
            if (typeof item === 'string') {
              return resolveBabelItem(item, requireFromFramework);
            }
            if (Array.isArray(item) && typeof item[0] === 'string') {
              return [resolveBabelItem(item[0], requireFromFramework), item[1]];
            }
            return item;
          });
        }
      }
    }
    return { ...use, loader: resolveLoader(use.loader) };
  };
  const rules = contributions.rules;
  if (Array.isArray(rules)) {
    contributions.rules = rules.map((rule: Record<string, unknown>) => {
      if (rule && typeof rule === 'object' && 'use' in rule) {
        const use = rule.use;
        if (typeof use === 'string') {
          rule.use = resolveLoader(use);
        } else if (Array.isArray(use)) {
          rule.use = use.map((u) => {
            if (typeof u === 'string') {
              return resolveLoader(u);
            }
            if (u && typeof u === 'object' && 'loader' in (u as Record<string, unknown>)) {
              return resolveLoaderOptions(u as Record<string, unknown>);
            }
            return u;
          });
        } else if (use && typeof use === 'object' && 'loader' in (use as Record<string, unknown>)) {
          rule.use = resolveLoaderOptions(use as Record<string, unknown>);
        }
      }
      return rule;
    });
  }
  return contributions;
}

function resolveBabelItem(
  name: string,
  requireFromFramework: ReturnType<typeof createRequire>
): string {
  try {
    return requireFromFramework.resolve(name);
  } catch {
    return name;
  }
}

async function importFramework(framework: FrameworkId, projectRoot?: string): Promise<unknown> {
  const specifier = `@mbsks/rspfx-framework-${framework}`;
  if (projectRoot) {
    let resolved: string;
    try {
      const requireFromProject = createRequire(
        pathToFileURL(path.join(projectRoot, 'package.json')).href
      );
      resolved = requireFromProject.resolve(specifier);
    } catch (error) {
      if (isResolutionFailure(error)) {
        return undefined;
      }
      throw error;
    }
    try {
      const mod = await import(pathToFileURL(resolved).href);
      return { ...mod, __rspfxModuleUrl: pathToFileURL(resolved).href };
    } catch (error) {
      throw error instanceof Error
        ? new Error(`Failed to load framework preset for '${specifier}': ${error.message}`, { cause: error })
        : error;
    }
  }
  try {
    return await import(specifier);
  } catch (error) {
    if (isResolutionFailure(error)) {
      return undefined;
    }
    throw error;
  }
}

function isResolutionFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as NodeJS.ErrnoException).code;
  return (
    code === 'MODULE_NOT_FOUND' ||
    code === 'ERR_MODULE_NOT_FOUND' ||
    code === 'ERR_PACKAGE_PATH_NOT_EXPORTED'
  );
}
