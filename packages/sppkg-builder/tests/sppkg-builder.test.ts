import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildPackage, validateSppkg, type BuildPackageOptions } from '../src/index.js';
import { readZipEntries } from '../src/zip.js';

const fixtureRoot = fileURLToPath(new URL('./fixtures/proj', import.meta.url));
const solutionId = 'e2b3f8c8-2c9a-4f1e-9c3d-000000000001';
const featureId = 'b6f3f8c8-2c9a-4f1e-9c3d-111111111111';
const componentId = 'c8f3f8c8-2c9a-4f1e-9c3d-222222222222';

interface ProjectVariant {
  includeClientSideAssets?: boolean;
  features?: unknown;
}

async function makeProject(variant?: ProjectVariant): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'rspfx-sppkg-'));
  await cp(fixtureRoot, dir, { recursive: true });
  if (variant) {
    const configPath = path.join(dir, 'config/package-solution.json');
    const config = JSON.parse(await readFile(configPath, 'utf8')) as { solution: Record<string, unknown> };
    if (variant.includeClientSideAssets !== undefined) {
      config.solution.includeClientSideAssets = variant.includeClientSideAssets;
    }
    if (variant.features !== undefined) {
      config.solution.features = variant.features;
    }
    await writeFile(configPath, JSON.stringify(config, null, 2));
  }
  return dir;
}

function buildOptions(projectRoot: string, overrides: Partial<BuildPackageOptions> = {}): BuildPackageOptions {
  return {
    projectRoot,
    solutionConfigPath: 'config/package-solution.json',
    manifestsDir: 'release/manifests',
    assetsDir: 'release/assets',
    outDir: 'sharepoint/solution',
    production: true,
    ...overrides
  };
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function extractComponentManifest(xml: string): string {
  const match = /ComponentManifest='([^']*)'/.exec(xml);
  if (!match) {
    throw new Error('ComponentManifest attribute not found');
  }
  return decodeXmlEntities(match[1]!);
}

