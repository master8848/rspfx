import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scaffoldProject } from '@mbsks/rspfx-templates';
import { validateSppkg } from '@mbsks/rspfx-sppkg-builder';
import { runBuild } from '../src/commands/build.js';
import { runPackage } from '../src/commands/package.js';
import { baseVars, linkPluginPackage, makeTmpDir, rmRf } from './helpers.js';

const COMPONENT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

async function makeFixture(): Promise<string> {
  const dir = makeTmpDir('build');
  await scaffoldProject(baseVars(), dir);
  linkPluginPackage(dir);
  fs.writeFileSync(
    path.join(dir, 'src', 'webparts', 'hello', 'helloWebPart.ts'),
    `export default class HelloWebPart {
  public render(): void {
    document.title = 'hello';
  }
}
`
  );
  return dir;
}

describe('build', () => {
  it('compiles an AMD bundle, emits release manifests and copies assets', async () => {
    const dir = await makeFixture();
    const output = await runBuild(dir, {});

    expect(output.outputFiles).toContain('hello.js');

    const bundlePath = path.join(dir, 'dist', 'hello.js');
    expect(fs.existsSync(bundlePath)).toBe(true);
    const content = fs.readFileSync(bundlePath, 'utf8');
    expect(content).toContain('define(');
    expect(content).toContain(`${COMPONENT_ID}_1.0.0`);

    const manifestPath = path.join(dir, 'release', 'manifests', `${COMPONENT_ID}.manifest.json`);
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      id: string;
      loaderConfig: { internalModuleBaseUrls: string[]; entryModuleId: string; scriptResources: Record<string, unknown> };
    };
    expect(manifest.id).toBe(COMPONENT_ID);
    expect(manifest.loaderConfig.entryModuleId).toBe('hello');
    expect(manifest.loaderConfig.internalModuleBaseUrls).toEqual([]);
    expect(manifest.loaderConfig.scriptResources).toEqual({
      hello: { type: 'path', path: 'hello.js' },
      HelloWebPartStrings: {
        type: 'localizedPath',
        paths: {
          default: { path: 'HelloWebPartStrings_en-us.js', integrity: '' },
          'en-us': { path: 'HelloWebPartStrings_en-us.js', integrity: '' },
          'fr-fr': { path: 'HelloWebPartStrings_fr-fr.js', integrity: '' }
        }
      }
    });

    expect(fs.existsSync(path.join(dir, 'dist', `${COMPONENT_ID}.manifest.json`))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'release', 'assets', 'hello.js'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'release', 'assets', 'hello.js.map'))).toBe(false);
    rmRf(dir);
  });

  it('honors a custom project layout configured via paths', async () => {
    const dir = await makeFixture();
    fs.writeFileSync(
      path.join(dir, 'rspack.config.ts'),
      [
        "import { RspfxPlugin } from '@mbsks/rspfx-plugin';",
        'export default {',
        '  plugins: [new RspfxPlugin({',
        "    name: 'hello',",
        "    framework: 'vanilla',",
        "    spfxVersion: '1.22',",
        '    fluent: false,',
        "    language: 'typescript',",
        "    paths: { srcDir: 'src', webpartsDir: 'components/widgets', configDir: 'config-custom' },",
        "    dev: { port: 4321, https: true, hostname: 'localhost', workbench: true, openBrowser: false },",
        "    build: { sourcemap: false, minify: true, splitChunks: false, outDir: 'dist', releaseDir: 'release' }",
        '  })]',
        '};'
      ].join('\n')
    );
    const widgetDir = path.join(dir, 'components', 'widgets', 'widget');
    fs.mkdirSync(widgetDir, { recursive: true });
    fs.mkdirSync(path.join(dir, 'config-custom'), { recursive: true });
    fs.writeFileSync(
      path.join(widgetDir, 'widget.manifest.json'),
      JSON.stringify({
        $schema: 'https://developer.microsoft.com/json-schemas/spfx/client-side-web-part-manifest.schema.json',
        id: COMPONENT_ID,
        alias: 'WidgetWebPart',
        componentType: 'WebPart',
        version: '1.0.0',
        manifestVersion: 2,
        preconfiguredEntries: [{ title: { default: 'Widget' }, properties: {} }]
      }, null, 2)
    );
    fs.writeFileSync(
      path.join(widgetDir, 'widgetWebPart.ts'),
      `export default class WidgetWebPart {\n  public render(): void {\n    document.title = 'widget';\n  }\n}\n`
    );
    fs.writeFileSync(
      path.join(dir, 'config-custom', 'config.json'),
      JSON.stringify({
        bundles: {
          'widget-bundle': {
            components: [
              {
                entrypoint: './components/widgets/widget/widgetWebPart.ts',
                manifest: './components/widgets/widget/widget.manifest.json'
              }
            ]
          }
        }
      }, null, 2)
    );

    const output = await runBuild(dir, {});
    expect(output.outputFiles).toContain('widget-bundle.js');

    const manifest = JSON.parse(
      fs.readFileSync(path.join(dir, 'release', 'manifests', `${COMPONENT_ID}.manifest.json`), 'utf8')
    ) as {
      loaderConfig: { entryModuleId: string; scriptResources: Record<string, unknown> };
    };
    expect(manifest.loaderConfig.entryModuleId).toBe('widget-bundle');
    expect(manifest.loaderConfig.scriptResources).toEqual({
      'widget-bundle': { type: 'path', path: 'widget-bundle.js' }
    });
    rmRf(dir);
  });
});

describe('package', () => {
  it('packages a valid .sppkg with release manifests and assets', async () => {
    const dir = await makeFixture();
    await runBuild(dir, {});
    const result = await runPackage(dir, { build: false });

    expect(path.basename(result.outputPath)).toBe('hello.sppkg');
    expect(fs.existsSync(result.outputPath)).toBe(true);
    expect(result.zipEntries).toContain('AppManifest.xml');
    expect(result.zipEntries.some((entry) => /^feature_[0-9a-f-]+\.xml$/.test(entry))).toBe(true);
    expect(result.zipEntries).toContain('ClientSideAssets/hello.js');

    const validation = await validateSppkg(result.outputPath);
    expect(validation.errors).toEqual([]);
    expect(validation.ok).toBe(true);
    rmRf(dir);
  });

  it('auto-detects teams/ and sharepoint/Resources*.resx', async () => {
    const dir = await makeFixture();
    await runBuild(dir, {});
    fs.mkdirSync(path.join(dir, 'teams'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'teams', 'manifest.json'), '{}');
    fs.writeFileSync(path.join(dir, 'teams', 'color.png'), 'fake-png');
    fs.writeFileSync(path.join(dir, 'sharepoint', 'Resources.resx'), '<root/>');

    const result = await runPackage(dir, { build: false });

    expect(result.zipEntries).toContain('Resources.resx');
    expect(result.zipEntries).toContain('ClientSideAssets/manifest.json');
    expect(result.zipEntries).toContain('ClientSideAssets/color.png');

    const validation = await validateSppkg(result.outputPath);
    expect(validation.errors).toEqual([]);
    expect(validation.ok).toBe(true);
    rmRf(dir);
  });
});
