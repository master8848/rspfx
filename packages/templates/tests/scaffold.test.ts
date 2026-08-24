import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldProject } from '../src/index.js';
import type { TemplateVars } from '../src/index.js';

const FRAMEWORKS = ['vanilla', 'react', 'solid', 'preact', 'vue', 'svelte'] as const;

let tmpRoot: string;
let vanillaDir: string;
let vanillaVars: TemplateVars;

function makeVars(overrides: Partial<TemplateVars> = {}): TemplateVars {
  return {
    name: 'hello-world',
    namePascal: 'HelloWorld',
    nameCamel: 'helloWorld',
    componentType: 'webpart',
    framework: 'vanilla',
    spfxVersion: '1.23',
    language: 'typescript',
    componentId: '11111111-1111-4111-8111-111111111111',
    solutionId: '22222222-2222-4222-8222-222222222222',
    featureId: '33333333-3333-4333-8333-333333333333',
    packageName: '@contoso/hello',
    packageVersion: '0.0.1',
    ...overrides
  };
}

function readPng(root: string, relative: string): Buffer {
  return fs.readFileSync(path.join(root, relative));
}

function readPngHeader(png: Buffer): { width: number; height: number } {
  expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

function readJson(root: string, relative: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf-8')) as Record<string, unknown>;
}

beforeAll(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rspfx-templates-'));
  vanillaVars = makeVars();
  vanillaDir = path.join(tmpRoot, 'vanilla');
  scaffoldProject(vanillaVars, vanillaDir);
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('scaffoldProject', () => {
  it('scaffolds a vanilla typescript project with all expected files', async () => {
    const written = await scaffoldProject(vanillaVars, path.join(tmpRoot, 'vanilla-again'));
    const expectedPaths = [
      'package.json',
      'vite.config.ts',
      'tsconfig.json',
'.npmrc',
      '.gitignore',
      'README.md',
      'config/package-solution.json',
      'config/serve.json',
      'config/write-manifests.json',
      'config/config.json',
      'sharepoint/assets/.gitkeep',
      'assets/favicon.svg',
      'src/index.ts',
      'src/webparts/hello-world/hello-world.manifest.json',
      'src/webparts/hello-world/hello-worldWebPart.ts',
      'src/webparts/hello-world/components/HelloWorld.ts',
      'src/webparts/hello-world/styles/HelloWorld.module.scss',
      'src/webparts/hello-world/assets/.gitkeep',
      'src/webparts/hello-world/loc/en-us.ts',
      'src/webparts/hello-world/loc/fr-fr.ts',
      'teams/11111111-1111-4111-8111-111111111111_color.png',
      'teams/11111111-1111-4111-8111-111111111111_outline.png',
      'teams/manifest.json',
      'src/rspfx-env.d.ts'
    ];
    expect(written).toHaveLength(expectedPaths.length);
    for (const relative of expectedPaths) {
      expect(written).toContain(path.join(path.join(tmpRoot, 'vanilla-again'), relative));
      expect(fs.existsSync(path.join(path.join(tmpRoot, 'vanilla-again'), relative))).toBe(true);
    }
  });

  it('writes a package.json with the package name and pinned sp deps', () => {
    const pkg = readJson(vanillaDir, 'package.json');
    expect(pkg['name']).toBe('@contoso/hello');
    expect(pkg['version']).toBe('0.0.1');
    const deps = pkg['dependencies'] as Record<string, string>;
    expect(deps['@microsoft/sp-core-library']).toBe('1.23.0');
    expect(deps['@microsoft/sp-webpart-base']).toBe('1.23.0');
    expect(deps['@microsoft/sp-property-pane']).toBe('1.23.0');
    const devDeps = pkg['devDependencies'] as Record<string, string>;
    const toolchainVersion = JSON.parse(
      fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    ) as { version: string };
    expect(devDeps['@mbsks/rspfx-plugin']).toBe(`^${toolchainVersion.version}`);
    expect(devDeps['@mbsks/rspfx-cli']).toBe(`^${toolchainVersion.version}`);
  });

  it('writes a comma-correct dev block when tenantUrl is set', () => {
    const vars = makeVars({ tenantUrl: 'https://contoso.sharepoint.com' });
    const dir = path.join(tmpRoot, 'tenant');
    scaffoldProject(vars, dir);

    const config = fs.readFileSync(path.join(dir, 'vite.config.ts'), 'utf-8');
    expect(config).toContain('    openBrowser: false,');
    expect(config).toContain('    tenantUrl: "https://contoso.sharepoint.com"');
    expect(config).not.toContain('fluent');
    expect(config).toMatch(/openBrowser: false,\n {8}tenantUrl: "https:\/\/contoso\.sharepoint\.com"/);
  });

  it('writes a webpart manifest with componentType WebPart and an alias', () => {
    const manifest = readJson(vanillaDir, 'src/webparts/hello-world/hello-world.manifest.json');
    expect(manifest['componentType']).toBe('WebPart');
    expect(manifest['alias']).toBe('HelloWorldWebPart');
    expect(manifest['id']).toBe(vanillaVars.componentId);
  });

  it('scaffolds a react project', () => {
    const vars = makeVars({ framework: 'react' });
    const dir = path.join(tmpRoot, 'react');
    scaffoldProject(vars, dir);

    const entryPath = path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.ts');
    const componentPath = path.join(dir, 'src/webparts/hello-world/components/HelloWorld.tsx');
    expect(fs.existsSync(entryPath)).toBe(true);
    expect(fs.existsSync(componentPath)).toBe(true);
    expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/components/HelloWorld.ts'))).toBe(false);

    const entry = fs.readFileSync(entryPath, 'utf-8');
    expect(entry).toContain("import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base'");
    expect(entry).toContain("import HelloWorld from './components/HelloWorld'");

    const config = fs.readFileSync(path.join(dir, 'vite.config.ts'), 'utf-8');
    expect(config).toContain("import { rspfxVite } from '@mbsks/rspfx-plugin';");
    expect(config).toContain('rspfxVite({');
    expect(config).toContain("name: '@contoso/hello'");
    expect(config).toContain("version: '0.0.1'");
    expect(config).toContain("framework: 'react'");
    expect(config).not.toContain('fluent');
    expect(config).toContain('port: 4321');
    expect(config).toContain('cssCodeSplit');

    const tsconfig = readJson(dir, 'tsconfig.json');
    const compilerOptions = (tsconfig['compilerOptions'] as Record<string, unknown>);
    expect(compilerOptions['jsx']).toBe('react-jsx');
  });

  it('scaffolds a vue project with javascript language', () => {
    const vars = makeVars({ framework: 'vue', language: 'javascript' });
    const dir = path.join(tmpRoot, 'vue-js');
    scaffoldProject(vars, dir);

    expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.js'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.ts'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/components/HelloWorld.vue'))).toBe(true);

    const entry = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.js'), 'utf-8');
    expect(entry).toContain("import { VueWebPart } from '@mbsks/rspfx-framework-vue/webpart'");
    expect(entry).toContain('export default class HelloWorldWebPart extends VueWebPart {');
    expect(entry).not.toContain('IHelloWorldWebPartProps');

    const component = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/components/HelloWorld.vue'), 'utf-8');
    expect(component).toContain('<template>');
    expect(component).toContain("defineProps(['description'])");
    expect(component).not.toContain('lang="ts"');
  });


  it('scaffolds a react project using plain components', () => {
    const vars = makeVars({ framework: 'react' });
    const dir = path.join(tmpRoot, 'react-scss');
    scaffoldProject(vars, dir);

    expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/components/ui/button.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/components/globals.css'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/styles/HelloWorld.module.scss'))).toBe(true);

    const entry = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.ts'), 'utf-8');
    expect(entry).toContain('innerHTML');
    expect(entry).not.toContain('createRoot');
  });

  it.each(['svelte', 'solid', 'preact'] as const)(
    'scaffolds a %s project with the framework webpart class and component',
    (framework) => {
      const vars = makeVars({ framework });
      const dir = path.join(tmpRoot, `fw2-${framework}`);
      scaffoldProject(vars, dir);

      const expectedFw = `@mbsks/rspfx-framework-${framework}`;
      const entry = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.ts'), 'utf-8');
      expect(entry).toContain(`from '${expectedFw}/webpart'`);
      expect(entry).toContain('extends ');
      expect(entry).not.toContain('BaseClientSideWebPart');
      expect(entry).not.toContain('innerHTML');
      expect(entry).toContain('getPropertyPaneConfiguration');
      expect(entry).toContain('PropertyPaneTextField');
      expect(entry).toContain('export type IHelloWorldWebPartProps = {');

      const componentsDir = path.join(dir, 'src/webparts/hello-world/components');
      expect(fs.existsSync(path.join(componentsDir, `HelloWorld${framework === 'svelte' ? '.svelte' : '.tsx'}`))).toBe(true);

      const pkg = readJson(dir, 'package.json');
      const deps = pkg['dependencies'] as Record<string, string>;
      expect(deps[expectedFw]).toBeDefined();
    }
  );

  it('scaffolds a javascript svelte project without typescript annotations', () => {
    const vars = makeVars({ framework: 'svelte', language: 'javascript' });
    const dir = path.join(tmpRoot, 'svelte-js');
    scaffoldProject(vars, dir);

    expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.js'))).toBe(true);
    const entry = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.js'), 'utf-8');
    expect(entry).toContain("import { SvelteWebPart } from '@mbsks/rspfx-framework-svelte/webpart'");
    expect(entry).toContain('extends SvelteWebPart {');

    const component = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/components/HelloWorld.svelte'), 'utf-8');
    expect(component).toContain('let { description } = $props()');
    expect(component).toContain('transition:fade');
    expect(component).not.toContain('lang="ts"');
  });

  it('keeps generated ids consistent with the supplied vars', () => {
    const solution = readJson(vanillaDir, 'config/package-solution.json');
    const solutionBlock = solution['solution'] as Record<string, unknown>;
    expect(solutionBlock['id']).toBe(vanillaVars.solutionId);
    const features = solutionBlock['features'] as Array<Record<string, unknown>>;
    expect(features[0]?.['id']).toBe(vanillaVars.featureId);

    const manifest = readJson(vanillaDir, 'src/webparts/hello-world/hello-world.manifest.json');
    expect(manifest['id']).toBe(vanillaVars.componentId);

    const ids = [vanillaVars.componentId, vanillaVars.solutionId, vanillaVars.featureId];
    expect(new Set(ids).size).toBe(3);
  });

  it.each(FRAMEWORKS)('scaffolds the %s framework', async (framework) => {
    const vars = makeVars({ framework });
    const dir = path.join(tmpRoot, `fw-${framework}`);
    const written = await scaffoldProject(vars, dir);
    expect(written.length).toBeGreaterThanOrEqual(15);
    const manifest = readJson(dir, 'src/webparts/hello-world/hello-world.manifest.json');
    expect(manifest['componentType']).toBe('WebPart');
  });

  it('defaults to vite with cssCodeSplit comment and vite devDependency', () => {
    const pkg = readJson(vanillaDir, 'package.json');
    const devDeps = pkg['devDependencies'] as Record<string, string>;
    expect(devDeps['vite']).toBeDefined();
    expect(devDeps['@rspack/cli']).toBeUndefined();
    expect(devDeps['@rsbuild/core']).toBeUndefined();
    expect(fs.existsSync(path.join(vanillaDir, 'vite.config.ts'))).toBe(true);
    expect(fs.existsSync(path.join(vanillaDir, 'rspack.config.ts'))).toBe(false);
    const config = fs.readFileSync(path.join(vanillaDir, 'vite.config.ts'), 'utf-8');
    expect(config).toContain('rspfxVite');
    expect(config).toContain('cssCodeSplit');
    expect(config).toContain('.module.scss');
    // vite handles .module.scss via css modules (comment)
  });

  it('scaffolds rspack.config.ts when bundler is rspack', () => {
    const vars = makeVars({ bundler: 'rspack' });
    const dir = path.join(tmpRoot, 'rspack-choice');
    scaffoldProject(vars, dir);
    expect(fs.existsSync(path.join(dir, 'rspack.config.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'vite.config.ts'))).toBe(false);
    const config = fs.readFileSync(path.join(dir, 'rspack.config.ts'), 'utf-8');
    expect(config).toContain('RspfxPlugin');
    const pkg = readJson(dir, 'package.json');
    const devDeps = pkg['devDependencies'] as Record<string, string>;
    expect(devDeps['@rspack/cli']).toBeDefined();
    expect(devDeps['vite']).toBeUndefined();
  });

  it('scaffolds rsbuild.config.ts with injectStyles and postcss when bundler is rsbuild', () => {
    const vars = makeVars({ bundler: 'rsbuild' });
    const dir = path.join(tmpRoot, 'rsbuild-choice');
    scaffoldProject(vars, dir);
    expect(fs.existsSync(path.join(dir, 'rsbuild.config.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'vite.config.ts'))).toBe(false);
    const config = fs.readFileSync(path.join(dir, 'rsbuild.config.ts'), 'utf-8');
    expect(config).toContain('rspfxRsbuild');
    expect(config).toContain('injectStyles: true');
    expect(config).toContain('postcss');
    const pkg = readJson(dir, 'package.json');
    const devDeps = pkg['devDependencies'] as Record<string, string>;
    expect(devDeps['@rsbuild/core']).toBeDefined();
    expect(devDeps['vite']).toBeUndefined();
  });
});

describe('scaffoldProject extensions', () => {
  it.each([
    ['applicationcustomizer', 'ApplicationCustomizer', '@microsoft/sp-application-base', 'HelloWorldApplicationCustomizer', 'HelloWorldApplicationCustomizer.ts'],
    ['fieldcustomizer', 'FieldCustomizer', '@microsoft/sp-field-customizer-base', 'HelloWorldFieldCustomizer', 'HelloWorldFieldCustomizer.ts'],
    ['listviewcommandset', 'ListViewCommandSet', '@microsoft/sp-listview-extensibility', 'HelloWorldCommandSet', 'HelloWorldCommandSet.ts'],
    ['formcustomizer', 'FormCustomizer', '@microsoft/sp-listview-extensibility', 'HelloWorldFormCustomizer', 'HelloWorldFormCustomizer.ts']
  ] as const)(
    'scaffolds a %s extension with manifest, entry, and deps',
    (componentType, extensionType, spDep, className, entryFile) => {
      const vars = makeVars({ componentType });
      const dir = path.join(tmpRoot, `ext-${componentType}`);
      scaffoldProject(vars, dir);

      const manifestPath = `src/extensions/hello-world/hello-world.manifest.json`;
      const manifest = readJson(dir, manifestPath);
      expect(manifest['componentType']).toBe('Extension');
      expect(manifest['extensionType']).toBe(extensionType);
      expect(manifest['alias']).toBe(className);
      expect(manifest['version']).toBe('*');
      expect(manifest['manifestVersion']).toBe(2);
      expect(manifest['requiresCustomScript']).toBe(false);
      expect(manifest['id']).toBe(vars.componentId);

      const entryPath = `src/extensions/hello-world/${entryFile}`;
      expect(fs.existsSync(path.join(dir, entryPath))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'src/extensions/hello-world/hello-worldWebPart.ts'))).toBe(false);

      const pkg = readJson(dir, 'package.json');
      const deps = pkg['dependencies'] as Record<string, string>;
      expect(deps[spDep]).toBe('1.23.0');
      expect(deps['@microsoft/decorators']).toBe('1.23.0');
      expect(deps['@microsoft/sp-core-library']).toBe('1.23.0');
      expect(deps['@microsoft/sp-webpart-base']).toBeUndefined();
      expect(deps['@microsoft/sp-property-pane']).toBeUndefined();

      const tsconfig = readJson(dir, 'tsconfig.json');
      const compilerOptions = tsconfig['compilerOptions'] as Record<string, unknown>;
      expect(compilerOptions['experimentalDecorators']).toBe(true);

      const solution = readJson(dir, 'config/package-solution.json');
      const solutionBlock = solution['solution'] as Record<string, unknown>;
      const features = solutionBlock['features'] as Array<Record<string, unknown>>;
      expect(features[0]?.['description']).toBe(`A feature which activates the Client-Side Extension named 'HelloWorld'`);

      const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf-8');
      expect(readme).toContain('An SPFx 1.23');
    }
  );

  it('does not scaffold web part only files for extensions', async () => {
    const vars = makeVars({ componentType: 'applicationcustomizer' });
    const dir = path.join(tmpRoot, 'ext-no-webpart');
    const written = await scaffoldProject(vars, dir);

    expect(written.some((file) => file.includes('src/webparts'))).toBe(false);
    expect(written.some((file) => file.includes('components'))).toBe(false);
    expect(written.some((file) => file.includes('styles'))).toBe(false);
    expect(written.some((file) => file.includes('loc'))).toBe(false);
    expect(written.some((file) => file.includes('teams'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'config/config.json'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'src/rspfx-env.d.ts'))).toBe(true);
  });

  it('scaffolds an application customizer entry with onInit and a defensive onRender', () => {
    const vars = makeVars({ componentType: 'applicationcustomizer' });
    const dir = path.join(tmpRoot, 'ext-ac-entry');
    scaffoldProject(vars, dir);

    const entry = fs.readFileSync(path.join(dir, 'src/extensions/hello-world/HelloWorldApplicationCustomizer.ts'), 'utf-8');
    expect(entry).toContain("import { Log } from '@microsoft/sp-core-library'");
    expect(entry).toContain("import { override } from '@microsoft/decorators'");
    expect(entry).toContain("import { BaseApplicationCustomizer } from '@microsoft/sp-application-base'");
    expect(entry).toContain('const LOG_SOURCE: string = \'HelloWorldApplicationCustomizer\'');
    expect(entry).toContain('export default class HelloWorldApplicationCustomizer extends BaseApplicationCustomizer {');
    expect(entry).toContain('public onInit(): Promise<void>');
    expect(entry).toContain("Log.info(LOG_SOURCE, 'Initialized hello-world')");
    expect(entry).toContain('return super.onInit();');
    expect(entry).toContain('public onRender(): void');
    expect(entry).toContain("this.context.placeholderProvider.tryCreateContent('PageHeader')");
    expect(entry).toContain('if (placeholder) {');
    expect(entry).not.toContain('PropertyPane');
  });

  it('scaffolds a field customizer entry rendering the cell value', () => {
    const vars = makeVars({ componentType: 'fieldcustomizer' });
    const dir = path.join(tmpRoot, 'ext-fc-entry');
    scaffoldProject(vars, dir);

    const entry = fs.readFileSync(path.join(dir, 'src/extensions/hello-world/HelloWorldFieldCustomizer.ts'), 'utf-8');
    expect(entry).toContain('type IFieldCustomizerCellEventParameters');
    expect(entry).toContain("} from '@microsoft/sp-listview-extensibility';");
    expect(entry).toContain('export default class HelloWorldFieldCustomizer extends BaseFieldCustomizer<{}> {');
    expect(entry).toContain('public onRenderCell(event: IFieldCustomizerCellEventParameters): void {');
    expect(entry).toContain("event.domElement.textContent = event.fieldValue != null ? String(event.fieldValue) : '';");
    expect(entry).toContain('escaped: fieldValue is user-controlled');
    expect(entry).not.toContain('PropertyPane');
  });

  it('scaffolds a list view command set manifest with two commands and a logging entry', () => {
    const vars = makeVars({ componentType: 'listviewcommandset' });
    const dir = path.join(tmpRoot, 'ext-lvcs');
    scaffoldProject(vars, dir);

    const manifest = readJson(dir, 'src/extensions/hello-world/hello-world.manifest.json');
    const items = manifest['items'] as Record<string, Record<string, unknown>>;
    expect(items['HELLOWORLD_1']?.['title']).toEqual({ default: 'Command One' });
    expect(items['HELLOWORLD_1']?.['type']).toBe('command');
    expect(items['HELLOWORLD_2']?.['title']).toEqual({ default: 'Command Two' });
    expect(items['HELLOWORLD_2']?.['type']).toBe('command');

    const entry = fs.readFileSync(path.join(dir, 'src/extensions/hello-world/HelloWorldCommandSet.ts'), 'utf-8');
    expect(entry).toContain('type IListViewCommandSetExecuteEventParameters');
    expect(entry).toContain('type IListViewCommandSetListViewUpdatedEventParameters');
    expect(entry).toContain("} from '@microsoft/sp-listview-extensibility'");
    expect(entry).toContain('export default class HelloWorldCommandSet extends BaseListViewCommandSet<{}> {');
    expect(entry).toContain('public onListViewUpdated(event: IListViewCommandSetListViewUpdatedEventParameters): void {');
    expect(entry).toContain('public onExecute(event: IListViewCommandSetExecuteEventParameters): void {');
    expect(entry).toContain('Log.info(LOG_SOURCE, `Command ${event.itemId} clicked`);');
  });

  it('scaffolds a form customizer with BaseFormCustomizer and render/dispose', () => {
    const vars = makeVars({ componentType: 'formcustomizer' });
    const dir = path.join(tmpRoot, 'ext-form');
    scaffoldProject(vars, dir);

    const manifest = readJson(dir, 'src/extensions/hello-world/hello-world.manifest.json');
    expect(manifest['componentType']).toBe('Extension');
    expect(manifest['extensionType']).toBe('FormCustomizer');
    expect(manifest['alias']).toBe('HelloWorldFormCustomizer');

    const entry = fs.readFileSync(path.join(dir, 'src/extensions/hello-world/HelloWorldFormCustomizer.ts'), 'utf-8');
    expect(entry).toContain("import { BaseFormCustomizer } from '@microsoft/sp-listview-extensibility'");
    expect(entry).toContain('export default class HelloWorldFormCustomizer extends BaseFormCustomizer<{}> {');
    expect(entry).toContain('public render(): void {');
    expect(entry).toContain('public onDispose(): void {');
    expect(entry).toContain('super.onDispose();');
  });
});

describe('scaffoldProject library', () => {
  it('scaffolds a library with Library manifest and Library entry', () => {
    const vars = makeVars({ componentType: 'library' });
    const dir = path.join(tmpRoot, 'lib-hello');
    scaffoldProject(vars, dir);

    const manifest = readJson(dir, 'src/libraries/hello-world/hello-world.manifest.json');
    expect(manifest['componentType']).toBe('Library');
    expect(manifest['alias']).toBe('HelloWorldLibrary');
    expect(manifest['version']).toBe('*');
    expect(manifest['manifestVersion']).toBe(2);
    expect(manifest['$schema']).toBe('https://developer.microsoft.com/json-schemas/spfx/client-side-library-manifest.schema.json');
    expect(manifest['preconfiguredEntries']).toBeUndefined();
    expect(manifest['extensionType']).toBeUndefined();

    const entryPath = 'src/libraries/hello-world/HelloWorldLibrary.ts';
    expect(fs.existsSync(path.join(dir, entryPath))).toBe(true);
    const entry = fs.readFileSync(path.join(dir, entryPath), 'utf-8');
    expect(entry).toContain('export default class HelloWorldLibrary {');
    expect(entry).toContain("return 'HelloWorld';");

    const pkg = readJson(dir, 'package.json');
    const deps = pkg['dependencies'] as Record<string, string>;
    expect(deps['@microsoft/sp-core-library']).toBe('1.23.0');
    expect(deps['@microsoft/sp-webpart-base']).toBeUndefined();
    expect(deps['@microsoft/sp-application-base']).toBeUndefined();

    expect(fs.existsSync(path.join(dir, 'src/webparts'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'src/extensions'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'config/config.json'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'teams/manifest.json'))).toBe(false);

    const sol = readJson(dir, 'config/package-solution.json');
    const features = (sol['solution'] as Record<string, unknown>)['features'] as Array<Record<string, unknown>>;
    expect(features[0]?.['description']).toBe("A feature which activates the Client-Side Library named 'HelloWorld'");
  });
});

describe('scaffoldProject locales', () => {
  it('writes config/config.json and en-us/fr-fr locale modules', () => {
    const dir = path.join(tmpRoot, 'loc-files');
    scaffoldProject(vanillaVars, dir);

    const config = readJson(dir, 'config/config.json');
    const localizedResources = config['localizedResources'] as Record<string, string>;
    expect(localizedResources['HelloWorldWebPartStrings']).toBe('src/webparts/hello-world/loc/{locale}.js');

    const enUs = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/loc/en-us.ts'), 'utf-8');
    expect(enUs).toContain('define([], () => {');
    expect(enUs).toContain('"Description": "Description"');

    const frFr = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/loc/fr-fr.ts'), 'utf-8');
    expect(frFr).toContain('"Description": "La description"');
  });

  it('wires strings.Description into the web part property pane label (vanilla and react)', () => {
    for (const framework of ['vanilla', 'react'] as const) {
      const vars = makeVars({ framework });
      const dir = path.join(tmpRoot, `loc-entry-${framework}`);
      scaffoldProject(vars, dir);

      const entry = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.ts'), 'utf-8');
      expect(entry).toContain("import strings from 'HelloWorldWebPartStrings'");
      expect(entry).toContain('label: strings.Description');
      expect(entry).not.toContain("label: 'Description'");
    }
  });

  it('wires strings.Description into the javascript web part entry', () => {
    const vars = makeVars({ framework: 'vanilla', language: 'javascript' });
    const dir = path.join(tmpRoot, 'loc-entry-js');
    scaffoldProject(vars, dir);

    const entry = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.js'), 'utf-8');
    expect(entry).toContain("import strings from 'HelloWorldWebPartStrings'");
    expect(entry).toContain('label: strings.Description');
  });
});

describe('scaffoldProject teams', () => {
  it('writes a teams app manifest with SPFx dynamic tokens and valid domains', () => {
    const dir = path.join(tmpRoot, 'teams-manifest');
    scaffoldProject(vanillaVars, dir);

    const manifest = readJson(dir, 'teams/manifest.json');
    expect(manifest['manifestVersion']).toBe('1.13');
    expect(manifest['version']).toBe('1.0.0');
    expect(manifest['id']).toBe(vanillaVars.componentId);
    expect(manifest['packageName']).toBe('com.contoso.hello-world');

    const developer = manifest['developer'] as Record<string, string>;
    expect(developer['name']).toBe('SPFx + Teams Dev');
    expect(developer['privacyUrl']).toBe('https://privacy.microsoft.com/en-us/privacystatement');

    const name = manifest['name'] as Record<string, string>;
    expect(name['short']).toBe('hello-world');
    const description = manifest['description'] as Record<string, string>;
    expect(description['short']).toBe('hello-world description');

    const icons = manifest['icons'] as Record<string, string>;
    expect(icons['color']).toBe('11111111-1111-4111-8111-111111111111_color.png');
    expect(icons['outline']).toBe('11111111-1111-4111-8111-111111111111_outline.png');
    expect(manifest['accentColor']).toBe('#FFFFFF');

    const staticTabs = manifest['staticTabs'] as Array<Record<string, unknown>>;
    expect(staticTabs[0]?.['scopes']).toEqual(['personal']);
    expect(staticTabs[0]?.['entityId']).toBe(vanillaVars.componentId);
    expect(String(staticTabs[0]?.['contentUrl'])).toContain('https://{teamSiteDomain}{teamSitePath}/_layouts/15/TeamsLogon.aspx?SPFX=true');
    expect(String(staticTabs[0]?.['contentUrl'])).toContain(`componentId=${vanillaVars.componentId}%26forceLocale={locale}`);

    const configurableTabs = manifest['configurableTabs'] as Array<Record<string, unknown>>;
    expect(configurableTabs[0]?.['scopes']).toEqual(['team']);
    expect(configurableTabs[0]?.['canUpdateConfiguration']).toBe(true);
    expect(String(configurableTabs[0]?.['configurationUrl'])).toContain('teamshostedapp.aspx%3FopenPropertyPane=true');

    const validDomains = manifest['validDomains'] as string[];
    expect(validDomains).toContain('*.sharepoint.com');
    expect(validDomains).toContain('*.login.microsoftonline.com');
    expect(validDomains).toContain('spoprod-a.akamaihd.net');
    expect(validDomains).toContain('*.officeapps.live.com');
    expect(validDomains).toContain('*.secure.aadcdn.microsoftonline-p.com');
  });

  it('writes valid 192x192 and 32x32 PNG icons', () => {
    const dir = path.join(tmpRoot, 'teams-png');
    scaffoldProject(vanillaVars, dir);

    const color = readPng(dir, 'teams/11111111-1111-4111-8111-111111111111_color.png');
    expect(readPngHeader(color)).toEqual({ width: 192, height: 192 });
    expect(color.subarray(color.length - 8, color.length - 4).toString('ascii')).toBe('IEND');

    const outline = readPng(dir, 'teams/11111111-1111-4111-8111-111111111111_outline.png');
    expect(readPngHeader(outline)).toEqual({ width: 32, height: 32 });
  });
});

describe('scaffoldProject without playground', () => {
  it('no longer scaffolds the playground folder (local preview is served by the dev server at /)', async () => {
    const written = await scaffoldProject(vanillaVars, path.join(tmpRoot, 'plain'));
    expect(written.some((file) => file.includes('playground'))).toBe(false);
  });
});
