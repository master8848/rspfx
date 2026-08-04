import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createLogger, RspfxError } from '@mbsks/rspfx-diagnostics';
import { globFiles } from './glob.js';
import { parseResx } from './resx.js';
import {
  buildAppManifestXml,
  buildAppPartConfigXml,
  buildContentTypesXml,
  buildElementsXml,
  buildFeatureXml,
  buildRelsXml,
  type Relationship
} from './xml.js';
import { writeZip, type ZipFileEntry } from './zip.js';

export interface PackageConfig {
  solution: Record<string, unknown>;
  paths: { zippedPackage: string };
}

export interface ComponentManifest {
  id: string;
  alias?: string;
  componentType?: string;
  version?: string;
  manifestVersion?: number;
  loaderConfig: {
    internalModuleBaseUrls: string[];
    entryModuleId: string;
    scriptResources: Record<string, unknown>;
    exportName?: string;
  };
  [key: string]: unknown;
}

export interface ClientSideAsset {
  originalFilename: string;
  packageFilename: string;
}

export interface BuildPackageOptions {
  projectRoot: string;
  solutionConfigPath: string;
  manifestsDir: string;
  assetsDir: string;
  outDir?: string;
  production: boolean;
  prettyXml?: boolean;
  teamsDir?: string;
  resxDir?: string;
}

export interface BuildPackageResult {
  outputPath: string;
  zipEntries: string[];
  appManifest: string;
}

interface FeatureDefinition {
  title?: string;
  description?: string;
  id?: string;
  version?: string;
  componentIds?: string[];
  assets?: { elementManifests?: unknown; elementFiles?: unknown; upgradeActions?: unknown[] };
}

interface NormalizedFeature {
  title: string;
  description: string;
  id: string;
  version: string;
  components: ComponentManifest[];
  explicitComponentIds: boolean;
  assets: { elementManifests: string[]; elementFiles: string[] };
}

interface ResxFile {
  name: string;
  buffer: Buffer;
  locale: string;
  values: Record<string, string>;
}

const logger = createLogger('sppkg-builder');

const REL_PACKAGE_MANIFEST = 'http://schemas.microsoft.com/sharepoint/2012/app/relationships/package-manifest';
const REL_MANIFEST_FEATURE = 'http://schemas.microsoft.com/sharepoint/2012/app/relationships/manifest-feature';
const REL_MANIFEST_CLIENTSIDEASSET =
  'http://schemas.microsoft.com/sharepoint/2012/app/relationships/manifest-clientsideasset';
const REL_PART_CONFIGURATION = 'http://schemas.microsoft.com/sharepoint/2012/app/relationships/partconfiguration';
const REL_FEATURE_ELEMENT_MANIFEST =
  'http://schemas.microsoft.com/sharepoint/2012/app/relationships/feature-elementmanifest';
const REL_FEATURE_CLIENTSIDEASSET =
  'http://schemas.microsoft.com/sharepoint/2016/03/features/clientsideasset';
const REL_CLIENTSIDEASSET = 'http://schemas.microsoft.com/sharepoint/2012/app/relationships/clientsideasset';
const REL_CONTENT_DEFAULT_RESOURCE =
  'http://schemas.microsoft.com/sharepoint/2012/app/relationships/content-defaultresource';
const REL_CONTENT_RESOURCE = 'http://schemas.microsoft.com/sharepoint/2012/app/relationships/content-resource';

const SP_CLIENT_SIDE_ASSET_LIBRARY = 'HTTPS://SPCLIENTSIDEASSETLIBRARY/';

