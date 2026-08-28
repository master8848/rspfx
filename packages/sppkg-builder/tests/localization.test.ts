import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { localeToLcid } from '../src/lcid.js';
import { parseResx } from '../src/resx.js';
import { buildAppManifestXml } from '../src/xml.js';
import { buildPackage } from '../src/index.js';
import { readZipEntries } from '../src/zip.js';

const fixtureRoot = fileURLToPath(new URL('./fixtures/proj', import.meta.url));
const resxFixtureRoot = fileURLToPath(new URL('./fixtures/resx', import.meta.url));
const teamsFixtureRoot = fileURLToPath(new URL('./fixtures/teams', import.meta.url));
const solutionId = 'e2b3f8c8-2c9a-4f1e-9c3d-000000000001';

async function makeProject(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'rspfx-resx-'));
  await cp(fixtureRoot, dir, { recursive: true });
  return dir;
}

function buildOptions(projectRoot: string, overrides: Record<string, unknown> = {}): Parameters<typeof buildPackage>[0] {
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

describe('parseResx', () => {
  it('parses data entries and decodes XML entities', () => {
    const content = `<?xml version="1.0" encoding="utf-8"?>
<root>
  <data name="WithEntities" xml:space="preserve">
    <value>A &amp; B &lt; C &gt; D &apos; E &quot; F</value>
  </data>
  <data name="Plain">
    <value>Just text</value>
  </data>
</root>`;
    expect(parseResx(content)).toEqual({
      WithEntities: `A & B < C > D ' E " F`,
      Plain: 'Just text'
    });
  });

  it('leaves unknown entities as literal text', () => {
    const content = '<root><data name="K"><value>Pr&eacute;sent</value></data></root>';
    expect(parseResx(content)).toEqual({ K: 'Pr&eacute;sent' });
  });

  it('ignores non-data elements', () => {
    const content = '<root><resheader name="resmimetype"><value>text/microsoft-resx</value></resheader></root>';
    expect(parseResx(content)).toEqual({});
  });
});

describe('localeToLcid', () => {
  it('maps common locales and falls back to 1033', () => {
    expect(localeToLcid('en-us')).toBe(1033);
    expect(localeToLcid('fr-fr')).toBe(1036);
    expect(localeToLcid('de-de')).toBe(1031);
    expect(localeToLcid('zh-cn')).toBe(2052);
    expect(localeToLcid('FR-FR')).toBe(1036);
    expect(localeToLcid('xx-zz')).toBe(1033);
  });
});

describe('buildAppManifestXml ($Resources: resolution)', () => {
  const baseOptions = {
    name: 'rspfx-test-solution',
    productId: solutionId,
    skipFeatureDeployment: true,
    isDomainIsolated: false,
    pretty: true
  };

  const localizedStrings = [
    {
      locale: 'en-us',
      values: { SolutionTitle: 'RSPFx test solution', Description: "A test with & entities <like> 'those' \"quotes\"" }
    },
    { locale: 'fr-fr', values: { SolutionTitle: 'Solution de test RSPFx', Description: 'Une solution de test' } }
  ];

  it('resolves $Resources: keys into one LocalizedString per locale', () => {
    const xml = buildAppManifestXml({
      ...baseOptions,
      metadata: { shortDescription: '$Resources:SolutionTitle', longDescription: '$Resources:Description' },
      localizedStrings
    });
    expect(xml).toContain(
      `    <ShortDescription>\n` +
        `      <LocalizedString CultureName="en-US">RSPFx test solution</LocalizedString>\n` +
        `      <LocalizedString CultureName="fr-FR">Solution de test RSPFx</LocalizedString>\n` +
        `    </ShortDescription>`
    );
    expect(xml).toContain(
      `    <LongDescription>\n` +
        `      <LocalizedString CultureName="en-US">A test with &amp; entities &lt;like&gt; &apos;those&apos; &quot;quotes&quot;</LocalizedString>\n` +
        `      <LocalizedString CultureName="fr-FR">Une solution de test</LocalizedString>\n` +
        `    </LongDescription>`
    );
  });

  it('omits locales that do not contain the key', () => {
    const xml = buildAppManifestXml({
      ...baseOptions,
      metadata: { shortDescription: '$Resources:MissingInFr' },
      localizedStrings: [
        { locale: 'en-us', values: { MissingInFr: 'default text' } },
        { locale: 'fr-fr', values: {} }
      ]
    });
    expect(xml).toContain('<LocalizedString CultureName="en-US">default text</LocalizedString>');
    expect(xml).not.toContain('CultureName="fr-FR"');
  });

  it('falls back to the literal string when the key is missing everywhere', () => {
    const xml = buildAppManifestXml({
      ...baseOptions,
      metadata: { shortDescription: '$Resources:DoesNotExist' },
      localizedStrings
    });
    expect(xml).toContain('<ShortDescription>$Resources:DoesNotExist</ShortDescription>');
    expect(xml).not.toContain('LocalizedString');
  });

  it('falls back to the literal string when no resx files were collected', () => {
    const xml = buildAppManifestXml({
      ...baseOptions,
      metadata: { shortDescription: '$Resources:SolutionTitle' }
    });
    expect(xml).toContain('<ShortDescription>$Resources:SolutionTitle</ShortDescription>');
  });

  it('keeps { default } objects and plain values as before', () => {
    const xml = buildAppManifestXml({
      ...baseOptions,
      metadata: { shortDescription: { default: 'RSPFx test solution' }, longDescription: 'plain string' },
      localizedStrings
    });
    expect(xml).toContain('<LocalizedString CultureName="default">RSPFx test solution</LocalizedString>');
    expect(xml).not.toContain('LongDescription');
  });
});

describe('buildPackage (resx + teams)', () => {
  it('embeds resx files at the zip root with content-resource relationships and localized metadata', async () => {
    const projectRoot = await makeProject();
    try {
      await cp(resxFixtureRoot, path.join(projectRoot, 'sharepoint'), { recursive: true });
      const configPath = path.join(projectRoot, 'config/package-solution.json');
      const config = JSON.parse(await readFile(configPath, 'utf8')) as { solution: Record<string, unknown> };
      config.solution.metadata = {
        shortDescription: '$Resources:SolutionTitle',
        longDescription: '$Resources:SolutionDescription'
      };
      await writeFile(configPath, JSON.stringify(config, null, 2));

      const result = await buildPackage(buildOptions(projectRoot, { resxDir: 'sharepoint' }));
      const zip = await readZipEntries(result.outputPath);

      expect(zip.get('Resources.resx')).toEqual(await readFile(path.join(resxFixtureRoot, 'Resources.resx')));
      expect(zip.get('Resources.fr-fr.resx')).toEqual(await readFile(path.join(resxFixtureRoot, 'Resources.fr-fr.resx')));

      const rels = zip.get('_rels/AppManifest.xml.rels')!.toString('utf8');
      expect(rels).toContain(
        'Type="http://schemas.microsoft.com/sharepoint/2012/app/relationships/content-defaultresource" Target="/Resources.resx"'
      );
      expect(rels).toContain(
        'Type="http://schemas.microsoft.com/sharepoint/2012/app/relationships/content-resource" Target="/Resources.fr-fr.resx"'
      );

      const appManifest = result.appManifest;
      expect(appManifest).toContain(
        `    <ShortDescription>\n` +
          `      <LocalizedString CultureName="default">RSPFx test solution</LocalizedString>\n` +
          `      <LocalizedString CultureName="fr-FR">Solution de test RSPFx</LocalizedString>\n` +
          `    </ShortDescription>`
      );
      expect(appManifest).toContain(
        `      <LocalizedString CultureName="default">A test solution with &amp; entities &lt;like&gt; &apos;these&apos; &quot;quotes&quot;</LocalizedString>`
      );
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('emits literal $Resources: strings when resxDir is not provided', async () => {
    const projectRoot = await makeProject();
    try {
      const configPath = path.join(projectRoot, 'config/package-solution.json');
      const config = JSON.parse(await readFile(configPath, 'utf8')) as { solution: Record<string, unknown> };
      config.solution.metadata = { shortDescription: '$Resources:SolutionTitle' };
      await writeFile(configPath, JSON.stringify(config, null, 2));

      const result = await buildPackage(buildOptions(projectRoot));
      expect(result.appManifest).toContain('<ShortDescription>$Resources:SolutionTitle</ShortDescription>');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('collects teams folder files under ClientSideAssets/', async () => {
    const projectRoot = await makeProject();
    try {
      await cp(teamsFixtureRoot, path.join(projectRoot, 'teams'), { recursive: true });

      const result = await buildPackage(buildOptions(projectRoot, { teamsDir: 'teams' }));
      const zip = await readZipEntries(result.outputPath);

      expect(zip.get('ClientSideAssets/manifest.json')).toEqual(await readFile(path.join(teamsFixtureRoot, 'manifest.json')));
      expect(zip.get('ClientSideAssets/color.png')).toEqual(await readFile(path.join(teamsFixtureRoot, 'color.png')));
      expect(zip.get('ClientSideAssets/outline.png')).toEqual(
        await readFile(path.join(teamsFixtureRoot, 'outline.png'))
      );
      const rels = zip.get('_rels/ClientSideAssets.xml.rels')!.toString('utf8');
      expect(rels).toContain('Target="/ClientSideAssets/manifest.json"');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
