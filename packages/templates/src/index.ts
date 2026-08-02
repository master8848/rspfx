import fs from 'node:fs';
import path from 'node:path';
import { configDefaults } from '@mbsks/rspfx-core';
import type { FrameworkId, SpfxTarget } from '@mbsks/rspfx-core';

export interface TemplateVars {
  name: string;
  namePascal: string;
  nameCamel: string;
  framework: FrameworkId;
  spfxVersion: SpfxTarget;
  fluent: boolean;
  language: 'typescript' | 'javascript';
  styling: 'css' | 'scss' | 'tailwind';
  tenantUrl?: string;
  componentId: string;
  solutionId: string;
  featureId: string;
  packageName: string;
  packageVersion: string;
}

export async function scaffoldProject(vars: TemplateVars, destDir: string): Promise<string[]> {
  const files = buildFiles(vars);
  const written: string[] = [];
  for (const file of files) {
    const target = path.join(destDir, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
    written.push(target);
  }
  return written;
}

export async function scaffoldPlaygroundPage(projectRoot: string, vars: TemplateVars): Promise<string[]> {
  const files = playgroundFiles(vars);
  const written: string[] = [];
  for (const file of files) {
    const target = path.join(projectRoot, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
    written.push(target);
  }
  return written;
}

interface TemplateFile {
  path: string;
  content: string;
}

const FRAMEWORK_VARIANTS = ['vue', 'svelte', 'solid', 'preact'] as const;

function isShadcn(vars: TemplateVars): boolean {
  return vars.framework === 'react' && vars.styling === 'tailwind';
}

function isFrameworkVariant(vars: TemplateVars): boolean {
  return (FRAMEWORK_VARIANTS as readonly string[]).includes(vars.framework);
}

const FRAMEWORK_RUNTIME_DEPS: Record<string, Record<string, string>> = {
  vue: { vue: '^3.5.13' },
  svelte: { svelte: '^4.2.19' },
  solid: { 'solid-js': '^1.9.4' },
  preact: { preact: '^10.24.0' }
};

/**
 * The current release version of the rspfx toolchain — every publishable
 * package shares one version, so the scaffold can pin its @mbsks/rspfx-*
 * devDependencies to a resolvable range of the actual npm release.
 */
const TOOLCHAIN_VERSION: string = (() => {
  const pkg = JSON.parse(
    fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  ) as { version?: string };
  return pkg.version ?? '0.0.1';
})();

function frameworkDeps(vars: TemplateVars): Record<string, string> {
  const runtime = FRAMEWORK_RUNTIME_DEPS[vars.framework];
  if (!runtime) {
    return {};
  }
  return { [`@mbsks/rspfx-framework-${vars.framework}`]: `^${TOOLCHAIN_VERSION}`, ...runtime };
}

function buildFiles(vars: TemplateVars): TemplateFile[] {
  const files: TemplateFile[] = [
    { path: 'package.json', content: packageJson(vars) },
    { path: 'tsconfig.json', content: tsconfigJson(vars) },
    { path: 'rspack.config.ts', content: rspackConfig(vars) },
    { path: '.gitignore', content: gitignore() },
    { path: 'README.md', content: readme(vars) },
    { path: 'config/package-solution.json', content: packageSolution(vars) },
    { path: 'config/serve.json', content: serveJson(vars) },
    { path: 'config/write-manifests.json', content: writeManifestsJson() },
    { path: 'sharepoint/assets/.gitkeep', content: '' },
    { path: 'src/index.ts', content: 'export {};\n' },
    { path: `src/webparts/${vars.name}/${vars.name}.manifest.json`, content: webpartManifest(vars) },
    { path: `src/webparts/${vars.name}/${vars.name}WebPart.${vars.language === 'javascript' ? 'js' : 'ts'}`, content: webpartEntry(vars) },
    { path: `src/webparts/${vars.name}/components/${vars.namePascal}${componentExtension(vars)}`, content: component(vars) },
    { path: `src/webparts/${vars.name}/assets/.gitkeep`, content: '' },
    { path: 'src/rspfx-env.d.ts', content: declarations(vars) },
    ...playgroundFiles(vars)
  ];
  if (isShadcn(vars)) {
    files.push(...shadcnFiles(vars));
  } else if (isFrameworkVariant(vars) && vars.styling === 'tailwind') {
    files.push({
      path: `src/webparts/${vars.name}/components/globals.css`,
      content: globalsCss()
    });
  } else {
    files.push({
      path: `src/webparts/${vars.name}/styles/${vars.namePascal}.module.${vars.styling === 'css' ? 'css' : 'scss'}`,
      content: stylesheet(vars)
    });
  }
  return files;
}

function playgroundFiles(vars: TemplateVars): TemplateFile[] {
  return [
    { path: 'playground/index.html', content: playgroundHtml(vars) },
    { path: 'playground/main.ts', content: playgroundMain(vars) }
  ];
}

function shadcnFiles(vars: TemplateVars): TemplateFile[] {
  const js = vars.language === 'javascript';
  const uiExt = js ? 'jsx' : 'tsx';
  const uiDir = `src/webparts/${vars.name}/components/ui`;
  return [
    { path: `src/webparts/${vars.name}/components/globals.css`, content: globalsCss() },
    { path: `src/webparts/${vars.name}/components/lib/utils.${js ? 'js' : 'ts'}`, content: js ? utilsJs() : utilsTs() },
    { path: `${uiDir}/button.${uiExt}`, content: js ? buttonJsx() : buttonTsx() },
    { path: `${uiDir}/card.${uiExt}`, content: js ? cardJsx() : cardTsx() },
    { path: `${uiDir}/badge.${uiExt}`, content: js ? badgeJsx() : badgeTsx() },
    { path: `${uiDir}/input.${uiExt}`, content: js ? inputJsx() : inputTsx() },
    { path: `${uiDir}/label.${uiExt}`, content: js ? labelJsx() : labelTsx() }
  ];
}

function componentExtension(vars: TemplateVars): string {
  const ext = vars.language === 'javascript' ? 'js' : 'ts';
  switch (vars.framework) {
    case 'react':
    case 'solid':
    case 'preact':
      return vars.language === 'javascript' ? '.jsx' : '.tsx';
    case 'vue':
      return '.vue';
    case 'svelte':
      return '.svelte';
    default:
      return `.${ext}`;
  }
}

function packageJson(vars: TemplateVars): string {
  const spVersion = `${vars.spfxVersion}.0`;
  const tailwindDeps = vars.styling === 'tailwind' ? { tailwindcss: '^4.0.0' } : {};
  const framework = frameworkDeps(vars);;
  const shadcnDeps = isShadcn(vars)
    ? {
        clsx: '^2.1.1',
        'tailwind-merge': '^2.6.0',
        'class-variance-authority': '^0.7.1',
        'lucide-react': '^0.454.0',
        '@radix-ui/react-slot': '^1.1.1',
        '@radix-ui/react-label': '^2.1.1',
        react: '^18.3.1',
        'react-dom': '^18.3.1'
      }
    : {};
  const shadcnDevDeps = isShadcn(vars)
    ? {
        '@types/react': '^18.3.0',
        '@types/react-dom': '^18.3.0'
      }
    : {};
  return JSON.stringify(
    {
      name: vars.packageName,
      version: vars.packageVersion,
      private: true,
      type: 'module',
      scripts: {
        dev: 'rspfx dev',
        build: 'rspfx build',
        package: 'rspfx package',
        deploy: 'rspfx deploy',
        analyze: 'rspfx analyze',
        doctor: 'rspfx doctor',
        clean: 'rspfx clean'
      },
      dependencies: {
        '@microsoft/sp-core-library': spVersion,
        '@microsoft/sp-webpart-base': spVersion,
        '@microsoft/sp-property-pane': spVersion,
        ...tailwindDeps,
        ...framework,
        ...shadcnDeps
      },
      devDependencies: {
        '@mbsks/rspfx-plugin': `^${TOOLCHAIN_VERSION}`,
        '@mbsks/rspfx-cli': `^${TOOLCHAIN_VERSION}`,
        typescript: '^5.7.0',
        ...shadcnDevDeps
      }
    },
    null,
    2
  );
}

function tsconfigJson(vars: TemplateVars): string {
  const jsx =
    vars.framework === 'react'
      ? { jsx: 'react-jsx' }
      : vars.framework === 'solid'
        ? { jsx: 'react-jsx', jsxImportSource: 'solid-js' }
        : vars.framework === 'preact'
          ? { jsx: 'react-jsx', jsxImportSource: 'preact' }
          : {};
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        ...jsx
      },
      include: ['src']
    },
    null,
    2
  );
}

