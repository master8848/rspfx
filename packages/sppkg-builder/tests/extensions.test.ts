import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildElementsXml } from '../src/xml.js';
import { buildPackage } from '../src/index.js';
import { readZipEntries } from '../src/zip.js';

const fixtureRoot = fileURLToPath(new URL('./fixtures/proj', import.meta.url));
const webPartId = 'c8f3f8c8-2c9a-4f1e-9c3d-222222222222';
const extensionId = 'd1111111-2222-4333-8444-555555555555';

const extensionManifest = (extensionType: string) => ({
  id: extensionId,
  alias: 'RspfxTestExtension',
  componentType: 'Extension',
  extensionType,
  version: '1.0.0.0',
  manifestVersion: 2
});

const expectedXml = (extensionType: string) =>
  `<?xml version="1.0" encoding="utf-8"?>
<Elements xmlns="http://schemas.microsoft.com/sharepoint/">
  <ClientSideComponent Name="RspfxTestExtension" Id="${extensionId}" ComponentManifest='${JSON.stringify(extensionManifest(extensionType)).replace(/"/g, '&quot;')}' Type="Extension" ClientSideComponentProperties="null" Location="ClientSideExtension.${extensionType}">
    <ClientSideComponentInstance Id="__INSTANCE_ID__" Title="RspfxTestExtension" Description="RspfxTestExtension"/>
  </ClientSideComponent>
</Elements>`;

async function makeProject(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'rspfx-ext-'));
  await cp(fixtureRoot, dir, { recursive: true });
  return dir;
}

function buildOptions(projectRoot: string): Parameters<typeof buildPackage>[0] {
  return {
    projectRoot,
    solutionConfigPath: 'config/package-solution.json',
    manifestsDir: 'release/manifests',
    assetsDir: 'release/assets',
    outDir: 'sharepoint/solution',
    production: true
  };
}

describe('buildElementsXml (extensions)', () => {
  for (const extensionType of ['ApplicationCustomizer', 'FieldCustomizer', 'ListViewCommandSet', 'FormCustomizer']) {
    it(`emits the official elements XML for ${extensionType}`, () => {
      const xml = buildElementsXml('RspfxTestExtension', extensionManifest(extensionType), true);
      const instanceId = /ClientSideComponentInstance Id="([^"]+)"/.exec(xml)![1]!;
      expect(instanceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(xml).toBe(expectedXml(extensionType).replace('__INSTANCE_ID__', instanceId));
      expect(xml).not.toContain('<Module');
      expect(xml).toContain('ClientSideComponentProperties="null"');
      expect(xml).toContain(`Location="ClientSideExtension.${extensionType}"`);
    });
  }

  it('throws when an extension manifest is missing extensionType', () => {
    expect(() =>
      buildElementsXml('RspfxTestExtension', { id: extensionId, componentType: 'Extension' }, true)
    ).toThrow("missing an 'extensionType'");
  });

  it('keeps web part output byte-identical', () => {
    const manifest = {
      id: webPartId,
      alias: 'RspfxTestWebPart',
      componentType: 'WebPart',
      version: '1.0.0.0'
    };
    const xml = buildElementsXml('RspfxTestWebPart', manifest, true);
    expect(xml).toBe(
      `<?xml version="1.0" encoding="utf-8"?>
<Elements xmlns="http://schemas.microsoft.com/sharepoint/">
  <ClientSideComponent Name="RspfxTestWebPart" Id="${webPartId}" ComponentManifest='${JSON.stringify(manifest).replace(/"/g, '&quot;')}' Type="WebPart"/>
  <Module Name="RspfxTestWebPart" Url="_catalogs/wp" List="113"/>
</Elements>`
    );
  });
});

describe('buildPackage (extensions)', () => {
  it('packages a web part and an extension in the same feature', async () => {
    const projectRoot = await makeProject();
    try {
      await writeFile(
        path.join(projectRoot, `release/manifests/${extensionId}.manifest.json`),
        JSON.stringify(extensionManifest('ListViewCommandSet'), null, 2)
      );
      const configPath = path.join(projectRoot, 'config/package-solution.json');
      const config = JSON.parse(await readFile(configPath, 'utf8')) as {
        solution: { features: { componentIds: string[] }[] };
      };
      config.solution.features[0]!.componentIds.push(extensionId);
      await writeFile(configPath, JSON.stringify(config, null, 2));

      const result = await buildPackage(buildOptions(projectRoot));
      const zip = await readZipEntries(result.outputPath);
      const featureEntry = [...zip.keys()].find((name) => /^feature_[0-9a-fA-F-]{36}\.xml$/.test(name))!;
      const featureId = featureEntry.match(/^feature_([0-9a-fA-F-]{36})\.xml$/)![1]!;

      const webPartXml = zip.get(`${featureId}/WebPart_${webPartId}.xml`)!.toString('utf8');
      expect(webPartXml).toContain('Type="WebPart"');
      expect(webPartXml).toContain('<Module Name="RspfxTestWebPart" Url="_catalogs/wp" List="113"/>');

      const extensionXml = zip.get(`${featureId}/Extension_${extensionId}.xml`)!.toString('utf8');
      expect(extensionXml).toContain('Type="Extension"');
      expect(extensionXml).toContain('Location="ClientSideExtension.ListViewCommandSet"');
      expect(extensionXml).toContain('ClientSideComponentProperties="null"');
      expect(extensionXml).toContain('<ClientSideComponentInstance Id="');
      expect(extensionXml).not.toContain('<Module');

      const featureRels = zip.get(`_rels/feature_${featureId}.xml.rels`)!.toString('utf8');
      expect(featureRels).toContain(`Target="/${featureId}/WebPart_${webPartId}.xml"`);
      expect(featureRels).toContain(`Target="/${featureId}/Extension_${extensionId}.xml"`);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('describes an extension-only auto feature as a Client-Side Extension', async () => {
    const projectRoot = await makeProject();
    try {
      await rm(path.join(projectRoot, `release/manifests/${webPartId}.manifest.json`));
      await writeFile(
        path.join(projectRoot, `release/manifests/${extensionId}.manifest.json`),
        JSON.stringify(extensionManifest('ApplicationCustomizer'), null, 2)
      );
      const configPath = path.join(projectRoot, 'config/package-solution.json');
      const config = JSON.parse(await readFile(configPath, 'utf8')) as { solution: Record<string, unknown> };
      config.solution.features = [];
      await writeFile(configPath, JSON.stringify(config, null, 2));

      const result = await buildPackage(buildOptions(projectRoot));
      const zip = await readZipEntries(result.outputPath);
      const featureFiles = [...zip.keys()].filter((name) => /^feature_[0-9a-fA-F-]{36}\.xml$/.test(name));
      expect(featureFiles).toHaveLength(1);
      const featureXml = zip.get(featureFiles[0]!)!.toString('utf8');
      expect(featureXml).toContain(
        "A feature which activates the Client-Side Extension named &apos;RspfxTestExtension&apos;"
      );
      expect([...zip.keys()].some((name) => name.endsWith(`Extension_${extensionId}.xml`))).toBe(true);
      expect([...zip.keys()].some((name) => name.includes('WebPart_'))).toBe(false);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
