import fs from 'node:fs';
import path from 'node:path';
import { configDefaults, spfxNpmVersion } from '@mbsks/rspfx-core';
import { solidPng } from './png.js';
import { EXTENSION_TYPES } from './component-types.js';
import type { ExtensionType, ComponentType } from './component-types.js';
import type { TemplateVars } from './types.js';
import { componentLabel } from './component-label.js';
import {
  configJson,
  extensionManifest,
  extensionSpDeps,
  extensionSuffix,
  libraryManifest,
  packageSolution,
  serveJson,
  teamsManifest,
  webpartManifest,
  writeManifestsJson
} from './manifests.js';

// Re-export public types/constants for API stability (barrel).
export { EXTENSION_TYPES } from './component-types.js';
export type { ExtensionType, ComponentType } from './component-types.js';
export type { TemplateVars } from './types.js';
export { componentLabel } from './component-label.js';
export {
  configJson,
  extensionManifest,
  extensionSuffix,
  libraryManifest,
  packageSolution,
  serveJson,
  teamsManifest,
  webpartManifest,
  writeManifestsJson
} from './manifests.js';

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

interface TemplateFile {
  path: string;
  content: string | Buffer;
}

const FRAMEWORK_VARIANTS = ['vue', 'svelte', 'solid', 'preact'] as const;

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

function isExtension(vars: TemplateVars): boolean {
  return (EXTENSION_TYPES as readonly string[]).includes(vars.componentType);
}

function isLibrary(vars: TemplateVars): boolean {
  return vars.componentType === 'library';
}