function rspackConfig(vars: TemplateVars): string {
  const devLines = [
    `        port: ${configDefaults.dev.port},`,
    `        https: ${configDefaults.dev.https},`,
    `        hostname: '${configDefaults.dev.hostname}',`,
    `        workbench: ${configDefaults.dev.workbench},`,
    `        openBrowser: ${configDefaults.dev.openBrowser}${vars.tenantUrl ? `,\n        tenantUrl: '${vars.tenantUrl}'` : ''}`
  ];
  const lines: string[] = [
    `import { RspfxPlugin } from '@mbsks/rspfx-plugin';`,
    '',
    'export default {',
    "  mode: 'development',",
    '  plugins: [',
    '    new RspfxPlugin({',
    `      name: '${vars.packageName}',`,
    `      version: '${vars.packageVersion}',`,
    `      framework: '${vars.framework}',`,
    `      spfxVersion: '${vars.spfxVersion}',`,
    `      fluent: ${vars.fluent},`,
    `      language: '${vars.language}',`,
    `      styling: '${vars.styling}',`,
    '      dev: {',
    ...devLines,
    '      },',
    '      build: {',
    `        sourcemap: ${configDefaults.build.sourcemap},`,
    `        minify: ${configDefaults.build.minify},`,
    `        splitChunks: ${configDefaults.build.splitChunks},`,
    `        outDir: '${configDefaults.build.outDir}',`,
    `        releaseDir: '${configDefaults.build.releaseDir}'`,
    '      }',
    '    })',
    '  ]',
    '};'
  ];
  return `${lines.join('\n')}\n`;
}

function gitignore(): string {
  return [
    'node_modules/',
    'dist/',
    'release/',
    'temp/',
    '.rspfx/',
    '.rspack-cache/',
    'sharepoint/solution/',
    '*.sppkg',
    '.DS_Store'
  ].join('\n');
}

function readme(vars: TemplateVars): string {
  return [
    `# ${vars.namePascal}`,
    '',
    `An SPFx ${vars.spfxVersion} web part scaffolded with rspfx (${vars.framework}, ${vars.language}, ${vars.styling}).`,
    '',
    '## Commands',
    '',
    '- `rspfx dev` - start the dev server and open the SharePoint workbench',
    '- `rspfx build` - production build to `dist/` and `release/`',
    '- `rspfx package` - package the solution into a `.sppkg` file',
    '- `rspfx deploy` - deploy to the app catalog',
    '- `rspfx analyze` - bundle analysis report',
    '- `rspfx doctor` - environment checks',
    '- `rspfx clean` - remove build output',
    ''
  ].join('\n');
}

function packageSolution(vars: TemplateVars): string {
  return JSON.stringify(
    {
      $schema: 'https://developer.microsoft.com/json-schemas/spfx-build/package-solution.schema.json',
      solution: {
        name: `${vars.name}-client-side-solution`,
        id: vars.solutionId,
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
          shortDescription: { default: `${vars.name} description` },
          longDescription: { default: `${vars.name} description` },
          categories: [],
          screenshotPaths: []
        },
        features: [
          {
            title: `${vars.namePascal} Feature`,
            description: `A feature which activates the Client-Side WebPart named '${vars.namePascal}'`,
            id: vars.featureId,
            version: '1.0.0.0',
            assets: { elementManifests: [], elementFiles: [] }
          }
        ]
      },
      paths: { zippedPackage: `sharepoint/solution/${vars.name}.sppkg` }
    },
    null,
    2
  );
}