describe('buildPackage', () => {
  it('builds a production package with client-side assets', async () => {
    const projectRoot = await makeProject();
    try {
      const result = await buildPackage(buildOptions(projectRoot));
      expect(existsSync(result.outputPath)).toBe(true);
      expect(path.basename(result.outputPath)).toBe('rspfx-test.sppkg');
      expect(result.zipEntries[0]).toBe('[Content_Types].xml');

      const zip = await readZipEntries(result.outputPath);
      const names = [...zip.keys()].sort();
      expect(names).toEqual(
        [
          '[Content_Types].xml',
          '_rels/.rels',
          'AppManifest.xml',
          '_rels/AppManifest.xml.rels',
          `feature_${featureId}.xml`,
          `feature_${featureId}.xml.config.xml`,
          `_rels/feature_${featureId}.xml.rels`,
          `${featureId}/WebPart_${componentId}.xml`,
          'ClientSideAssets.xml',
          'ClientSideAssets.xml.config.xml',
          '_rels/ClientSideAssets.xml.rels',
          'ClientSideAssets/hello.js'
        ].sort()
      );
      expect(names.some((name) => name.endsWith('.map'))).toBe(false);
      expect(names.some((name) => name.endsWith('.manifest.json'))).toBe(false);

      const helloContent = await readFile(path.join(projectRoot, 'release/assets/hello.js'));
      expect(zip.get('ClientSideAssets/hello.js')).toEqual(helloContent);

      expect(result.appManifest).toContain('IsClientSideSolution="true"');
      expect(result.appManifest).toContain(`ProductID="{${solutionId}}"`);
      expect(result.appManifest).toContain('SkipFeatureDeployment="true"');
      expect(result.appManifest).toContain('Name="rspfx-test-solution"');
      expect(result.appManifest).toContain('<Title>rspfx-test-solution</Title>');

      const webPartXml = zip.get(`${featureId}/WebPart_${componentId}.xml`)!.toString('utf8');
      expect(webPartXml).toContain('Type="WebPart"');
      expect(webPartXml).toContain('<Module Name="RspfxTestWebPart" Url="_catalogs/wp" List="113"/>');
      const manifestJson = JSON.parse(extractComponentManifest(webPartXml)) as {
        loaderConfig: { internalModuleBaseUrls: string[] };
      };
      expect(manifestJson.loaderConfig.internalModuleBaseUrls).toEqual(['HTTPS://SPCLIENTSIDEASSETLIBRARY/']);

      const original = JSON.parse(
        await readFile(path.join(projectRoot, `release/manifests/${componentId}.manifest.json`), 'utf8')
      ) as { loaderConfig: { internalModuleBaseUrls: string[] } };
      const expected = {
        ...original,
        loaderConfig: { ...original.loaderConfig, internalModuleBaseUrls: ['HTTPS://SPCLIENTSIDEASSETLIBRARY/'] }
      };
      expect(JSON.parse(extractComponentManifest(webPartXml))).toEqual(expected);

      const featureXml = zip.get(`feature_${featureId}.xml`)!.toString('utf8');
      expect(featureXml).toContain(`Id="${featureId}"`);
      expect(featureXml).toContain('Scope="Web"');
      expect(featureXml).toContain('Hidden="FALSE"');

      const featureRels = zip.get(`_rels/feature_${featureId}.xml.rels`)!.toString('utf8');
      expect(featureRels).toContain(
        'Type="http://schemas.microsoft.com/sharepoint/2016/03/features/clientsideasset"'
      );
      expect(featureRels).toContain('Target="/ClientSideAssets.xml"');

      const configXml = zip.get(`feature_${featureId}.xml.config.xml`)!.toString('utf8');
      expect(configXml).toContain(`<Id>${featureId}</Id>`);

      expect(zip.get('ClientSideAssets.xml')!.toString('utf8')).toContain('Client Side Assets');

      const validation = await validateSppkg(result.outputPath);
      expect(validation).toEqual({ ok: true, errors: [] });

      const debugDir = path.join(projectRoot, 'sharepoint/solution/debug/rspfx-test');
      expect(existsSync(path.join(debugDir, 'AppManifest.xml'))).toBe(true);
      expect(existsSync(path.join(debugDir, 'ClientSideAssets/hello.js'))).toBe(true);
      expect(existsSync(path.join(debugDir, `${featureId}/WebPart_${componentId}.xml`))).toBe(true);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('omits client-side assets when includeClientSideAssets is false', async () => {
    const projectRoot = await makeProject({ includeClientSideAssets: false });
    try {
      const result = await buildPackage(buildOptions(projectRoot));
      const zip = await readZipEntries(result.outputPath);
      const names = [...zip.keys()];
      expect(names.some((name) => name.startsWith('ClientSideAssets'))).toBe(false);
      expect(names).toContain(`${featureId}/WebPart_${componentId}.xml`);
      const featureRels = zip.get(`_rels/feature_${featureId}.xml.rels`)!.toString('utf8');
      expect(featureRels).not.toContain('clientsideasset');
      const webPartXml = zip.get(`${featureId}/WebPart_${componentId}.xml`)!.toString('utf8');
      const manifestJson = JSON.parse(extractComponentManifest(webPartXml)) as {
        loaderConfig: { internalModuleBaseUrls: string[] };
      };
      expect(manifestJson.loaderConfig.internalModuleBaseUrls).toEqual(['https://cdn.example.com/dist/']);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('creates an auto feature when the solution has no features', async () => {
    const projectRoot = await makeProject({ features: [] });
    try {
      const result = await buildPackage(buildOptions(projectRoot));
      const zip = await readZipEntries(result.outputPath);
      const names = [...zip.keys()];
      const featureFiles = names.filter((name) => /^feature_[0-9a-fA-F-]{36}\.xml$/.test(name));
      expect(featureFiles).toHaveLength(1);
      const autoFeatureId = featureFiles[0]!.match(/^feature_([0-9a-fA-F-]{36})\.xml$/)![1]!;
      expect(names).toContain(`${autoFeatureId}/WebPart_${componentId}.xml`);
      const featureXml = zip.get(featureFiles[0]!)!.toString('utf8');
      expect(featureXml).toContain('Title="RspfxTestWebPart Feature"');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('applies compact XML when prettyXml is false', async () => {
    const projectRoot = await makeProject();
    try {
      const result = await buildPackage(buildOptions(projectRoot, { prettyXml: false }));
      const lines = result.appManifest.split('\n');
      expect(lines[0]).toBe('<?xml version="1.0" encoding="utf-8"?>');
      expect(lines).toHaveLength(2);
      expect(result.appManifest).toContain('<App ');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('rejects a config missing solution.id', async () => {
    const projectRoot = await makeProject();
    try {
      const configPath = path.join(projectRoot, 'config/package-solution.json');
      const config = JSON.parse(await readFile(configPath, 'utf8')) as { solution: Record<string, unknown> };
      delete config.solution.id;
      await writeFile(configPath, JSON.stringify(config, null, 2));
      let error: unknown;
      try {
        await buildPackage(buildOptions(projectRoot));
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('solution.id');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('throws when no component manifests are found', async () => {
    const projectRoot = await makeProject();
    try {
      await rm(path.join(projectRoot, 'release/manifests'), { recursive: true, force: true });
      await mkdir(path.join(projectRoot, 'release/manifests'), { recursive: true });
      await expect(buildPackage(buildOptions(projectRoot))).rejects.toThrow('No component manifests');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});

describe('validateSppkg', () => {
  it('rejects a corrupted zip file', async () => {
    const projectRoot = await makeProject();
    try {
      const result = await buildPackage(buildOptions(projectRoot));
      const buffer = await readFile(result.outputPath);
      expect(buffer.readUInt32LE(0)).toBe(0x04034b50);
      const nameLength = buffer.readUInt16LE(26);
      const extraLength = buffer.readUInt16LE(28);
      const dataStart = 30 + nameLength + extraLength;
      buffer[dataStart] = (buffer[dataStart] ?? 0) ^ 0xff;
      const corruptPath = path.join(projectRoot, 'sharepoint/solution/corrupt.sppkg');
      await writeFile(corruptPath, buffer);
      const validation = await validateSppkg(corruptPath);
      expect(validation.ok).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('rejects a file that is not a zip', async () => {
    const projectRoot = await makeProject();
    try {
      const notAZip = path.join(projectRoot, 'not-a-zip.sppkg');
      await writeFile(notAZip, 'this is not a zip file');
      const validation = await validateSppkg(notAZip);
      expect(validation.ok).toBe(false);
      expect(validation.errors.join(' ').toLowerCase()).toContain('zip');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