function buildFiles(vars: TemplateVars): TemplateFile[] {
  const files: TemplateFile[] = [
    { path: 'package.json', content: packageJson(vars) },
    { path: 'tsconfig.json', content: tsconfigJson(vars) },
    { path: 'rspack.config.ts', content: rspackConfig(vars) },
    { path: '.gitignore', content: gitignore() },
    { path: '.npmrc', content: npmrc() },
    { path: 'README.md', content: readme(vars) },
    { path: 'config/package-solution.json', content: packageSolution(vars) },
    { path: 'config/serve.json', content: serveJson(vars) },
    { path: 'config/write-manifests.json', content: writeManifestsJson() },
    { path: 'sharepoint/assets/.gitkeep', content: '' },
    { path: 'assets/favicon.svg', content: faviconSvg() },
    { path: 'src/index.ts', content: 'export {};\n' },
    { path: 'src/rspfx-env.d.ts', content: declarations(vars) }
  ];
  if (isLibrary(vars)) {
    files.push(
      { path: `src/libraries/${vars.name}/${vars.name}.manifest.json`, content: libraryManifest(vars) },
      { path: `src/libraries/${vars.name}/${vars.namePascal}Library.ts`, content: libraryEntry(vars) }
    );
    return files;
  }
  if (isExtension(vars)) {
    files.push(
      { path: `src/extensions/${vars.name}/${vars.name}.manifest.json`, content: extensionManifest(vars) },
      { path: `src/extensions/${vars.name}/${vars.namePascal}${extensionSuffix(vars)}.ts`, content: extensionEntry(vars) }
    );
    return files;
  }
  files.push(
    { path: 'config/config.json', content: configJson(vars) },
    { path: `src/webparts/${vars.name}/${vars.name}.manifest.json`, content: webpartManifest(vars) },
    { path: `src/webparts/${vars.name}/${vars.name}WebPart.${vars.language === 'javascript' ? 'js' : 'ts'}`, content: webpartEntry(vars) },
    { path: `src/webparts/${vars.name}/components/${vars.namePascal}${componentExtension(vars)}`, content: component(vars) },
    { path: `src/webparts/${vars.name}/assets/.gitkeep`, content: '' },
    { path: `src/webparts/${vars.name}/loc/en-us.ts`, content: localeStrings(vars, 'en-us', 'Description') },
    { path: `src/webparts/${vars.name}/loc/fr-fr.ts`, content: localeStrings(vars, 'fr-fr', 'La description') }
  );
  if (vars.teams !== false) {
    files.push(
      { path: `teams/${vars.componentId}_color.png`, content: solidPng(192, 192, [0, 120, 212]) },
      { path: `teams/${vars.componentId}_outline.png`, content: solidPng(32, 32, [50, 49, 48]) },
      { path: 'teams/manifest.json', content: teamsManifest(vars) }
    );
  }
  files.push({
    path: `src/webparts/${vars.name}/styles/${vars.namePascal}.module.scss`,
    content: stylesheet(vars)
  });
  return files;
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
  const spVersion = spfxNpmVersion(vars.spfxVersion);
  const framework = frameworkDeps(vars);
  const spDeps = isLibrary(vars)
    ? { '@microsoft/sp-core-library': spVersion }
    : isExtension(vars)
      ? extensionSpDeps(vars)
      : {
          '@microsoft/sp-core-library': spVersion,
          '@microsoft/sp-webpart-base': spVersion,
          '@microsoft/sp-property-pane': spVersion
        };
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
        ...spDeps,
        ...framework
      },
      devDependencies: {
        '@mbsks/rspfx-plugin': `^${TOOLCHAIN_VERSION}`,
        '@mbsks/rspfx-cli': `^${TOOLCHAIN_VERSION}`,
        '@rspack/cli': '^1.2.0',
        typescript: '^5.7.0'
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
        ...(isExtension(vars) ? { experimentalDecorators: true } : {}),
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
    `        openBrowser: ${configDefaults.dev.openBrowser}${vars.tenantUrl ? `,\n        tenantUrl: ${JSON.stringify(vars.tenantUrl)}` : ''}`
  ];
  const lines: string[] = [
    `import { RspfxPlugin, rspfxResolve } from '@mbsks/rspfx-plugin';`,
    '',
    'export default {',
    "  mode: 'development',",
    '  resolve: rspfxResolve(),',
    '  plugins: [',
    '    new RspfxPlugin({',
    `      name: '${vars.packageName}',`,
    `      version: '${vars.packageVersion}',`,
    `      framework: '${vars.framework}',`,
    `      spfxVersion: '${vars.spfxVersion}',`,
    ...(vars.fluent ? [`      fluent: ${vars.fluent},`] : []),
    `      language: '${vars.language}',`,
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

/**
 * The @microsoft/sp-* packages declare exact-version peers on each other;
 * npm >= 7 fails those with ERESOLVE. The official SPFx community fix is
 * legacy-peer-deps, which also auto-installs framework peers (react, vue...).
 */
function npmrc(): string {
  return 'legacy-peer-deps=true\n';
}

function readme(vars: TemplateVars): string {
  const build = isExtension(vars) || isLibrary(vars)
    ? `An SPFx ${vars.spfxVersion} ${componentLabel(vars)} scaffolded with rspfx (vanilla, TypeScript).`
    : `An SPFx ${vars.spfxVersion} ${componentLabel(vars)} scaffolded with rspfx (${vars.framework}, ${vars.language}).`;
  return [
    `# ${vars.namePascal}`,
    '',
    build,
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

function localeStrings(_vars: TemplateVars, _locale: string, description: string): string {
  return ['define([], () => {', '  return {', `    "Description": "${description}"`, '  };', '});', ''].join('\n');
}

function extensionEntry(vars: TemplateVars): string {
  switch (vars.componentType) {
    case 'applicationcustomizer':
      return applicationCustomizerEntry(vars);
    case 'fieldcustomizer':
      return fieldCustomizerEntry(vars);
    case 'listviewcommandset':
      return listViewCommandSetEntry(vars);
    case 'formcustomizer':
      return formCustomizerEntry(vars);
    default:
      throw new Error(`Unexpected component type: ${vars.componentType}`);
  }
}

function libraryEntry(vars: TemplateVars): string {
  return [
    `export default class ${vars.namePascal}Library {`,
    `  public name(): string {`,
    `    return '${vars.namePascal}';`,
    `  }`,
    `}`,
    ``
  ].join('\n');
}

function applicationCustomizerEntry(vars: TemplateVars): string {
  const logSource = `${vars.namePascal}ApplicationCustomizer`;
  return [
    `import { Log } from '@microsoft/sp-core-library';`,
    `import { override } from '@microsoft/decorators';`,
    `import { BaseApplicationCustomizer } from '@microsoft/sp-application-base';`,
    ``,
    `const LOG_SOURCE: string = '${logSource}';`,
    ``,
    `export default class ${logSource} extends BaseApplicationCustomizer {`,
    `  @override`,
    `  public onInit(): Promise<void> {`,
    `    Log.info(LOG_SOURCE, 'Initialized ${vars.name}');`,
    `    return super.onInit();`,
    `  }`,
    ``,
    `  @override`,
    `  public onRender(): void {`,
    `    const placeholder = this.context.placeholderProvider.tryCreateContent('PageHeader');`,
    `    if (placeholder) {`,
    `      placeholder.domElement.innerHTML = \`<div>Hello from \${LOG_SOURCE}</div>\`;`,
    `    }`,
    `  }`,
    `}`,
    ``
  ].join('\n');
}

function fieldCustomizerEntry(vars: TemplateVars): string {
  const logSource = `${vars.namePascal}FieldCustomizer`;
  return [
    `import { Log } from '@microsoft/sp-core-library';`,
    `import { override } from '@microsoft/decorators';`,
    `import {`,
    `  BaseFieldCustomizer,`,
    `  type IFieldCustomizerCellEventParameters`,
    `} from '@microsoft/sp-listview-extensibility';`,
    ``,
    `const LOG_SOURCE: string = '${logSource}';`,
    ``,
    `export default class ${logSource} extends BaseFieldCustomizer<{}> {`,
    `  @override`,
    `  public onInit(): Promise<void> {`,
    `    Log.info(LOG_SOURCE, 'Initialized ${vars.name}');`,
    `    return super.onInit();`,
    `  }`,
    ``,
    `  @override`,
    `  public onRenderCell(event: IFieldCustomizerCellEventParameters): void {`,
    `    // escaped: fieldValue is user-controlled — use textContent, not innerHTML`,
    `    event.domElement.textContent = event.fieldValue != null ? String(event.fieldValue) : '';`,
    `  }`,
    `}`,
    ``
  ].join('\n');
}

function listViewCommandSetEntry(vars: TemplateVars): string {
  const logSource = `${vars.namePascal}CommandSet`;
  return [
    `import { Log } from '@microsoft/sp-core-library';`,
    `import { override } from '@microsoft/decorators';`,
    `import {`,
    `  BaseListViewCommandSet,`,
    `  type IListViewCommandSetExecuteEventParameters,`,
    `  type IListViewCommandSetListViewUpdatedEventParameters`,
    `} from '@microsoft/sp-listview-extensibility';`,
    ``,
    `const LOG_SOURCE: string = '${logSource}';`,
    ``,
    `export default class ${logSource} extends BaseListViewCommandSet<{}> {`,
    `  @override`,
    `  public onInit(): Promise<void> {`,
    `    Log.info(LOG_SOURCE, 'Initialized ${vars.name}');`,
    `    return Promise.resolve();`,
    `  }`,
    ``,
    `  @override`,
    `  public onListViewUpdated(event: IListViewCommandSetListViewUpdatedEventParameters): void {`,
    `    Log.info(LOG_SOURCE, 'List view updated');`,
    `  }`,
    ``,
    `  @override`,
    `  public onExecute(event: IListViewCommandSetExecuteEventParameters): void {`,
    `    Log.info(LOG_SOURCE, \`Command \${event.itemId} clicked\`);`,
    `  }`,
    `}`,
    ``
  ].join('\n');
}

function formCustomizerEntry(vars: TemplateVars): string {
  const logSource = `${vars.namePascal}FormCustomizer`;
  return [
    `import { Log } from '@microsoft/sp-core-library';`,
    `import { override } from '@microsoft/decorators';`,
    `import { BaseFormCustomizer } from '@microsoft/sp-listview-extensibility';`,
    ``,
    `const LOG_SOURCE: string = '${logSource}';`,
    ``,
    `export default class ${logSource} extends BaseFormCustomizer<{}> {`,
    `  @override`,
    `  public onInit(): Promise<void> {`,
    `    Log.info(LOG_SOURCE, 'Initialized ${vars.name}');`,
    `    return Promise.resolve();`,
    `  }`,
    ``,
    `  @override`,
    `  public render(): void {`,
    `    this.domElement.innerHTML = \`<div>Hello from \${LOG_SOURCE}</div>\`;`,
    `  }`,
    ``,
    `  @override`,
    `  public onDispose(): void {`,
    `    super.onDispose();`,
    `  }`,
    `}`,
    ``
  ].join('\n');
}

function webpartEntry(vars: TemplateVars): string {
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
    ? `  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {\n    return {\n      pages: [\n        {\n          header: { description: '${vars.name}' },\n          groups: [\n            {\n              groupName: 'Settings',\n              groupFields: [\n                PropertyPaneTextField('description', {\n                  label: strings.Description\n                })\n              ]\n            }\n          ]\n        }\n      ]\n    };\n  }`
    : `  protected getPropertyPaneConfiguration() {\n    return {\n      pages: [\n        {\n          header: { description: '${vars.name}' },\n          groups: [\n            {\n              groupName: 'Settings',\n              groupFields: [\n                PropertyPaneTextField('description', {\n                  label: strings.Description\n                })\n              ]\n            }\n          ]\n        }\n      ]\n    };\n  }`;
  return [
    `import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';`,
    `import { PropertyPaneTextField${ts ? ', type IPropertyPaneConfiguration' : ''} } from '@microsoft/sp-property-pane';`,
    `import ${vars.namePascal} from './components/${vars.namePascal}';`,
    `import styles from './styles/${vars.namePascal}.module.scss';`,
    `import strings from '${vars.namePascal}WebPartStrings';`,
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
    ? `  protected override getPropertyPaneConfiguration(): IPropertyPaneConfiguration {\n    return {\n      pages: [\n        {\n          header: { description: '${vars.name}' },\n          groups: [\n            {\n              groupName: 'Settings',\n              groupFields: [\n                PropertyPaneTextField('description', {\n                  label: strings.Description\n                })\n              ]\n            }\n          ]\n        }\n      ]\n    };\n  }`
    : `  getPropertyPaneConfiguration() {\n    return {\n      pages: [\n        {\n          header: { description: '${vars.name}' },\n          groups: [\n            {\n              groupName: 'Settings',\n              groupFields: [\n                PropertyPaneTextField('description', {\n                  label: strings.Description\n                })\n              ]\n            }\n          ]\n        }\n      ]\n    };\n  }`;
  const styleImport = `import styles from './styles/${vars.namePascal}.module.scss';`;
  const stringsImport = `import strings from '${vars.namePascal}WebPartStrings';`;

  switch (vars.framework) {
    case 'vue':
      return [
        ts ? `import type { Component } from 'vue';` : null,
        `import { PropertyPaneTextField${ts ? ', type IPropertyPaneConfiguration' : ''} } from '@microsoft/sp-property-pane';`,
        `import { VueWebPart } from '@mbsks/rspfx-framework-vue/webpart';`,
        `import ${vars.namePascal} from './components/${vars.namePascal}.vue';`,
        styleImport,
        stringsImport,
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
        stringsImport,
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
        stringsImport,
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
        stringsImport,
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

function component(vars: TemplateVars): string {
  if (isFrameworkVariant(vars)) {
    return frameworkComponent(vars);
  }
  if (vars.language === 'typescript') {
    return `export interface I${vars.namePascal}Props {\n  description: string;\n}\n\nfunction escapeHtml(str: string): string {\n  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');\n}\n\nexport default function ${vars.namePascal}(props: I${vars.namePascal}Props): string {\n  return \`<div class="${vars.name}">\${escapeHtml(props.description)}</div>\`;\n}\n`;
  }
  return `function escapeHtml(str: string): string {\n  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');\n}\n\nexport default function ${vars.namePascal}(props) {\n  return \`<div class="${vars.name}">\${escapeHtml(props.description)}</div>\`;\n}\n`;
}

function frameworkComponent(vars: TemplateVars): string {
  const js = vars.language === 'javascript';
  switch (vars.framework) {
    case 'vue':
      return vueComponent(vars, js);
    case 'svelte':
      return svelteComponent(js);
    case 'solid':
      return solidComponent(vars, js);
    case 'preact':
      return preactComponent(vars, js);
    default:
      return '';
  }
}

function vueComponent(vars: TemplateVars, js: boolean): string {
  const script = js
    ? '<script setup>\ndefineProps([\'description\']);\n</script>'
    : '<script setup lang="ts">\ndefineProps<{ description: string }>();\n</script>';
  const content = `<div class="card">\n    <h2 class="card-title">{{ description }}</h2>\n    <p class="card-description">\n      Change the Description property in the property pane to update this title.\n    </p>\n  </div>`;
  const style = `\n\n<style scoped>\n.card {\n  max-width: 480px;\n  margin: 24px auto;\n  padding: 24px;\n  border: 1px solid #e1dfdd;\n  border-radius: 6px;\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);\n  font-family: 'Segoe UI', sans-serif;\n}\n\n.card-title {\n  margin: 0 0 12px 0;\n  color: #323130;\n  font-size: 20px;\n}\n\n.card-description {\n  margin: 0;\n  color: #605e5c;\n  font-size: 14px;\n}\n</style>`;
  return `<template>\n  ${content}\n</template>\n\n${script}${style}\n`;
}

function svelteComponent(js: boolean): string {
  const markup = `<div class="card">\n  <h2 class="card-title">{description}</h2>\n  <p class="card-description">\n    Change the Description property in the property pane to update this title.\n  </p>\n</div>`;
  const style = `\n\n<style>\n  .card {\n    max-width: 480px;\n    margin: 24px auto;\n    padding: 24px;\n    border: 1px solid #e1dfdd;\n    border-radius: 6px;\n    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);\n    font-family: 'Segoe UI', sans-serif;\n  }\n\n  .card-title {\n    margin: 0 0 12px 0;\n    color: #323130;\n    font-size: 20px;\n  }\n\n  .card-description {\n    margin: 0;\n    color: #605e5c;\n    font-size: 14px;\n  }\n</style>`;
  return `<script>\n  export let description = '';\n</script>\n\n${markup}${style}\n`;
}

function solidComponent(vars: TemplateVars, js: boolean): string {
  const lines: string[] = [];
  if (!js) {
    lines.push(`import type { JSX } from 'solid-js';`, '', `export interface I${vars.namePascal}Props {`, '  description: string;', '}', '');
  }
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
  return lines.join('\n');
}

function preactComponent(vars: TemplateVars, js: boolean): string {
  const lines: string[] = [];
  if (!js) {
    lines.push(`import type { JSX } from 'preact';`, '', `export interface I${vars.namePascal}Props {`, '  description: string;', '}', '');
  }
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
  return lines.join('\n');
}

function faviconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">\n  <rect width="32" height="32" rx="7" fill="#111827"/>\n  <!-- Rspack cube -->\n  <path d="M16 5 L22 8.5 L22 13 L16 16.5 L10 13 L10 8.5 Z" fill="#ff3b30" opacity="0.95"/>\n  <path d="M10 13 L16 16.5 L22 13 L16 9.5 Z" fill="#ff6b4a"/>\n  <!-- Vite lightning -->\n  <path d="M17.5 9 L14 16 L16.5 16 L15 23 L20 15 L17 15 Z" fill="#facc15" stroke="#a78bfa" stroke-width="0.4"/>\n  <!-- SPFx -->\n  <circle cx="16" cy="24" r="5.5" fill="#0078d4"/>\n  <text x="16" y="27.2" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-weight="700" font-size="7" fill="#fff">S</text>\n</svg>\n`;
}

function stylesheet(vars: TemplateVars): string {
  return `\n.${vars.namePascal} {\n  color: rgb(0, 120, 212);\n}\n`;
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
