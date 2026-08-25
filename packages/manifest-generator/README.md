# @mbsks/rspfx-manifest-generator

Manifest generation for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Works with Vite, Rsbuild, and Rspack.

Generates SPFx-compatible component manifests, the AMD `manifests.js` loader script, and detects `@microsoft/sp-*` dependencies — byte-compatible with official SPFx output formats.

## Install

```sh
npm i @mbsks/rspfx-manifest-generator
```

## Usage

```ts
import { generateComponentManifests, generateManifestsJs, findSpDependencies } from '@mbsks/rspfx-manifest-generator';
import type { ComponentManifest, ManifestContext } from '@mbsks/rspfx-manifest-generator';

const manifests: ComponentManifest[] = await generateComponentManifests(ctx satisfies ManifestContext);
const deps = findSpDependencies(process.cwd()); // Map<string, SpDependency>
const loader = await generateManifestsJs(manifests);
```

## API

- `generateComponentManifests(ctx)` — async web part manifests (`ctx: ManifestContext`)
- `generateManifestsJs(manifests, metadata?)` — async AMD `manifests.js` loader script
- `findSpDependencies(projectRoot)` — `@microsoft/sp-*` dependency mapping (`Map<string, SpDependency>`)
- `ComponentManifest`, `ManifestContext`, `SpDependency` — types

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- [Format ground truth](https://github.com/master8848/rspfx/blob/main/reference/FORMATS.md)
- License: MIT