export async function buildPackage(opts: BuildPackageOptions): Promise<BuildPackageResult> {
  const projectRoot = path.resolve(opts.projectRoot);
  const { solution, zippedPackage } = await loadSolutionConfig(projectRoot, opts.solutionConfigPath);

  const manifests = await loadManifests(path.resolve(projectRoot, opts.manifestsDir));

  const includeClientSideAssets = solution.includeClientSideAssets === true;
  const useClientSideAssets = opts.production && includeClientSideAssets;

  if (useClientSideAssets) {
    for (const manifest of manifests) {
      manifest.loaderConfig.internalModuleBaseUrls = [SP_CLIENT_SIDE_ASSET_LIBRARY];
    }
  }

  const features = normalizeFeatures(solution, manifests);
  const clientSideAssets = useClientSideAssets
    ? await collectClientSideAssets(
        path.resolve(projectRoot, opts.assetsDir),
        opts.teamsDir ? path.resolve(projectRoot, opts.teamsDir) : undefined
      )
    : [];
  const resxFiles = opts.resxDir ? await collectResx(path.resolve(projectRoot, opts.resxDir)) : [];

  const pretty = opts.prettyXml ?? true;

  const assetsFeature: NormalizedFeature | undefined = useClientSideAssets
    ? {
        title: 'Client Side Assets',
        description: 'A feature that help deploy client side component assets to SharePoint Online.',
        id: randomUUID(),
        version: '1.0.0.0',
        components: [],
        explicitComponentIds: false,
        assets: { elementManifests: [], elementFiles: [] }
      }
    : undefined;

  const entries: ZipFileEntry[] = [];
  const allEntryNames: string[] = [];

  const addEntry = (name: string, content: string | Buffer): void => {
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    entries.push({ name, buffer });
    allEntryNames.push(name);
  };

  for (const feature of features) {
    addEntry(`feature_${feature.id}.xml`, buildFeatureXml(feature, pretty));
    addEntry(`feature_${feature.id}.xml.config.xml`, buildAppPartConfigXml(feature.id, pretty));
    const relationships: Relationship[] = [
      { type: REL_PART_CONFIGURATION, target: `feature_${feature.id}.xml.config.xml` }
    ];
    for (const component of feature.components) {
      const componentType = component.componentType ?? 'WebPart';
      const componentName = typeof component.alias === 'string' && component.alias ? component.alias : feature.title;
      const componentFile = `${feature.id}/${componentType}_${component.id}.xml`;
      addEntry(componentFile, buildElementsXml(componentName, component, pretty));
      relationships.push({ type: REL_FEATURE_ELEMENT_MANIFEST, target: componentFile });
    }
    if (assetsFeature) {
      relationships.push({ type: REL_FEATURE_CLIENTSIDEASSET, target: 'ClientSideAssets.xml' });
    }
    for (const relativePath of feature.assets.elementManifests) {
      const zipName = toZipPath(relativePath);
      addEntry(zipName, await readProjectFile(projectRoot, relativePath, 'element manifest'));
      relationships.push({ type: REL_FEATURE_ELEMENT_MANIFEST, target: zipName });
    }
    for (const relativePath of feature.assets.elementFiles) {
      const zipName = toZipPath(relativePath);
      addEntry(zipName, await readProjectFile(projectRoot, relativePath, 'element file'));
      relationships.push({ type: REL_CONTENT_RESOURCE, target: zipName });
    }
    addEntry(`feature_${feature.id}.xml.rels`, buildRelsXml(relationships, pretty));
  }

  if (assetsFeature) {
    addEntry('ClientSideAssets.xml', buildFeatureXml(assetsFeature, pretty));
    addEntry('ClientSideAssets.xml.config.xml', buildAppPartConfigXml(assetsFeature.id, pretty));
    const relationships: Relationship[] = [
      { type: REL_PART_CONFIGURATION, target: 'ClientSideAssets.xml.config.xml' }
    ];
    for (const asset of clientSideAssets) {
      const zipName = `ClientSideAssets/${toZipPath(asset.packageFilename)}`;
      addEntry(zipName, await readFile(asset.originalFilename));
      relationships.push({ type: REL_CLIENTSIDEASSET, target: zipName });
    }
    addEntry('ClientSideAssets.xml.rels', buildRelsXml(relationships, pretty));
  }

  for (const resx of resxFiles) {
    addEntry(resx.name, resx.buffer);
  }

  const appManifestRelationships: Relationship[] = features.map((feature) => ({
    type: REL_MANIFEST_FEATURE,
    target: `feature_${feature.id}.xml`
  }));
  if (assetsFeature) {
    appManifestRelationships.push({ type: REL_MANIFEST_CLIENTSIDEASSET, target: 'ClientSideAssets.xml' });
  }
  for (const resx of resxFiles) {
    appManifestRelationships.push({
      type: resx.name === 'Resources.resx' ? REL_CONTENT_DEFAULT_RESOURCE : REL_CONTENT_RESOURCE,
      target: resx.name
    });
  }

  const appManifest = buildAppManifestXml({
    name: String(solution.name),
    productId: String(solution.id),
    version: typeof solution.version === 'string' && solution.version ? solution.version : undefined,
    skipFeatureDeployment: solution.skipFeatureDeployment === true,
    isDomainIsolated: solution.isDomainIsolated === true,
    developer: isRecord(solution.developer) ? solution.developer : undefined,
    metadata: isRecord(solution.metadata) ? solution.metadata : undefined,
    localizedStrings:
      resxFiles.length > 0 ? resxFiles.map((resx) => ({ locale: resx.locale, values: resx.values })) : undefined,
    webApiPermissionRequests: isWebApiPermissionRequests(solution.webApiPermissionRequests),
    pretty
  });

  const extensions = new Set<string>();
  for (const name of allEntryNames) {
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex < 0) {
      continue;
    }
    const extension = name.slice(dotIndex + 1).toLowerCase();
    if (extension && extension !== 'xml' && extension !== 'rels') {
      extensions.add(extension);
    }
  }

  const orderedEntries: ZipFileEntry[] = [
    { name: '[Content_Types].xml', buffer: Buffer.from(buildContentTypesXml([...extensions].sort(), pretty), 'utf8') },
    { name: '_rels/.rels', buffer: Buffer.from(buildRelsXml([{ type: REL_PACKAGE_MANIFEST, target: 'AppManifest.xml' }], pretty), 'utf8') },
    { name: 'AppManifest.xml', buffer: Buffer.from(appManifest, 'utf8') },
    { name: 'AppManifest.xml.rels', buffer: Buffer.from(buildRelsXml(appManifestRelationships, pretty), 'utf8') },
    ...entries
  ];

  const outputPath = opts.outDir
    ? path.join(path.resolve(projectRoot, opts.outDir), path.basename(zippedPackage))
    : path.resolve(projectRoot, zippedPackage);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeZip(outputPath, orderedEntries);

  const debugDir = path.join(path.dirname(outputPath), 'debug', path.basename(outputPath, path.extname(outputPath)));
  for (const entry of orderedEntries) {
    const target = path.join(debugDir, ...entry.name.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, entry.buffer);
  }

  return { outputPath, zipEntries: orderedEntries.map((entry) => entry.name), appManifest };
}

