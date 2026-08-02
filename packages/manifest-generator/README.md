# @mbsks/rspfx-manifest-generator

Manifest generation for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain powered by Rspack.

Generates SPFx-compatible component manifests, the AMD `manifests.js` loader script, and detects `@microsoft/sp-*` dependencies — byte-compatible with official SPFx output formats.

## Install

```sh
npm i @mbsks/rspfx-manifest-generator
```

## Usage

```ts
import { generateComponentManifests, generateManifestsJs, findSpDependencies } from '@mbsks/rspfx-manifest-generator';
import type { ComponentManifest, SpDependency } from '@mbsks/rspfx-manifest-generator';

const manifests: ComponentManifest[] = generateComponentManifests(project, buildResult);
const deps: SpDependency[] = findSpDependencies(manifestIds);
const loader = generateManifestsJs(manifests, { deployPath: 'dist' });
```

## API

- `generateComponentManifests(project, buildResult)` — web part manifests (`*.manifest.json`)
- `generateManifestsJs(manifests, opts)` — AMD `manifests.js` loader script
- `findSpDependencies(manifestIds)` — `@microsoft/sp-*` dependency mapping
- `ComponentManifest`, `ManifestContext`, `SpDependency` — types

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- [Format ground truth](https://github.com/master8848/rspfx/blob/main/reference/FORMATS.md)
- License: MIT
