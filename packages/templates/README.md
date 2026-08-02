# @mbsks/rspfx-templates

Project scaffolding templates for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain powered by Rspack.

Programmatic scaffolders used by the `rspfx new` command: SPFx web part projects (vanilla, React, Solid, Preact, Vue, Svelte), Tailwind styling, and playground pages.

## Install

```sh
npm i @mbsks/rspfx-templates
```

## Usage

```ts
import { scaffoldProject, scaffoldPlaygroundPage } from '@mbsks/rspfx-templates';
import type { TemplateVars } from '@mbsks/rspfx-templates';

const vars: TemplateVars = {
  name: 'hello-world',
  packageName: 'hello-world-client-side-solution',
  framework: 'react',
  spfxVersion: '1.22',
  language: 'typescript',
  styling: 'none'
};

await scaffoldProject(vars, 'my-app');
await scaffoldPlaygroundPage('my-app', vars);
```

## API

- `scaffoldProject(vars, destDir)` — generate a complete SPFx project
- `scaffoldPlaygroundPage(projectRoot, vars)` — add a playground sandbox page
- `TemplateVars` — scaffold options (framework, SPFx version, language, styling)

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- License: MIT