async function loadSolutionConfig(
  projectRoot: string,
  solutionConfigPath: string
): Promise<{ solution: Record<string, unknown>; zippedPackage: string }> {
  const configPath = path.resolve(projectRoot, solutionConfigPath);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(configPath, 'utf8'));
  } catch (error) {
    throw new RspfxError(
      'InvalidPackageConfig',
      `Unable to read or parse solution configuration at '${configPath}' (${error instanceof Error ? error.message : String(error)})`,
      error
    );
  }
  const config = raw as PackageConfig;
  if (!isRecord(config.solution)) {
    throw new RspfxError('InvalidPackageConfig', `'${configPath}' must contain a 'solution' object`);
  }
  const solution = config.solution;
  const zippedPackage =
    isRecord(config.paths) && typeof config.paths.zippedPackage === 'string' && config.paths.zippedPackage.trim()
      ? config.paths.zippedPackage
      : undefined;
  if (!zippedPackage) {
    throw new RspfxError('InvalidPackageConfig', `'paths.zippedPackage' must be a non-empty string in '${configPath}'`);
  }
  if (typeof solution.id !== 'string' || solution.id.trim() === '') {
    throw new RspfxError('InvalidPackageConfig', `'solution.id' must be a non-empty string in '${configPath}'`);
  }
  if (typeof solution.name !== 'string' || solution.name.trim() === '') {
    throw new RspfxError('InvalidPackageConfig', `'solution.name' must be a non-empty string in '${configPath}'`);
  }
  return { solution, zippedPackage };
}

