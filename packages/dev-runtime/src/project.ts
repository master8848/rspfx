import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createLogger } from '@mbsks/rspfx-diagnostics';
import {
  resolvePathDefaults,
  solidPng,
  type BuildConfig,
  type FrameworkId,
  type PathsConfig,
  type RspfxConfig,
  type TeamsConfig
} from '@mbsks/rspfx-core';
import type {
  BundleEntry,
  CompileContext,
  ExternalMatcher,
  LocalizedResource
} from '@mbsks/rspfx-compiler-rspack';

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

// Environment helpers extracted to ./env.ts to keep project.ts under 1k LOC.
// Re-export preserves public API (`import { expandEnvVars } from './project.js'` still works).
import { expandEnvVars, expandObject, loadDotEnv } from './env.js';
export { expandEnvVars, expandObject };

function toPascal(name: string): string {
  return name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

const solidPngBuffer = solidPng;

function shortNameFromPackageJson(projectRoot: string): string {
  let packageName = 'my-solution';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')) as { name?: string };
    if (pkg.name) {
      packageName = pkg.name;
    }
  } catch {
    // ignore
  }
  return packageName.replace(/^@[^/]+\//, '');
}

function warnIfBrokenJson(filePath: string, projectRoot: string, label: string): void {
  try {
    JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    createLogger('rspfx').warn(
      `Config broken, not overwriting: ${label} - ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function discoverComponentId(projectRoot: string, paths: Required<PathsConfig>): string | undefined {
  const dirs = [paths.webpartsDir, paths.extensionsDir, paths.librariesDir];
  for (const dir of dirs) {
    const full = path.join(projectRoot, dir);
    if (!fs.existsSync(full)) {
      continue;
    }
    try {
      for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) {
          continue;
        }
        const sub = path.join(full, entry.name);
        let files: string[] = [];
        try {
          files = fs.readdirSync(sub);
        } catch (e) {
          createLogger('rspfx').debug(`Failed to read component subdir ${sub}: ${String(e)}`);
          continue;
        }
        for (const file of files.filter((f) => f.endsWith('.manifest.json'))) {
          try {
            const content = JSON.parse(fs.readFileSync(path.join(sub, file), 'utf8')) as { id?: string };
            if (content.id) {
              return content.id;
            }
          } catch (e) {
            createLogger('rspfx').debug(`Failed to parse manifest ${path.join(sub, file)}: ${String(e)}`);
          }
        }
      }
    } catch (e) {
      createLogger('rspfx').debug(`Failed to discover components in ${full}: ${String(e)}`);
    }
  }
  return undefined;
}

function isTeamsEnabled(rspfxConfig?: RspfxConfig): boolean {
  if (!rspfxConfig?.teams) {
    return false;
  }
  const teams = rspfxConfig.teams as boolean | TeamsConfig;
  if (typeof teams === 'boolean') {
    return teams;
  }
  if (typeof teams === 'object' && teams !== null) {
    return !!(teams as TeamsConfig).enabled;
  }
  return false;
}

export function ensureProjectConfigs(
  projectRoot: string,
  paths?: PathsConfig,
  rspfxConfig?: RspfxConfig
): void {
  const resolvedPaths = resolvePathDefaults(paths);
  const logger = createLogger('rspfx');
  const configDir = path.join(projectRoot, resolvedPaths.configDir);

  // config/serve.json
  const servePath = path.join(configDir, 'serve.json');
  if (!fs.existsSync(servePath)) {
    fs.mkdirSync(path.dirname(servePath), { recursive: true });
    const content = JSON.stringify(
      {
        $schema: 'https://developer.microsoft.com/json-schemas/spfx-build/spfx-serve.schema.json',
        initialPage: 'https://{tenantdomain}/_layouts/15/workbench.aspx',
        https: true,
        port: 4321,
        hostname: 'localhost'
      },
      null,
      2
    );
    fs.writeFileSync(servePath, content);
    logger.warn(`Config missing, auto-created: ${path.relative(projectRoot, servePath)}`);
  } else {
    warnIfBrokenJson(servePath, projectRoot, path.relative(projectRoot, servePath));
  }

  // config/write-manifests.json
  const writeManifestsPath = path.join(configDir, 'write-manifests.json');
  if (!fs.existsSync(writeManifestsPath)) {
    fs.mkdirSync(path.dirname(writeManifestsPath), { recursive: true });
    const content = JSON.stringify(
      {
        $schema: 'https://developer.microsoft.com/json-schemas/spfx-build/write-manifests.schema.json',
        cdnBasePath: ''
      },
      null,
      2
    );
    fs.writeFileSync(writeManifestsPath, content);
    logger.warn(`Config missing, auto-created: ${path.relative(projectRoot, writeManifestsPath)}`);
  } else {
    warnIfBrokenJson(writeManifestsPath, projectRoot, path.relative(projectRoot, writeManifestsPath));
  }

  // config/package-solution.json
  const packageSolutionPath = path.join(configDir, 'package-solution.json');
  if (!fs.existsSync(packageSolutionPath)) {
    fs.mkdirSync(path.dirname(packageSolutionPath), { recursive: true });
    const shortName = shortNameFromPackageJson(projectRoot);
    const solutionId = randomUUID();
    const featureId = randomUUID();
    const pascal = toPascal(shortName);
    const content = JSON.stringify(
      {
        $schema: 'https://developer.microsoft.com/json-schemas/spfx-build/package-solution.schema.json',
        solution: {
          name: `${shortName}-client-side-solution`,
          id: solutionId,
          version: '1.0.0.0',
          includeClientSideAssets: true,
          isDomainIsolated: false,
          skipFeatureDeployment: true,
          developer: {
            name: '',
            websiteUrl: '',
            privacyUrl: '',
            termsOfUseUrl: '',
            mpnId: 'Undefined-0000'
          },
          metadata: {
            shortDescription: { default: `${shortName} description` },
            longDescription: { default: `${shortName} description` },
            categories: [],
            screenshotPaths: []
          },
          features: [
            {
              title: `${pascal} Feature`,
              description: `A feature which activates the Client-Side WebPart named '${pascal}'`,
              id: featureId,
              version: '1.0.0.0',
              assets: { elementManifests: [], elementFiles: [] }
            }
          ]
        },
        paths: { zippedPackage: `sharepoint/solution/${shortName}.sppkg` }
      },
      null,
      2
    );
    fs.writeFileSync(packageSolutionPath, content);
    logger.warn(`Config missing, auto-created: ${path.relative(projectRoot, packageSolutionPath)}`);
  } else {
    warnIfBrokenJson(packageSolutionPath, projectRoot, path.relative(projectRoot, packageSolutionPath));
  }

  // config/config.json
  const configJsonPathEns = path.join(configDir, 'config.json');
  if (!fs.existsSync(configJsonPathEns)) {
    fs.mkdirSync(path.dirname(configJsonPathEns), { recursive: true });
    const webpartsDir = path.join(projectRoot, resolvedPaths.webpartsDir);
    let localizedResources: Record<string, string> = {};
    try {
      const dirs = fs
        .readdirSync(webpartsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('.'));
      for (const dir of dirs) {
        const pascal = toPascal(dir.name);
        localizedResources[`${pascal}WebPartStrings`] = `src/webparts/${dir.name}/loc/{locale}.js`;
      }
    } catch {
      // ignore
    }
    const content = JSON.stringify(
      {
        $schema: 'https://developer.microsoft.com/json-schemas/spfx-build/config.1.0.schema.json',
        ...(Object.keys(localizedResources).length > 0 ? { localizedResources } : { localizedResources: {} })
      },
      null,
      2
    );
    fs.writeFileSync(configJsonPathEns, content);
    logger.warn(`Config missing, auto-created: ${path.relative(projectRoot, configJsonPathEns)}`);
  } else {
    warnIfBrokenJson(configJsonPathEns, projectRoot, path.relative(projectRoot, configJsonPathEns));
  }

  // teams/manifest.json and icons — only when teams integration is enabled
  if (isTeamsEnabled(rspfxConfig)) {
    const teamsDir = path.join(projectRoot, 'teams');
    const teamsManifestPath = path.join(teamsDir, 'manifest.json');
    let teamsComponentId: string | undefined;
    if (fs.existsSync(teamsManifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(teamsManifestPath, 'utf8')) as { id?: string };
        if (typeof manifest.id === 'string' && manifest.id) {
          teamsComponentId = manifest.id;
        }
      } catch (error) {
        logger.warn(
          `Config broken, not overwriting: ${path.relative(projectRoot, teamsManifestPath)} - ${error instanceof Error ? error.message : String(error)}`
        );
        teamsComponentId = discoverComponentId(projectRoot, resolvedPaths) ?? randomUUID();
        if (!discoverComponentId(projectRoot, resolvedPaths)) {
          logger.warn(`No web part manifest found to infer componentId for teams icons, generated id: ${teamsComponentId}`);
        }
      }
    } else {
      teamsComponentId = discoverComponentId(projectRoot, resolvedPaths);
      if (!teamsComponentId) {
        teamsComponentId = randomUUID();
        logger.warn(`No web part manifest found to infer componentId for teams manifest, generated new id: ${teamsComponentId}`);
      }
      fs.mkdirSync(teamsDir, { recursive: true });
      const shortName = shortNameFromPackageJson(projectRoot);
      const tabUrl = `https://{teamSiteDomain}{teamSitePath}/_layouts/15/TeamsLogon.aspx?SPFX=true&dest={teamSitePath}/_layouts/15/teamshostedapp.aspx%3FopenPropertyPane=true%26teams%26componentId=${teamsComponentId}%26forceLocale={locale}`;
      const content = JSON.stringify(
        {
          $schema: 'https://developer.microsoft.com/json-schemas/teams/v1.13/MicrosoftTeams.schema.json',
          manifestVersion: '1.13',
          version: '1.0.0',
          id: teamsComponentId,
          packageName: `com.contoso.${shortName}`,
          developer: {
            name: 'SPFx + Teams Dev',
            websiteUrl: 'https://products.office.com/en-us/sharepoint/collaboration',
            privacyUrl: 'https://privacy.microsoft.com/en-us/privacystatement',
            termsOfUseUrl: 'https://www.microsoft.com/en-us/servicesagreement'
          },
          name: { short: shortName, full: shortName },
          description: { short: `${shortName} description`, full: `${shortName} description` },
          icons: {
            outline: `${teamsComponentId}_outline.png`,
            color: `${teamsComponentId}_color.png`
          },
          accentColor: '#FFFFFF',
          staticTabs: [
            {
              entityId: teamsComponentId,
              name: shortName,
              contentUrl: tabUrl,
              websiteUrl: 'https://products.office.com/en-us/sharepoint/collaboration',
              scopes: ['personal']
            }
          ],
          configurableTabs: [
            {
              configurationUrl: tabUrl,
              canUpdateConfiguration: true,
              scopes: ['team']
            }
          ],
          validDomains: [
            '*.login.microsoftonline.com',
            '*.sharepoint.com',
            '*.sharepoint-df.com',
            'spoppe-a.akamaihd.net',
            'spoprod-a.akamaihd.net',
            '*.microsoftonline.com',
            '*.microsoftonline-p.com',
            '*.msauth.net',
            '*.msauthimages.net',
            '*.msftauth.net',
            '*.msftauthimages.net',
            '*.office.com',
            '*.officeapps.live.com',
            '*.secure.aadcdn.microsoftonline-p.com'
          ]
        },
        null,
        2
      );
      fs.writeFileSync(teamsManifestPath, content);
      logger.warn(`Config missing, auto-created: ${path.relative(projectRoot, teamsManifestPath)}`);
    }

    if (teamsComponentId) {
      for (const suffix of ['_color.png', '_outline.png'] as const) {
        const iconPath = path.join(teamsDir, `${teamsComponentId}${suffix}`);
        if (!fs.existsSync(iconPath)) {
          fs.mkdirSync(path.dirname(iconPath), { recursive: true });
          const isColor = suffix === '_color.png';
          const width = isColor ? 192 : 32;
          const height = isColor ? 192 : 32;
          const rgb: [number, number, number] = isColor ? [0, 120, 212] : [50, 49, 48];
          const buffer = solidPngBuffer(width, height, rgb);
          fs.writeFileSync(iconPath, buffer);
          logger.warn(`Config missing, auto-created: ${path.relative(projectRoot, iconPath)}`);
        }
      }
    }
  }
}

export function readProject(
  projectRoot: string,
  paths?: PathsConfig,
  versionOverride?: string,
  rspfxConfig?: RspfxConfig
): ReadProjectResult {
  const resolvedPaths = resolvePathDefaults(paths);
  loadDotEnv(projectRoot);
  ensureProjectConfigs(projectRoot, resolvedPaths, rspfxConfig);
  const packageJsonPath = path.join(projectRoot, 'package.json');
  let packageJson: { name?: string; version?: string } = {};
  if (fs.existsSync(packageJsonPath)) {
    try {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    } catch (error) {
      createLogger('rspfx').warn(
        `Config broken, not overwriting: package.json - ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const configJsonPath = path.join(projectRoot, resolvedPaths.configDir, 'config.json');
  let configJson: ProjectConfigJson | undefined;
  if (fs.existsSync(configJsonPath)) {
    try {
      configJson = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
    } catch (error) {
      createLogger('rspfx').warn(
        `Config broken, not overwriting: ${path.relative(projectRoot, configJsonPath)} - ${error instanceof Error ? error.message : String(error)}`
      );
      configJson = undefined;
    }
  }

  const serveJsonPath = path.join(projectRoot, resolvedPaths.configDir, 'serve.json');
  let serveJson: ProjectServeConfigJson | undefined;
  if (fs.existsSync(serveJsonPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(serveJsonPath, 'utf8'));
      const expanded = expandObject(raw) as ProjectServeConfigJson;
      serveJson = expanded;
      if (serveJson && typeof (serveJson as unknown as Record<string, unknown>).port === 'string') {
        const portStr = (serveJson as unknown as Record<string, unknown>).port as string;
        const portNum = Number(portStr);
        if (!Number.isNaN(portNum) && portStr.trim() !== '') {
          serveJson.port = portNum;
        }
      }
    } catch (error) {
      createLogger('rspfx').warn(
        `Config broken, not overwriting: ${path.relative(projectRoot, serveJsonPath)} - ${error instanceof Error ? error.message : String(error)}`
      );
      serveJson = undefined;
    }
  }

  const webParts = discoverWebParts(
    projectRoot,
    configJson,
    resolvedPaths.webpartsDir,
    { version: versionOverride ?? packageJson.version },
    resolvedPaths.extensionsDir,
    resolvedPaths.librariesDir
  );
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
  packageJson?: { version?: string },
  extensionsDir = 'src/extensions',
  librariesDir = 'src/libraries'
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
    scanComponentDir(projectRoot, webpartsDir, bundleMap);
    scanComponentDir(projectRoot, extensionsDir, bundleMap);
    scanComponentDir(projectRoot, librariesDir, bundleMap);
  }

  if (bundleMap.length === 0) {
    throw new Error(
      'No web part, extension, or library bundles found. Expected src/webparts/<name>/<name>WebPart.ts + <name>.manifest.json, src/extensions/<name>/<Name>Extension.ts + <name>.manifest.json, or src/libraries/<name>/<name>.manifest.json'
    );
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

function scanComponentDir(projectRoot: string, componentsDir: string, bundleMap: WebPartBundle[]): void {
  const resolvedDir = path.join(projectRoot, componentsDir);
  if (!fs.existsSync(resolvedDir)) {
    return;
  }
  for (const dir of fs.readdirSync(resolvedDir, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith('.')) {
      continue;
    }
    const dirPath = path.join(resolvedDir, dir.name);
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

/**
 * Alias for `discoverWebParts` — discovers web part and extension bundles alike.
 */
export const discoverComponents = discoverWebParts;

// Candidates mirror `packages/templates/src/index.ts:551` extensionSuffix/extensionType.
// Kept inline for single-file readability — keep in sync when adding types.
function pickEntrypoint(dirPath: string, dirName: string): string | undefined {
  const pascal = toPascal(dirName);
  const candidates = [
    path.join(dirPath, 'index.ts'),
    path.join(dirPath, 'index.tsx'),
    path.join(dirPath, `${dirName}WebPart.ts`),
    path.join(dirPath, `${dirName}WebPart.tsx`),
    path.join(dirPath, `${pascal}WebPart.ts`),
    path.join(dirPath, `${pascal}WebPart.tsx`),
    path.join(dirPath, `${dirName}ApplicationCustomizer.ts`),
    path.join(dirPath, `${dirName}ApplicationCustomizer.tsx`),
    path.join(dirPath, `${pascal}ApplicationCustomizer.ts`),
    path.join(dirPath, `${pascal}ApplicationCustomizer.tsx`),
    path.join(dirPath, `${dirName}FieldCustomizer.ts`),
    path.join(dirPath, `${dirName}FieldCustomizer.tsx`),
    path.join(dirPath, `${pascal}FieldCustomizer.ts`),
    path.join(dirPath, `${pascal}FieldCustomizer.tsx`),
    path.join(dirPath, `${dirName}CommandSet.ts`),
    path.join(dirPath, `${dirName}CommandSet.tsx`),
    path.join(dirPath, `${pascal}CommandSet.ts`),
    path.join(dirPath, `${pascal}CommandSet.tsx`),
    path.join(dirPath, `${dirName}FormCustomizer.ts`),
    path.join(dirPath, `${dirName}FormCustomizer.tsx`),
    path.join(dirPath, `${pascal}FormCustomizer.ts`),
    path.join(dirPath, `${pascal}FormCustomizer.tsx`),
    path.join(dirPath, `${dirName}Extension.ts`),
    path.join(dirPath, `${dirName}Extension.tsx`),
    path.join(dirPath, `${dirName}.ts`),
    path.join(dirPath, `${dirName}.tsx`),
    path.join(dirPath, `${dirName}Library.ts`),
    path.join(dirPath, `${dirName}Library.tsx`),
    path.join(dirPath, `${pascal}Library.ts`),
    path.join(dirPath, `${pascal}Library.tsx`)
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
  externals: (string | ExternalMatcher)[];
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
    serveMode: opts.serveMode
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
    // Vite/Vitest ESM transform mishandles %20 in file URLs when the repo path contains spaces.
    // Prefer CJS require to avoid the dev-server transform; fall back to dynamic import.
    try {
      const req = createRequire(pathToFileURL(path.join(projectRoot, 'package.json')).href);
      const mod = req(resolved) as Record<string, unknown>;
      return { ...mod, __rspfxModuleUrl: pathToFileURL(resolved).href };
    } catch {
      // fallback to ESM import (e.g. when preset is pure ESM)
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
