import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldPlaygroundPage, scaffoldProject } from '../src/index.js';
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
    framework: 'vanilla',
    spfxVersion: '1.22',
    fluent: false,
    language: 'typescript',
    styling: 'css',
    componentId: '11111111-1111-4111-8111-111111111111',
    solutionId: '22222222-2222-4222-8222-222222222222',
    featureId: '33333333-3333-4333-8333-333333333333',
    packageName: '@contoso/hello',
    packageVersion: '0.0.1',
    ...overrides
  };
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
      'rspfx.config.ts',
      'tsconfig.json',
      '.gitignore',
      'README.md',
      'config/package-solution.json',
      'config/serve.json',
      'config/write-manifests.json',
      'sharepoint/assets/.gitkeep',
      'src/index.ts',
      'src/webparts/hello-world/hello-world.manifest.json',
      'src/webparts/hello-world/hello-worldWebPart.ts',
      'src/webparts/hello-world/components/HelloWorld.ts',
      'src/webparts/hello-world/styles/HelloWorld.module.css',
      'src/webparts/hello-world/assets/.gitkeep',
      'src/rspfx-env.d.ts',
      'playground/index.html',
      'playground/main.ts'
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
    expect(deps['@microsoft/sp-core-library']).toBe('1.22.0');
    expect(deps['@microsoft/sp-webpart-base']).toBe('1.22.0');
    expect(deps['@microsoft/sp-property-pane']).toBe('1.22.0');
  });

  it('writes a webpart manifest with componentType WebPart and an alias', () => {
    const manifest = readJson(vanillaDir, 'src/webparts/hello-world/hello-world.manifest.json');
    expect(manifest['componentType']).toBe('WebPart');
    expect(manifest['alias']).toBe('HelloWorldWebPart');
    expect(manifest['id']).toBe(vanillaVars.componentId);
  });

  it('scaffolds a react fluent project', () => {
    const vars = makeVars({ framework: 'react', fluent: true });
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

    const config = fs.readFileSync(path.join(dir, 'rspfx.config.ts'), 'utf-8');
    expect(config).toContain("framework: 'react'");
    expect(config).toContain('fluent: true');

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

  it('scaffolds a tailwind styling variant', () => {
    const vars = makeVars({ styling: 'tailwind' });
    const dir = path.join(tmpRoot, 'tailwind');
    scaffoldProject(vars, dir);

    const config = fs.readFileSync(path.join(dir, 'rspfx.config.ts'), 'utf-8');
    expect(config).toContain("styling: 'tailwind'");

    const stylesPath = path.join(dir, 'src/webparts/hello-world/styles/HelloWorld.module.scss');
    expect(fs.existsSync(stylesPath)).toBe(true);
    const styles = fs.readFileSync(stylesPath, 'utf-8');
    expect(styles).toContain('@apply');

    const entry = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.ts'), 'utf-8');
    expect(entry).toContain('./styles/HelloWorld.module.scss');
  });

  it('scaffolds a react tailwind project with shadcn/ui components', () => {
    const vars = makeVars({ framework: 'react', styling: 'tailwind' });
    const dir = path.join(tmpRoot, 'react-tailwind');
    scaffoldProject(vars, dir);

    const componentsDir = path.join(dir, 'src/webparts/hello-world/components');
    for (const relative of [
      'HelloWorld.tsx',
      'globals.css',
      'lib/utils.ts',
      'ui/button.tsx',
      'ui/card.tsx',
      'ui/badge.tsx',
      'ui/input.tsx',
      'ui/label.tsx'
    ]) {
      expect(fs.existsSync(path.join(componentsDir, relative)), relative).toBe(true);
    }

    const pkg = readJson(dir, 'package.json');
    const deps = pkg['dependencies'] as Record<string, string>;
    expect(deps['tailwindcss']).toBeDefined();
    for (const dep of ['clsx', 'tailwind-merge', 'class-variance-authority', 'lucide-react', 'react', 'react-dom']) {
      expect(deps[dep], dep).toBeDefined();
    }
    const devDeps = pkg['devDependencies'] as Record<string, string>;
    expect(devDeps['@types/react']).toBeDefined();

    const entry = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.ts'), 'utf-8');
    expect(entry).toContain("import { createRoot, type Root } from 'react-dom/client'");
    expect(entry).toContain("import { createElement } from 'react'");
    expect(entry).toContain("import HelloWorld from './components/HelloWorld'");
    expect(entry).toContain('this._root.render(createElement(HelloWorld, { description: this.properties.description }))');
    expect(entry).toContain('protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration');
    expect(entry).not.toContain('innerHTML');

    const component = fs.readFileSync(path.join(componentsDir, 'HelloWorld.tsx'), 'utf-8');
    expect(component).toContain("import './globals.css'");
    expect(component).toContain("from './ui/button'");
    expect(component).toContain('useState');

    const globals = fs.readFileSync(path.join(componentsDir, 'globals.css'), 'utf-8');
    expect(globals).toContain('@import "tailwindcss"');
    expect(globals).toContain('--background');
    expect(globals).toContain('--primary');
    expect(globals).toContain('@theme inline');
    expect(globals).toContain('--color-background: var(--background);');

    const button = fs.readFileSync(path.join(componentsDir, 'ui/button.tsx'), 'utf-8');
    expect(button).toContain("from 'class-variance-authority'");
    expect(button).toContain("from '@radix-ui/react-slot'");
    expect(button).toContain("from '../lib/utils'");
  });

  it('does not scaffold shadcn ui for react with scss styling', () => {
    const vars = makeVars({ framework: 'react', styling: 'scss' });
    const dir = path.join(tmpRoot, 'react-scss');
    scaffoldProject(vars, dir);

    expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/components/ui/button.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/components/globals.css'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/styles/HelloWorld.module.scss'))).toBe(true);

    const entry = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.ts'), 'utf-8');
    expect(entry).toContain('innerHTML');
    expect(entry).not.toContain('createRoot');
  });

  it('scaffolds tailwind styling for vue without shadcn ui components', () => {
    const vars = makeVars({ framework: 'vue', styling: 'tailwind' });
    const dir = path.join(tmpRoot, 'vue-tailwind');
    scaffoldProject(vars, dir);

    const config = fs.readFileSync(path.join(dir, 'rspfx.config.ts'), 'utf-8');
    expect(config).toContain("styling: 'tailwind'");

    expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/styles/HelloWorld.module.scss'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/components/globals.css'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/components/ui/button.tsx'))).toBe(false);

    const entry = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.ts'), 'utf-8');
    expect(entry).toContain("import './components/globals.css'");
    expect(entry).toContain("import { VueWebPart } from '@mbsks/rspfx-framework-vue/webpart'");

    const globals = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/components/globals.css'), 'utf-8');
    expect(globals).toContain('@import "tailwindcss"');

    const component = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/components/HelloWorld.vue'), 'utf-8');
    expect(component).toContain('max-w-md');
    expect(component).toContain('shadow-sm');
    expect(component).not.toContain('<style');
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

  it('scaffolds tailwind styling for svelte, solid, and preact without a styles module', () => {
    for (const framework of ['svelte', 'solid', 'preact'] as const) {
      const vars = makeVars({ framework, styling: 'tailwind' });
      const dir = path.join(tmpRoot, `tw-${framework}`);
      scaffoldProject(vars, dir);

      expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/styles/HelloWorld.module.scss'))).toBe(false);
      expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/components/globals.css'))).toBe(true);

      const entry = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.ts'), 'utf-8');
      expect(entry).toContain("import './components/globals.css'");

      const componentDir = path.join(dir, 'src/webparts/hello-world/components');
      const componentPath = framework === 'svelte' ? 'HelloWorld.svelte' : 'HelloWorld.tsx';
      const component = fs.readFileSync(path.join(componentDir, componentPath), 'utf-8');
      expect(component).toContain('max-w-md');
      expect(component).toContain('shadow-sm');
    }
  });

  it('scaffolds a javascript svelte project without typescript annotations', () => {
    const vars = makeVars({ framework: 'svelte', language: 'javascript' });
    const dir = path.join(tmpRoot, 'svelte-js');
    scaffoldProject(vars, dir);

    expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.js'))).toBe(true);
    const entry = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.js'), 'utf-8');
    expect(entry).toContain("import { SvelteWebPart } from '@mbsks/rspfx-framework-svelte/webpart'");
    expect(entry).toContain('extends SvelteWebPart {');

    const component = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/components/HelloWorld.svelte'), 'utf-8');
    expect(component).toContain('export let description');
    expect(component).not.toContain('lang="ts"');
  });

  it('scaffolds a javascript react tailwind project with jsx variants', () => {
    const vars = makeVars({ framework: 'react', styling: 'tailwind', language: 'javascript' });
    const dir = path.join(tmpRoot, 'react-tailwind-js');
    scaffoldProject(vars, dir);

    expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.js'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.ts'))).toBe(false);

    const componentsDir = path.join(dir, 'src/webparts/hello-world/components');
    expect(fs.existsSync(path.join(componentsDir, 'HelloWorld.jsx'))).toBe(true);
    expect(fs.existsSync(path.join(componentsDir, 'ui/button.jsx'))).toBe(true);
    expect(fs.existsSync(path.join(componentsDir, 'ui/button.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(componentsDir, 'lib/utils.js'))).toBe(true);

    const entry = fs.readFileSync(path.join(dir, 'src/webparts/hello-world/hello-worldWebPart.js'), 'utf-8');
    expect(entry).toContain('export default class HelloWorldWebPart extends BaseClientSideWebPart {');
    expect(entry).not.toContain('IHelloWorldWebPartProps');

    const component = fs.readFileSync(path.join(componentsDir, 'HelloWorld.jsx'), 'utf-8');
    expect(component).toContain("import './globals.css'");
    expect(component).not.toContain('interface IHelloWorldProps');
    expect(component).not.toContain(': IHelloWorldProps');
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
});

describe('scaffoldPlaygroundPage', () => {
  it('writes playground main.ts and index.html into an existing project', async () => {
    const written = await scaffoldPlaygroundPage(vanillaDir, vanillaVars);
    expect(written).toHaveLength(2);
    expect(written).toContain(path.join(vanillaDir, 'playground/main.ts'));
    expect(written).toContain(path.join(vanillaDir, 'playground/index.html'));

    const main = fs.readFileSync(path.join(vanillaDir, 'playground/main.ts'), 'utf-8');
    expect(main).toContain("import HelloWorldWebPart from '../src/webparts/hello-world/hello-worldWebPart'");
    expect(main).toContain("import { DisplayMode } from '@microsoft/sp-core-library'");
    expect(main).toContain("document.getElementById('root')");
    expect(main).toContain('_internalInitialize(');
    expect(main).toContain('DisplayMode.Read');
    expect(main).toContain('_internalDeserialize(');
    expect(main).toContain("properties: { description: 'hello-world' }");
    expect(main).not.toContain('properties = { description:');
    expect(main).not.toContain('webPart.domElement = root');
    expect(main).toContain('webPart.render()');

    const html = fs.readFileSync(path.join(vanillaDir, 'playground/index.html'), 'utf-8');
    expect(html).toContain('<title>HelloWorld playground</title>');
    expect(html).toContain('src="./main.ts"');
  });

  it.each(FRAMEWORKS)('writes a playground main that initializes via _internalInitialize for %s', async (framework) => {
    const vars = makeVars({ framework });
    const dir = path.join(tmpRoot, `pg-${framework}`);
    await scaffoldPlaygroundPage(dir, vars);

    const main = fs.readFileSync(path.join(dir, 'playground/main.ts'), 'utf-8');
    expect(main).toContain('_internalInitialize(');
    expect(main).toContain('_internalDeserialize(');
    expect(main).not.toContain('properties = { description:');
    expect(main).toContain(`manifest: { id: '${vars.componentId}', alias: 'HelloWorldWebPart' }`);
  });
});
