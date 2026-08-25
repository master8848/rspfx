# @mbsks/rspfx-templates

Project scaffolding templates for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Works with Vite, Rsbuild, and Rspack.

Programmatic scaffolders used by the `rspfx new` command: SPFx web part projects (vanilla, React, Solid, Preact, Vue, Svelte) and playground pages.

## Install

```sh
npm i @mbsks/rspfx-templates
```

## Usage

```ts
import { scaffoldProject } from '@mbsks/rspfx-templates';
import type { TemplateVars } from '@mbsks/rspfx-templates';

const vars: TemplateVars = {
  name: 'hello-world',
  namePascal: 'HelloWorld',
  nameCamel: 'helloWorld',
  componentType: 'webpart',
  framework: 'react',
  spfxVersion: '1.23',
  language: 'typescript',
  componentId: '00000000-0000-0000-0000-000000000000',
  solutionId: '00000000-0000-0000-0000-000000000001',
  featureId: '00000000-0000-0000-0000-000000000002',
  packageName: 'hello-world',
  packageVersion: '1.0.0',
};

await scaffoldProject(vars, 'my-app');
```

## API

- `scaffoldProject(vars, destDir)` — generate a complete SPFx project (`vars: TemplateVars, destDir: string`)
- `TemplateVars` — scaffold options (`name, namePascal, nameCamel, componentType, framework, spfxVersion, language, componentId, solutionId, featureId, packageName, packageVersion, tenantUrl?, teams?`)

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- License: MIT
