import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildPackage } from '../src/index.js';
import { readZipEntries } from '../src/zip.js';

const fixtureRoot = fileURLToPath(new URL('./fixtures/proj', import.meta.url));
const featureId = 'b6f3f8c8-2c9a-4f1e-9c3d-111111111111';
const componentId = 'c8f3f8c8-2c9a-4f1e-9c3d-222222222222';

describe('official parity', () => {
  it('locks official heft parity (regression for catalog IsValidAppPackage:true)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'rspfx-official-parity-'));
    await cp(fixtureRoot, dir, { recursive: true });

    // Ensure AppManifest contains <Screenshots> like official heft output (playground has screenshotPaths: [])
    // Fixture lacks screenshotPaths, so inject empty array to lock Screenshots element parity.
    const configPath = path.join(dir, 'config/package-solution.json');
    const config = JSON.parse(await readFile(configPath, 'utf8')) as {
      solution: Record<string, unknown>;
      paths: unknown;
    };
    const solution = config.solution as Record<string, unknown>;
    const metadata = (solution.metadata as Record<string, unknown> | undefined) ?? {};
    if (!Array.isArray(metadata.screenshotPaths)) {
      metadata.screenshotPaths = [];
      solution.metadata = metadata;
      await writeFile(configPath, JSON.stringify(config, null, 2));
    }
    const rawSolutionId = String(solution.id);

    const result = await buildPackage({
      projectRoot: dir,
      solutionConfigPath: 'config/package-solution.json',
      manifestsDir: 'release/manifests',
      assetsDir: 'release/assets',
      outDir: 'sharepoint/solution',
      production: true
    });

    try {
      const appManifest: string = result.appManifest;

      // AppManifest: ProductID without braces, raw GUID, IsDomainIsolated false
      expect(appManifest).toContain(`ProductID="${rawSolutionId}"`);
      // ProductID must be raw GUID without braces (official uses ProductID without braces)
      expect(appManifest).not.toContain(`ProductID="{${rawSolutionId}}"`);
      expect(appManifest).not.toContain('ProductID="{');
      expect(appManifest).toContain('IsDomainIsolated="false"');
      expect(appManifest).toContain('DeveloperProperties');
      expect(appManifest).toContain('&quot;name&quot;');
      expect(appManifest).toContain('mpnId');
      expect(appManifest).toContain('<Screenshots');
      expect(appManifest).not.toContain('LCID=');
      // CultureName when localized (fixture has default locale => CultureName="default")
      expect(appManifest).toContain('CultureName');
      expect(appManifest).toContain('<Title>');
      // CategoryID comma-joined (fixture has single category)
      expect(appManifest).toContain('CategoryID');

      const zip = await readZipEntries(result.outputPath);

      // AppPartConfig: Id is randomUUID v4 not featureId
      const appPartConfig = zip.get(`feature_${featureId}.xml.config.xml`)!.toString('utf8');
      const idMatch = /<Id>([^<]+)<\/Id>/.exec(appPartConfig);
      expect(idMatch).not.toBeNull();
      const appPartId = idMatch![1]!;
      expect(appPartId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(appPartId).not.toBe(featureId);

      // [Content_Types].xml ordered: 13 defaults xml→...→gif; txt only when .txt asset exists (blackbox parity)
      const contentTypes = zip.get('[Content_Types].xml')!.toString('utf8');
      expect(contentTypes).toContain('Extension="xml" ContentType="text/xml"');
      expect(contentTypes).toContain('Extension="gif" ContentType="image/gif"');
      // No .txt asset in fixture → txt must NOT be emitted (official: 13 defaults, txt conditional)
      expect(contentTypes).not.toContain('Extension="txt"');
      // Check ordering of defaults
      const xmlIdx = contentTypes.indexOf('Extension="xml"');
      const relsIdx = contentTypes.indexOf('Extension="rels"');
      const webpartIdx = contentTypes.indexOf('Extension="webpart"');
      const jsIdx = contentTypes.indexOf('Extension="js"');
      const pngIdx = contentTypes.indexOf('Extension="png"');
      const gifIdx = contentTypes.indexOf('Extension="gif"');
      expect(xmlIdx).toBeGreaterThan(-1);
      expect(relsIdx).toBeGreaterThan(-1);
      expect(webpartIdx).toBeGreaterThan(-1);
      expect(jsIdx).toBeGreaterThan(-1);
      expect(pngIdx).toBeGreaterThan(-1);
      expect(gifIdx).toBeGreaterThan(-1);
      expect(xmlIdx).toBeLessThan(relsIdx);
      expect(relsIdx).toBeLessThan(webpartIdx);
      expect(webpartIdx).toBeLessThan(jsIdx);
      expect(jsIdx).toBeLessThan(pngIdx);
      expect(pngIdx).toBeLessThan(gifIdx);

      // relationships all Targets prefixed "/" and stored at _rels/*.rels
      const relsRoot = zip.get('_rels/.rels')!.toString('utf8');
      expect(relsRoot).toContain('Target="/AppManifest.xml"');

      const appManifestRels = zip.get('_rels/AppManifest.xml.rels')!.toString('utf8');
      expect(appManifestRels).toContain('Target="/feature_');
      expect(appManifestRels).toContain('Target="/ClientSideAssets.xml"');

      const featureRels = zip.get(`_rels/feature_${featureId}.xml.rels`)!.toString('utf8');
      expect(featureRels).toContain(`Target="/feature_${featureId}.xml.config.xml"`);
      expect(featureRels).toContain(`Target="/${featureId}/WebPart_${componentId}.xml"`);
      expect(featureRels.toLowerCase()).not.toContain('clientsideasset');

      const clientSideRels = zip.get('_rels/ClientSideAssets.xml.rels')!.toString('utf8');
      expect(clientSideRels).toContain('Target="/ClientSideAssets/');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