function serveJson(vars: TemplateVars): string {
  return JSON.stringify(
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
}

function writeManifestsJson(): string {
  return JSON.stringify(
    {
      $schema: 'https://developer.microsoft.com/json-schemas/spfx-build/write-manifests.schema.json',
      cdnBasePath: ''
    },
    null,
    2
  );
}

function webpartManifest(vars: TemplateVars): string {
  return JSON.stringify(
    {
      $schema: 'https://developer.microsoft.com/json-schemas/spfx/client-side-web-part-manifest.schema.json',
      id: vars.componentId,
      alias: `${vars.namePascal}WebPart`,
      componentType: 'WebPart',
      version: '*',
      manifestVersion: 2,
      safeWithCustomScriptDisabled: true,
      supportedHosts: ['SharePointWebPart', 'TeamsPersonalApp', 'TeamsTab', 'SharePointFullPage'],
      preconfiguredEntries: [
        {
          groupId: '5c31a052-22b4-4f36-8f7d-4b4d8c7c2e7a',
          group: { default: 'Other' },
          title: { default: vars.namePascal },
          description: { default: `${vars.name} web part` },
          officeFabricIconFontName: 'Page',
          properties: { description: vars.name }
        }
      ]
    },
    null,
    2
  );
}

function webpartEntry(vars: TemplateVars): string {
  if (isShadcn(vars)) {
    return shadcnWebpartEntry(vars);
  }
  if (isFrameworkVariant(vars)) {
    return frameworkWebpartEntry(vars);
  }
  const js = vars.language === 'javascript';
  const ts = !js;
  const propsInterface = ts
    ? `\nexport interface I${vars.namePascal}WebPartProps {\n  description: string;\n}\n`
    : '';
  const classDecl = ts
    ? `export default class ${vars.namePascal}WebPart extends BaseClientSideWebPart<I${vars.namePascal}WebPartProps> {`
    : `export default class ${vars.namePascal}WebPart extends BaseClientSideWebPart {`;
  const renderBody = ts
    ? `  public render(): void {\n    this.domElement.innerHTML = \`<section class="\${styles.${vars.namePascal}}">\${${vars.namePascal}({ description: this.properties.description })}</section>\`;\n  }`
    : `  public render() {\n    this.domElement.innerHTML = \`<section class="\${styles.${vars.namePascal}}">\${${vars.namePascal}({ description: this.properties.description })}</section>\`;\n  }`;
  const propertyPane = ts
    ? `  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {\n    return {\n      pages: [\n        {\n          header: { description: '${vars.name}' },\n          groups: [\n            {\n              groupName: 'Settings',\n              groupFields: [\n                PropertyPaneTextField('description', {\n                  label: 'Description'\n                })\n              ]\n            }\n          ]\n        }\n      ]\n    };\n  }`
    : `  protected getPropertyPaneConfiguration() {\n    return {\n      pages: [\n        {\n          header: { description: '${vars.name}' },\n          groups: [\n            {\n              groupName: 'Settings',\n              groupFields: [\n                PropertyPaneTextField('description', {\n                  label: 'Description'\n                })\n              ]\n            }\n          ]\n        }\n      ]\n    };\n  }`;
  return [
    `import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';`,
    `import { PropertyPaneTextField${ts ? ', type IPropertyPaneConfiguration' : ''} } from '@microsoft/sp-property-pane';`,
    `import ${vars.namePascal} from './components/${vars.namePascal}';`,
    `import styles from './styles/${vars.namePascal}.module.${vars.styling === 'css' ? 'css' : 'scss'}';`,
    propsInterface,
    classDecl,
    `  public get dataVersion(): string {\n    return '1.0';\n  }`,
    renderBody,
    propertyPane,
    '}\n'
  ].filter((line) => line !== '').join('\n');
}

function frameworkWebpartEntry(vars: TemplateVars): string {
  const js = vars.language === 'javascript';
  const ts = !js;
  const propsInterface = ts
    ? `export type I${vars.namePascal}WebPartProps = {\n  description: string;\n};\n`
    : '';
  const propertyPane = ts
    ? `  protected override getPropertyPaneConfiguration(): IPropertyPaneConfiguration {\n    return {\n      pages: [\n        {\n          header: { description: '${vars.name}' },\n          groups: [\n            {\n              groupName: 'Settings',\n              groupFields: [\n                PropertyPaneTextField('description', {\n                  label: 'Description'\n                })\n              ]\n            }\n          ]\n        }\n      ]\n    };\n  }`
    : `  getPropertyPaneConfiguration() {\n    return {\n      pages: [\n        {\n          header: { description: '${vars.name}' },\n          groups: [\n            {\n              groupName: 'Settings',\n              groupFields: [\n                PropertyPaneTextField('description', {\n                  label: 'Description'\n                })\n              ]\n            }\n          ]\n        }\n      ]\n    };\n  }`;
  const styleImport =
    vars.styling === 'tailwind'
      ? `import './components/globals.css';`
      : `import styles from './styles/${vars.namePascal}.module.${vars.styling === 'css' ? 'css' : 'scss'}';`;

  switch (vars.framework) {
    case 'vue':
      return [
        ts ? `import type { Component } from 'vue';` : null,
        `import { PropertyPaneTextField${ts ? ', type IPropertyPaneConfiguration' : ''} } from '@microsoft/sp-property-pane';`,
        `import { VueWebPart } from '@mbsks/rspfx-framework-vue/webpart';`,
        `import ${vars.namePascal} from './components/${vars.namePascal}.vue';`,
        styleImport,
        propsInterface,
        ts
          ? `export default class ${vars.namePascal}WebPart extends VueWebPart<I${vars.namePascal}WebPartProps, unknown> {\n  protected renderComponent(props: I${vars.namePascal}WebPartProps): Component {\n    return ${vars.namePascal};\n  }`
          : `export default class ${vars.namePascal}WebPart extends VueWebPart {\n  renderComponent() {\n    return ${vars.namePascal};\n  }`,
        propertyPane,
        '}\n'
      ].filter((line) => line !== null && line !== '').join('\n');
    case 'svelte':
      return [
        `import { PropertyPaneTextField${ts ? ', type IPropertyPaneConfiguration' : ''} } from '@microsoft/sp-property-pane';`,
        `import { SvelteWebPart${ts ? ', type SvelteWebPartComponent' : ''} } from '@mbsks/rspfx-framework-svelte/webpart';`,
        `import ${vars.namePascal} from './components/${vars.namePascal}.svelte';`,
        styleImport,
        propsInterface,
        ts
          ? `export default class ${vars.namePascal}WebPart extends SvelteWebPart<I${vars.namePascal}WebPartProps, unknown> {\n  protected renderComponent(props: I${vars.namePascal}WebPartProps): SvelteWebPartComponent<I${vars.namePascal}WebPartProps> {\n    return { component: ${vars.namePascal}, props };\n  }`
          : `export default class ${vars.namePascal}WebPart extends SvelteWebPart {\n  renderComponent(props) {\n    return { component: ${vars.namePascal}, props };\n  }`,
        propertyPane,
        '}\n'
      ].filter((line) => line !== null && line !== '').join('\n');
    case 'solid':
      return [
        ts ? `import { createComponent, type JSX } from 'solid-js';` : `import { createComponent } from 'solid-js';`,
        `import { PropertyPaneTextField${ts ? ', type IPropertyPaneConfiguration' : ''} } from '@microsoft/sp-property-pane';`,
        `import { SolidWebPart } from '@mbsks/rspfx-framework-solid/webpart';`,
        `import ${vars.namePascal} from './components/${vars.namePascal}';`,
        styleImport,
        propsInterface,
        ts
          ? `export default class ${vars.namePascal}WebPart extends SolidWebPart<I${vars.namePascal}WebPartProps, unknown> {\n  protected renderComponent(props: I${vars.namePascal}WebPartProps): JSX.Element {\n    return createComponent(${vars.namePascal}, props);\n  }`
          : `export default class ${vars.namePascal}WebPart extends SolidWebPart {\n  renderComponent(props) {\n    return createComponent(${vars.namePascal}, props);\n  }`,
        propertyPane,
        '}\n'
      ].filter((line) => line !== null && line !== '').join('\n');
    case 'preact':
      return [
        ts ? `import { h, type ComponentChild } from 'preact';` : `import { h } from 'preact';`,
        `import { PropertyPaneTextField${ts ? ', type IPropertyPaneConfiguration' : ''} } from '@microsoft/sp-property-pane';`,
        `import { PreactWebPart } from '@mbsks/rspfx-framework-preact/webpart';`,
        `import ${vars.namePascal} from './components/${vars.namePascal}';`,
        styleImport,
        propsInterface,
        ts
          ? `export default class ${vars.namePascal}WebPart extends PreactWebPart<I${vars.namePascal}WebPartProps, unknown> {\n  protected renderComponent(props: I${vars.namePascal}WebPartProps): ComponentChild {\n    return h(${vars.namePascal}, props);\n  }`
          : `export default class ${vars.namePascal}WebPart extends PreactWebPart {\n  renderComponent(props) {\n    return h(${vars.namePascal}, props);\n  }`,
        propertyPane,
        '}\n'
      ].filter((line) => line !== null && line !== '').join('\n');
    default:
      return '';
  }
}

function shadcnWebpartEntry(vars: TemplateVars): string {
  const js = vars.language === 'javascript';
  const ts = !js;
  const propsInterface = ts
    ? `\nexport interface I${vars.namePascal}WebPartProps {\n  description: string;\n}\n`
    : '';
  const classDecl = ts
    ? `export default class ${vars.namePascal}WebPart extends BaseClientSideWebPart<I${vars.namePascal}WebPartProps> {`
    : `export default class ${vars.namePascal}WebPart extends BaseClientSideWebPart {`;
  const rootField = ts ? `\n  private _root: Root | null = null;\n` : '';
  const renderBody = ts
    ? `  public render(): void {\n    if (!this._root) {\n      this._root = createRoot(this.domElement);\n    }\n    this._root.render(createElement(${vars.namePascal}, { description: this.properties.description }));\n  }`
    : `  render() {\n    if (!this._root) {\n      this._root = createRoot(this.domElement);\n    }\n    this._root.render(createElement(${vars.namePascal}, { description: this.properties.description }));\n  }`;
  const disposeBody = ts
    ? `  protected onDispose(): void {\n    if (this._root) {\n      this._root.unmount();\n      this._root = null;\n    }\n  }`
    : `  onDispose() {\n    if (this._root) {\n      this._root.unmount();\n      this._root = null;\n    }\n  }`;
  const propertyPane = ts
    ? `  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {\n    return {\n      pages: [\n        {\n          header: { description: '${vars.name}' },\n          groups: [\n            {\n              groupName: 'Settings',\n              groupFields: [\n                PropertyPaneTextField('description', {\n                  label: 'Description'\n                })\n              ]\n            }\n          ]\n        }\n      ]\n    };\n  }`
    : `  protected getPropertyPaneConfiguration() {\n    return {\n      pages: [\n        {\n          header: { description: '${vars.name}' },\n          groups: [\n            {\n              groupName: 'Settings',\n              groupFields: [\n                PropertyPaneTextField('description', {\n                  label: 'Description'\n                })\n              ]\n            }\n          ]\n        }\n      ]\n    };\n  }`;
  return [
    `import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';`,
    `import { PropertyPaneTextField${ts ? ', type IPropertyPaneConfiguration' : ''} } from '@microsoft/sp-property-pane';`,
    ts
      ? `import { createRoot, type Root } from 'react-dom/client';`
      : `import { createRoot } from 'react-dom/client';`,
    `import { createElement } from 'react';`,
    `import ${vars.namePascal} from './components/${vars.namePascal}';`,
    propsInterface,
    classDecl,
    rootField,
    `  public get dataVersion(): string {\n    return '1.0';\n  }`,
    renderBody,
    disposeBody,
    propertyPane,
    '}\n'
  ].filter((line) => line !== '').join('\n');
}

function shadcnComponent(vars: TemplateVars): string {
  const js = vars.language === 'javascript';
  const lines: string[] = [
    `import { useState } from 'react';`,
    `import { Sparkles } from 'lucide-react';`,
    `import './globals.css';`,
    `import { Badge } from './ui/badge';`,
    `import { Button } from './ui/button';`,
    `import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';`,
    `import { Input } from './ui/input';`,
    `import { Label } from './ui/label';`,
    ''
  ];
  if (!js) {
    lines.push(
      `export interface I${vars.namePascal}Props {`,
      '  description: string;',
      '}',
      ''
    );
  }
  lines.push(
    js
      ? `export default function ${vars.namePascal}({ description }) {`
      : `export default function ${vars.namePascal}({ description }: I${vars.namePascal}Props) {`,
    `  const [name, setName] = useState('');`,
    `  const [greeting, setGreeting] = useState('');`,
    '',
    '  return (',
    '    <Card className="w-full max-w-md">',
    '      <CardHeader>',
    '        <Badge className="w-fit gap-1.5">',
    '          <Sparkles className="size-3" />',
    '          rspfx · shadcn/ui',
    '        </Badge>',
    '        <CardTitle>{description}</CardTitle>',
    '        <CardDescription>',
    '          Change the Description property in the property pane to update this title.',
    '        </CardDescription>',
    '      </CardHeader>',
    '      <CardContent className="space-y-4">',
    '        <div className="grid gap-2">',
    '          <Label htmlFor="name">Name</Label>',
    '          <Input',
    '            id="name"',
    '            placeholder="Type your name"',
    '            value={name}',
    '            onChange={(event) => setName(event.target.value)}',
    '          />',
    '        </div>',
    "        {greeting && <p className=\"text-sm text-muted-foreground\">{greeting}</p>}",
    '      </CardContent>',
    '      <CardFooter className="justify-end gap-2">',
    '        <Button type="button" variant="outline"',
    '          onClick={() => { setName(\'\'); setGreeting(\'\'); }}',
    '        >',
    '          Clear',
    '        </Button>',
    '        <Button type="button"',
    "          onClick={() => setGreeting(name.trim() ? 'Hello, ' + name.trim() + '!' : 'Hello, world!')}",
    '        >',
    '          Greet',
    '        </Button>',
    '      </CardFooter>',
    '    </Card>',
    '  );',
    '}',
    ''
  );
  return lines.join('\n');
}

function component(vars: TemplateVars): string {
  if (isShadcn(vars)) {
    return shadcnComponent(vars);
  }
  if (isFrameworkVariant(vars)) {
    return frameworkComponent(vars);
  }
  if (vars.language === 'typescript') {
    return `export interface I${vars.namePascal}Props {\n  description: string;\n}\n\nexport default function ${vars.namePascal}(props: I${vars.namePascal}Props): string {\n  return \`<div class="${vars.name}">\${props.description}</div>\`;\n}\n`;
  }
  return `export default function ${vars.namePascal}(props) {\n  return \`<div class="${vars.name}">\${props.description}</div>\`;\n}\n`;
}

const TAILWIND_CARD =
  'mx-auto w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm';
const TAILWIND_TITLE = 'mb-2 text-lg font-semibold text-gray-900';
const TAILWIND_DESCRIPTION = 'text-sm text-gray-600';

function frameworkComponent(vars: TemplateVars): string {
  const js = vars.language === 'javascript';
  const tailwind = vars.styling === 'tailwind';
  switch (vars.framework) {
    case 'vue':
      return vueComponent(vars, js, tailwind);
    case 'svelte':
      return svelteComponent(js, tailwind);
    case 'solid':
      return solidComponent(vars, js, tailwind);
    case 'preact':
      return preactComponent(vars, js, tailwind);
    default:
      return '';
  }
}

function vueComponent(vars: TemplateVars, js: boolean, tailwind: boolean): string {
  const script = js
    ? '<script setup>\ndefineProps([\'description\']);\n</script>'
    : '<script setup lang="ts">\ndefineProps<{ description: string }>();\n</script>';
  const content = tailwind
    ? `<div class="${TAILWIND_CARD}">\n    <h2 class="${TAILWIND_TITLE}">{{ description }}</h2>\n    <p class="${TAILWIND_DESCRIPTION}">\n      Change the Description property in the property pane to update this title.\n    </p>\n  </div>`
    : `<div class="card">\n    <h2 class="card-title">{{ description }}</h2>\n    <p class="card-description">\n      Change the Description property in the property pane to update this title.\n    </p>\n  </div>`;
  const style = tailwind
    ? ''
    : `\n\n<style scoped>\n.card {\n  max-width: 480px;\n  margin: 24px auto;\n  padding: 24px;\n  border: 1px solid #e1dfdd;\n  border-radius: 6px;\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);\n  font-family: 'Segoe UI', sans-serif;\n}\n\n.card-title {\n  margin: 0 0 12px 0;\n  color: #323130;\n  font-size: 20px;\n}\n\n.card-description {\n  margin: 0;\n  color: #605e5c;\n  font-size: 14px;\n}\n</style>`;
  return `<template>\n  ${content}\n</template>\n\n${script}${style}\n`;
}

function svelteComponent(js: boolean, tailwind: boolean): string {
  const markup = tailwind
    ? `<div class="${TAILWIND_CARD}">\n  <h2 class="${TAILWIND_TITLE}">{description}</h2>\n  <p class="${TAILWIND_DESCRIPTION}">\n    Change the Description property in the property pane to update this title.\n  </p>\n</div>`
    : `<div class="card">\n  <h2 class="card-title">{description}</h2>\n  <p class="card-description">\n    Change the Description property in the property pane to update this title.\n  </p>\n</div>`;
  const style = tailwind
    ? ''
    : `\n\n<style>\n  .card {\n    max-width: 480px;\n    margin: 24px auto;\n    padding: 24px;\n    border: 1px solid #e1dfdd;\n    border-radius: 6px;\n    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);\n    font-family: 'Segoe UI', sans-serif;\n  }\n\n  .card-title {\n    margin: 0 0 12px 0;\n    color: #323130;\n    font-size: 20px;\n  }\n\n  .card-description {\n    margin: 0;\n    color: #605e5c;\n    font-size: 14px;\n  }\n</style>`;
  return `<script>\n  export let description = '';\n</script>\n\n${markup}${style}\n`;
}

function solidComponent(vars: TemplateVars, js: boolean, tailwind: boolean): string {
  const lines: string[] = [];
  if (!js) {
    lines.push(`import type { JSX } from 'solid-js';`, '', `export interface I${vars.namePascal}Props {`, '  description: string;', '}', '');
  }
  if (tailwind) {
    lines.push(
      js
        ? `export default function ${vars.namePascal}(props) {\n  return (\n    <div class="${TAILWIND_CARD}">\n      <h2 class="${TAILWIND_TITLE}">{props.description}</h2>\n      <p class="${TAILWIND_DESCRIPTION}">\n        Change the Description property in the property pane to update this title.\n      </p>\n    </div>\n  );\n}`
        : `export default function ${vars.namePascal}(props: I${vars.namePascal}Props): JSX.Element {\n  return (\n    <div class="${TAILWIND_CARD}">\n      <h2 class="${TAILWIND_TITLE}">{props.description}</h2>\n      <p class="${TAILWIND_DESCRIPTION}">\n        Change the Description property in the property pane to update this title.\n      </p>\n    </div>\n  );\n}`
    );
  } else {
    const styleDecls = [
      `const cardStyle = {\n  'max-width': '480px',\n  margin: '24px auto',\n  padding: '24px',\n  border: '1px solid #e1dfdd',\n  'border-radius': '6px',\n  'box-shadow': '0 2px 8px rgba(0, 0, 0, 0.08)',\n  'font-family': '"Segoe UI", sans-serif'\n};`,
      `const titleStyle = {\n  margin: '0 0 12px 0',\n  color: '#323130',\n  'font-size': '20px'\n};`,
      `const descriptionStyle = {\n  margin: '0',\n  color: '#605e5c',\n  'font-size': '14px'\n};`
    ];
    lines.push(
      js
        ? `export default function ${vars.namePascal}(props) {\n  return (\n    <div class="card" style={cardStyle}>\n      <h2 style={titleStyle}>{props.description}</h2>\n      <p style={descriptionStyle}>\n        Change the Description property in the property pane to update this title.\n      </p>\n    </div>\n  );\n}`
        : `export default function ${vars.namePascal}(props: I${vars.namePascal}Props): JSX.Element {\n  return (\n    <div class="card" style={cardStyle}>\n      <h2 style={titleStyle}>{props.description}</h2>\n      <p style={descriptionStyle}>\n        Change the Description property in the property pane to update this title.\n      </p>\n    </div>\n  );\n}`,
      '',
      ...styleDecls,
      ''
    );
  }
  return lines.join('\n');
}

function preactComponent(vars: TemplateVars, js: boolean, tailwind: boolean): string {
  const lines: string[] = [];
  if (!js) {
    lines.push(`import type { JSX } from 'preact';`, '', `export interface I${vars.namePascal}Props {`, '  description: string;', '}', '');
  }
  if (tailwind) {
    lines.push(
      js
        ? `export default function ${vars.namePascal}(props) {\n  return (\n    <div className="${TAILWIND_CARD}">\n      <h2 className="${TAILWIND_TITLE}">{props.description}</h2>\n      <p className="${TAILWIND_DESCRIPTION}">\n        Change the Description property in the property pane to update this title.\n      </p>\n    </div>\n  );\n}`
        : `export default function ${vars.namePascal}(props: I${vars.namePascal}Props): JSX.Element {\n  return (\n    <div className="${TAILWIND_CARD}">\n      <h2 className="${TAILWIND_TITLE}">{props.description}</h2>\n      <p className="${TAILWIND_DESCRIPTION}">\n        Change the Description property in the property pane to update this title.\n      </p>\n    </div>\n  );\n}`
    );
  } else {
    const styleDecls = [
      `const cardStyle = {\n  maxWidth: '480px',\n  margin: '24px auto',\n  padding: '24px',\n  border: '1px solid #e1dfdd',\n  borderRadius: '6px',\n  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',\n  fontFamily: '"Segoe UI", sans-serif'\n};`,
      `const titleStyle = {\n  margin: '0 0 12px 0',\n  color: '#323130',\n  fontSize: '20px'\n};`,
      `const descriptionStyle = {\n  margin: '0',\n  color: '#605e5c',\n  fontSize: '14px'\n};`
    ];
    lines.push(
      js
        ? `export default function ${vars.namePascal}(props) {\n  return (\n    <div className="card" style={cardStyle}>\n      <h2 style={titleStyle}>{props.description}</h2>\n      <p style={descriptionStyle}>\n        Change the Description property in the property pane to update this title.\n      </p>\n    </div>\n  );\n}`
        : `export default function ${vars.namePascal}(props: I${vars.namePascal}Props): JSX.Element {\n  return (\n    <div className="card" style={cardStyle}>\n      <h2 style={titleStyle}>{props.description}</h2>\n      <p style={descriptionStyle}>\n        Change the Description property in the property pane to update this title.\n      </p>\n    </div>\n  );\n}`,
      '',
      ...styleDecls,
      ''
    );
  }
  return lines.join('\n');
}

function stylesheet(vars: TemplateVars): string {
  const rule = vars.styling === 'tailwind' ? '@apply text-lg font-semibold;' : 'color: rgb(0, 120, 212);';
  return `\n.${vars.namePascal} {\n  ${rule}\n}\n`;
}

function globalsCss(): string {
  return [
    '@import "tailwindcss";',
    '',
    ':root {',
    '  --background: oklch(1 0 0);',
    '  --foreground: oklch(0.145 0 0);',
    '  --card: oklch(1 0 0);',
    '  --card-foreground: oklch(0.145 0 0);',
    '  --primary: oklch(0.205 0 0);',
    '  --primary-foreground: oklch(0.985 0 0);',
    '  --border: oklch(0.922 0 0);',
    '  --muted: oklch(0.97 0 0);',
    '  --muted-foreground: oklch(0.556 0 0);',
    '  --accent: oklch(0.97 0 0);',
    '  --accent-foreground: oklch(0.205 0 0);',
    '  --radius: 0.625rem;',
    '}',
    '',
    '@theme inline {',
    '  --color-background: var(--background);',
    '  --color-foreground: var(--foreground);',
    '  --color-card: var(--card);',
    '  --color-card-foreground: var(--card-foreground);',
    '  --color-primary: var(--primary);',
    '  --color-primary-foreground: var(--primary-foreground);',
    '  --color-border: var(--border);',
    '  --color-muted: var(--muted);',
    '  --color-muted-foreground: var(--muted-foreground);',
    '  --color-accent: var(--accent);',
    '  --color-accent-foreground: var(--accent-foreground);',
    '  --radius-sm: calc(var(--radius) - 4px);',
    '  --radius-md: calc(var(--radius) - 2px);',
    '  --radius-lg: var(--radius);',
    '  --radius-xl: calc(var(--radius) + 4px);',
    '}',
    ''
  ].join('\n');
}

function utilsTs(): string {
  return [
    `import { clsx, type ClassValue } from 'clsx';`,
    `import { twMerge } from 'tailwind-merge';`,
    '',
    'export function cn(...inputs: ClassValue[]): string {',
    '  return twMerge(clsx(inputs));',
    '}',
    ''
  ].join('\n');
}

function utilsJs(): string {
  return [
    `import { clsx } from 'clsx';`,
    `import { twMerge } from 'tailwind-merge';`,
    '',
    'export function cn(...inputs) {',
    '  return twMerge(clsx(inputs));',
    '}',
    ''
  ].join('\n');
}

const buttonClasses = [
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all',
  'shrink-0 [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
  'outline-none focus-visible:border-primary focus-visible:ring-primary/50 focus-visible:ring-[3px]',
  'disabled:pointer-events-none disabled:opacity-50'
].join(' ');

const buttonVariantsMap = [
  "default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90'",
  "outline: 'border-border bg-card shadow-xs hover:bg-accent hover:text-accent-foreground'",
  "secondary: 'bg-muted text-muted-foreground shadow-xs hover:bg-accent hover:text-accent-foreground'",
  "ghost: 'hover:bg-accent hover:text-accent-foreground'",
  "link: 'text-primary underline-offset-4 hover:underline'"
].join(',\n        ');

const buttonSizesMap = [
  "default: 'h-9 px-4 py-2 has-[>svg]:px-3'",
  "sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5'",
  "lg: 'h-10 rounded-md px-6 has-[>svg]:px-4'",
  "icon: 'size-9'"
].join(',\n        ');

function buttonTsx(): string {
  return [
    "import * as React from 'react';",
    "import { Slot } from '@radix-ui/react-slot';",
    "import { cva, type VariantProps } from 'class-variance-authority';",
    "import { cn } from '../lib/utils';",
    '',
    'const buttonVariants = cva(',
    `  "${buttonClasses}",`,
    '  {',
    '    variants: {',
    '      variant: {',
    `        ${buttonVariantsMap}`,
    '      },',
    '      size: {',
    `        ${buttonSizesMap}`,
    '      }',
    '    },',
    '    defaultVariants: {',
    "      variant: 'default',",
    "      size: 'default'",
    '    }',
    '  }',
    ');',
    '',
    'function Button({',
    '  className,',
    '  variant,',
    '  size,',
    '  asChild = false,',
    '  ...props',
    "}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {",
    "  const Comp = asChild ? Slot : 'button';",
    "  return <Comp data-slot=\"button\" className={cn(buttonVariants({ variant, size }), className)} {...props} />;",
    '}',
    '',
    'export { Button, buttonVariants };',
    ''
  ].join('\n');
}

function buttonJsx(): string {
  return [
    "import * as React from 'react';",
    "import { Slot } from '@radix-ui/react-slot';",
    "import { cva } from 'class-variance-authority';",
    "import { cn } from '../lib/utils';",
    '',
    'const buttonVariants = cva(',
    `  "${buttonClasses}",`,
    '  {',
    '    variants: {',
    '      variant: {',
    `        ${buttonVariantsMap}`,
    '      },',
    '      size: {',
    `        ${buttonSizesMap}`,
    '      }',
    '    },',
    '    defaultVariants: {',
    "      variant: 'default',",
    "      size: 'default'",
    '    }',
    '  }',
    ');',
    '',
    'function Button({ className, variant, size, asChild = false, ...props }) {',
    "  const Comp = asChild ? Slot : 'button';",
    "  return <Comp data-slot=\"button\" className={cn(buttonVariants({ variant, size }), className)} {...props} />;",
    '}',
    '',
    'export { Button, buttonVariants };',
    ''
  ].join('\n');
}

function cardTsx(): string {
  return [
    "import * as React from 'react';",
    "import { cn } from '../lib/utils';",
    '',
    "function Card({ className, ...props }: React.ComponentProps<'div'>) {",
    '  return (',
    '    <div',
    '      data-slot="card"',
    "      className={cn('bg-card text-card-foreground flex flex-col gap-6 rounded-xl border-border py-6 shadow-sm', className)}",
    '      {...props}',
    '    />',
    '  );',
    '}',
    '',
    "function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {",
    '  return (',
    '    <div',
    '      data-slot="card-header"',
    "      className={cn('grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6', className)}",
    '      {...props}',
    '    />',
    '  );',
    '}',
    '',
    "function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {",
    '  return (',
    '    <div',
    '      data-slot="card-title"',
    "      className={cn('leading-none font-semibold', className)}",
    '      {...props}',
    '    />',
    '  );',
    '}',
    '',
    "function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {",
    '  return (',
    '    <div',
    '      data-slot="card-description"',
    "      className={cn('text-muted-foreground text-sm', className)}",
    '      {...props}',
    '    />',
    '  );',
    '}',
    '',
    "function CardContent({ className, ...props }: React.ComponentProps<'div'>) {",
    '  return <div data-slot="card-content" className={cn(\'px-6\', className)} {...props} />;',
    '}',
    '',
    "function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {",
    '  return <div data-slot="card-footer" className={cn(\'flex items-center px-6\', className)} {...props} />;',
    '}',
    '',
    'export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };',
    ''
  ].join('\n');
}

function cardJsx(): string {
  return [
    "import { cn } from '../lib/utils';",
    '',
    'function Card({ className, ...props }) {',
    '  return (',
    '    <div',
    '      data-slot="card"',
    "      className={cn('bg-card text-card-foreground flex flex-col gap-6 rounded-xl border-border py-6 shadow-sm', className)}",
    '      {...props}',
    '    />',
    '  );',
    '}',
    '',
    'function CardHeader({ className, ...props }) {',
    '  return (',
    '    <div',
    '      data-slot="card-header"',
    "      className={cn('grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6', className)}",
    '      {...props}',
    '    />',
    '  );',
    '}',
    '',
    'function CardTitle({ className, ...props }) {',
    '  return (',
    '    <div',
    '      data-slot="card-title"',
    "      className={cn('leading-none font-semibold', className)}",
    '      {...props}',
    '    />',
    '  );',
    '}',
    '',
    'function CardDescription({ className, ...props }) {',
    '  return (',
    '    <div',
    '      data-slot="card-description"',
    "      className={cn('text-muted-foreground text-sm', className)}",
    '      {...props}',
    '    />',
    '  );',
    '}',
    '',
    'function CardContent({ className, ...props }) {',
    "  return <div data-slot=\"card-content\" className={cn('px-6', className)} {...props} />;",
    '}',
    '',
    'function CardFooter({ className, ...props }) {',
    "  return <div data-slot=\"card-footer\" className={cn('flex items-center px-6', className)} {...props} />;",
    '}',
    '',
    'export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };',
    ''
  ].join('\n');
}

function badgeTsx(): string {
  return [
    "import * as React from 'react';",
    "import { Slot } from '@radix-ui/react-slot';",
    "import { cva, type VariantProps } from 'class-variance-authority';",
    "import { cn } from '../lib/utils';",
    '',
    'const badgeVariants = cva(',
    "  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1 [&>svg]:size-3 [&>svg]:pointer-events-none',",
    '  {',
    '    variants: {',
    '      variant: {',
    "        default: 'border-transparent bg-primary text-primary-foreground',",
    "        secondary: 'border-transparent bg-muted text-muted-foreground',",
    "        outline: 'text-foreground'",
    '      }',
    '    },',
    '    defaultVariants: {',
    "      variant: 'default'",
    '    }',
    '  }',
    ');',
    '',
    'function Badge({',
    '  className,',
    '  variant,',
    '  asChild = false,',
    '  ...props',
    "}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {",
    "  const Comp = asChild ? Slot : 'span';",
    "  return <Comp data-slot=\"badge\" className={cn(badgeVariants({ variant }), className)} {...props} />;",
    '}',
    '',
    'export { Badge, badgeVariants };',
    ''
  ].join('\n');
}

function badgeJsx(): string {
  return [
    "import * as React from 'react';",
    "import { Slot } from '@radix-ui/react-slot';",
    "import { cva } from 'class-variance-authority';",
    "import { cn } from '../lib/utils';",
    '',
    'const badgeVariants = cva(',
    "  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1 [&>svg]:size-3 [&>svg]:pointer-events-none',",
    '  {',
    '    variants: {',
    '      variant: {',
    "        default: 'border-transparent bg-primary text-primary-foreground',",
    "        secondary: 'border-transparent bg-muted text-muted-foreground',",
    "        outline: 'text-foreground'",
    '      }',
    '    },',
    '    defaultVariants: {',
    "      variant: 'default'",
    '    }',
    '  }',
    ');',
    '',
    'function Badge({ className, variant, asChild = false, ...props }) {',
    "  const Comp = asChild ? Slot : 'span';",
    "  return <Comp data-slot=\"badge\" className={cn(badgeVariants({ variant }), className)} {...props} />;",
    '}',
    '',
    'export { Badge, badgeVariants };',
    ''
  ].join('\n');
}

function inputTsx(): string {
  return [
    "import * as React from 'react';",
    "import { cn } from '../lib/utils';",
    '',
    "function Input({ className, type, ...props }: React.ComponentProps<'input'>) {",
    '  return (',
    '    <input',
    '      type={type}',
    '      data-slot="input"',
    "      className={cn(",
    "        'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',",
    "        'flex h-9 w-full min-w-0 rounded-md border-border bg-transparent px-3 py-1 text-base shadow-xs',",
    "        'transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground md:text-sm',",
    "        'focus-visible:border-primary focus-visible:ring-primary/50 focus-visible:ring-[3px]',",
    "        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',",
    '        className',
    '      )}',
    '      {...props}',
    '    />',
    '  );',
    '}',
    '',
    'export { Input };',
    ''
  ].join('\n');
}

function inputJsx(): string {
  return [
    "import { cn } from '../lib/utils';",
    '',
    'function Input({ className, type, ...props }) {',
    '  return (',
    '    <input',
    '      type={type}',
    '      data-slot="input"',
    "      className={cn(",
    "        'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',",
    "        'flex h-9 w-full min-w-0 rounded-md border-border bg-transparent px-3 py-1 text-base shadow-xs',",
    "        'transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground md:text-sm',",
    "        'focus-visible:border-primary focus-visible:ring-primary/50 focus-visible:ring-[3px]',",
    "        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',",
    '        className',
    '      )}',
    '      {...props}',
    '    />',
    '  );',
    '}',
    '',
    'export { Input };',
    ''
  ].join('\n');
}

function labelTsx(): string {
  return [
    "import * as React from 'react';",
    "import * as LabelPrimitive from '@radix-ui/react-label';",
    "import { cn } from '../lib/utils';",
    '',
    'function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {',
    '  return (',
    '    <LabelPrimitive.Root',
    '      data-slot="label"',
    "      className={cn('flex items-center gap-2 text-sm leading-none font-medium select-none', className)}",
    '      {...props}',
    '    />',
    '  );',
    '}',
    '',
    'export { Label };',
    ''
  ].join('\n');
}

function labelJsx(): string {
  return [
    "import * as LabelPrimitive from '@radix-ui/react-label';",
    "import { cn } from '../lib/utils';",
    '',
    'function Label({ className, ...props }) {',
    '  return (',
    '    <LabelPrimitive.Root',
    '      data-slot="label"',
    "      className={cn('flex items-center gap-2 text-sm leading-none font-medium select-none', className)}",
    '      {...props}',
    '    />',
    '  );',
    '}',
    '',
    'export { Label };',
    ''
  ].join('\n');
}

function declarations(vars: TemplateVars): string {
  const lines = [
    `declare module '*.module.scss' {`,
    `  const classes: Record<string, string>;`,
    `  export default classes;`,
    `}`,
    ``,
    `declare module '*.module.css' {`,
    `  const classes: Record<string, string>;`,
    `  export default classes;`,
    `}`
  ];
  if (vars.framework === 'vue') {
    lines.push(
      ``,
      `declare module '*.vue' {`,
      `  import type { DefineComponent } from 'vue';`,
      ``,
      `  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;`,
      `  export default component;`,
      `}`
    );
  }
  if (vars.framework === 'svelte') {
    lines.push(
      ``,
      `declare module '*.svelte' {`,
      `  import type { ComponentConstructorOptions, SvelteComponentTyped } from 'svelte';`,
      ``,
      `  const component: new (options: ComponentConstructorOptions<Record<string, unknown>>) => SvelteComponentTyped<Record<string, unknown>>;`,
      `  export default component;`,
      `}`
    );
  }
  return lines.join('\n');
}

function playgroundHtml(vars: TemplateVars): string {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8" />',
    `  <title>${vars.namePascal} playground</title>`,
    '</head>',
    '<body>',
    '  <div id="root"></div>',
    '  <script type="module" src="./main.ts"></script>',
    '</body>',
    '</html>'
  ].join('\n');
}

function playgroundMain(vars: TemplateVars): string {
  return [
    `import { DisplayMode } from '@microsoft/sp-core-library';`,
    `import ${vars.namePascal}WebPart from '../src/webparts/${vars.name}/${vars.name}WebPart';`,
    '',
    'const root = document.getElementById(\'root\');',
    'if (root) {',
    `  const webPart = new ${vars.namePascal}WebPart();`,
    '  (webPart as unknown as {',
    '    _internalInitialize(',
    '      context: { domElement: HTMLElement; manifest: { id: string; alias: string } },',
    '      addedFromPersistedData: boolean,',
    '      mode: DisplayMode',
    '    ): void;',
    '  })._internalInitialize(',
    `    { domElement: root, manifest: { id: '${vars.componentId}', alias: '${vars.namePascal}WebPart' } },`,
    '    false,',
    '    DisplayMode.Read',
    '  );',
    '  (webPart as unknown as { _internalDeserialize(data: unknown): void })._internalDeserialize({',
    `    properties: { description: '${vars.name}' },`,
    "    dataVersion: '1.0'",
    '  });',
    '  webPart.render();',
    '}'
  ].join('\n');
}