async function loadManifests(manifestsDir: string): Promise<ComponentManifest[]> {
  const files = await globFiles(manifestsDir, ['**/*.manifest.json']);
  if (files.length === 0) {
    throw new RspfxError('NoManifestsFound', `No component manifests (*.manifest.json) found in '${manifestsDir}'`);
  }
  const byId = new Map<string, ComponentManifest>();
  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(path.join(manifestsDir, file), 'utf8'));
    } catch (error) {
      throw new RspfxError(
        'InvalidManifestJson',
        `Failed to parse component manifest '${file}': ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
    const manifest = parsed as ComponentManifest;
    if (typeof manifest.id !== 'string' || manifest.id.trim() === '') {
      throw new RspfxError('InvalidManifestId', `Component manifest '${file}' is missing a valid 'id'`);
    }
    if (byId.has(manifest.id)) {
      throw new RspfxError('DuplicateManifestId', `Multiple component manifests use the same id '${manifest.id}'`);
    }
    if (!isRecord(manifest.loaderConfig)) {
      manifest.loaderConfig = { internalModuleBaseUrls: [], entryModuleId: '', scriptResources: {} };
    } else {
      if (!Array.isArray(manifest.loaderConfig.internalModuleBaseUrls)) {
        manifest.loaderConfig.internalModuleBaseUrls = [];
      }
      if (typeof manifest.loaderConfig.entryModuleId !== 'string') {
        manifest.loaderConfig.entryModuleId = '';
      }
      if (!isRecord(manifest.loaderConfig.scriptResources)) {
        manifest.loaderConfig.scriptResources = {};
      }
    }
    byId.set(manifest.id, manifest);
  }
  return [...byId.values()];
}

function normalizeFeatures(solution: Record<string, unknown>, manifests: ComponentManifest[]): NormalizedFeature[] {
  const componentMap = new Map(manifests.map((manifest) => [manifest.id, manifest]));
  const configFeatures = Array.isArray(solution.features) ? (solution.features as FeatureDefinition[]) : [];

  if (configFeatures.length === 0) {
    const first = manifests[0];
    if (!first) {
      throw new RspfxError('NoManifestsFound', 'Cannot create a feature without any component manifests');
    }
    const name = typeof first.alias === 'string' && first.alias ? first.alias : first.id;
    const componentKind = (first.componentType ?? 'WebPart') === 'Extension' ? 'Extension' : 'WebPart';
    return [
      {
        title: `${name} Feature`,
        description: `A feature which activates the Client-Side ${componentKind} named '${name}'`,
        id: randomUUID(),
        version: '1.0.0.0',
        components: [...manifests],
        explicitComponentIds: false,
        assets: { elementManifests: [], elementFiles: [] }
      }
    ];
  }

  configFeatures.sort((a, b) => {
    const aHasComponentIds = Array.isArray(a.componentIds) && a.componentIds.length > 0;
    const bHasComponentIds = Array.isArray(b.componentIds) && b.componentIds.length > 0;
    if (aHasComponentIds === bHasComponentIds) {
      return 0;
    }
    return aHasComponentIds ? -1 : 1;
  });

  const usedIds = new Set<string>();
  const features: NormalizedFeature[] = [];

  for (const configFeature of configFeatures) {
    const explicitComponentIds = Array.isArray(configFeature.componentIds) && configFeature.componentIds.length > 0;
    const feature: NormalizedFeature = {
      title:
        typeof configFeature.title === 'string' && configFeature.title ? configFeature.title : 'Unnamed Feature',
      description: typeof configFeature.description === 'string' ? configFeature.description : '',
      id: typeof configFeature.id === 'string' && configFeature.id ? configFeature.id : randomUUID(),
      version: typeof configFeature.version === 'string' && configFeature.version ? configFeature.version : '1.0.0.0',
      components: [],
      explicitComponentIds,
      assets: {
        elementManifests: readStringArray(configFeature.assets?.elementManifests),
        elementFiles: readStringArray(configFeature.assets?.elementFiles)
      }
    };
    if (explicitComponentIds) {
      for (const componentId of configFeature.componentIds as string[]) {
        const component = componentMap.get(componentId);
        if (!component) {
          logger.warn(
            `Skipping component id '${componentId}' in feature '${feature.title}': no matching manifest`
          );
          continue;
        }
        feature.components.push(component);
        usedIds.add(componentId);
      }
    } else {
      feature.components = [...manifests];
      for (const manifest of manifests) {
        usedIds.add(manifest.id);
      }
    }
    features.push(feature);
  }

  const unassigned = manifests.filter((manifest) => !usedIds.has(manifest.id));
  if (unassigned.length > 0) {
    const featureWithoutComponentIds = features.find((feature) => !feature.explicitComponentIds);
    if (featureWithoutComponentIds) {
      featureWithoutComponentIds.components.push(...unassigned);
    } else {
      features.push({
        title: 'unnamed-feature-1',
        description: 'A feature which activates client-side components that are not assigned to any other feature.',
        id: randomUUID(),
        version: '1.0.0.0',
        components: [...unassigned],
        explicitComponentIds: true,
        assets: { elementManifests: [], elementFiles: [] }
      });
    }
  }

  return features;
}

async function collectClientSideAssets(assetsDir: string, teamsDir?: string): Promise<ClientSideAsset[]> {
  const assets: ClientSideAsset[] = [];
  for (const relativePath of await globFiles(assetsDir, ['**/*.*'])) {
    const basename = relativePath.slice(relativePath.lastIndexOf('/') + 1);
    if (basename.endsWith('.map') || basename.endsWith('.manifest.json')) {
      continue;
    }
    assets.push({ originalFilename: path.join(assetsDir, relativePath), packageFilename: relativePath });
  }
  if (teamsDir) {
    for (const relativePath of await globFiles(teamsDir, ['**/*.*'])) {
      assets.push({ originalFilename: path.join(teamsDir, relativePath), packageFilename: relativePath });
    }
  }
  return assets;
}

async function collectResx(resxDir: string): Promise<ResxFile[]> {
  const resxFiles: ResxFile[] = [];
  for (const relativePath of await globFiles(resxDir, ['Resources.resx', 'Resources.??-??.resx'])) {
    const content = await readFile(path.join(resxDir, relativePath));
    const locale =
      relativePath === 'Resources.resx'
        ? 'en-us'
        : relativePath.slice('Resources.'.length, -'.resx'.length).toLowerCase();
    resxFiles.push({ name: relativePath, buffer: content, locale, values: parseResx(content.toString('utf8')) });
  }
  resxFiles.sort((a, b) => {
    if (a.name === 'Resources.resx') {
      return -1;
    }
    if (b.name === 'Resources.resx') {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
  return resxFiles;
}

async function readProjectFile(projectRoot: string, relativePath: string, kind: string): Promise<Buffer> {
  const absolutePath = path.resolve(projectRoot, relativePath);
  try {
    return await readFile(absolutePath);
  } catch (error) {
    throw new RspfxError(
      'MissingElementAsset',
      `Failed to read ${kind} '${relativePath}' referenced by feature assets (${error instanceof Error ? error.message : String(error)})`,
      error
    );
  }
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWebApiPermissionRequests(value: unknown): { resource: string; scope: string }[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const requests: { resource: string; scope: string }[] = [];
  for (const entry of value) {
    if (isRecord(entry) && typeof entry.resource === 'string' && typeof entry.scope === 'string') {
      requests.push({ resource: entry.resource, scope: entry.scope });
    }
  }
  return requests.length > 0 ? requests : undefined;
}

function toZipPath(value: string): string {
  return value.replace(/\\/g, '/');
}
