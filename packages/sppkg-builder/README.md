# @mbsks/rspfx-sppkg-builder

Package builder for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain powered by Rspack.

Assembles the deployable SharePoint package: `sharepoint/solution/<name>.sppkg` — a ZIP containing the app manifest, features, and assets, exactly matching official SPFx output.

## Install

```sh
npm i @mbsks/rspfx-sppkg-builder
```

## Usage

```ts
import { buildPackage, validateSppkg } from '@mbsks/rspfx-sppkg-builder';
import type { BuildPackageResult } from '@mbsks/rspfx-sppkg-builder';

const result: BuildPackageResult = await buildPackage(project, buildResult, { solution: 'my-solution' });
// result.sppkgPath -> sharepoint/solution/my-solution.sppkg

const ok = await validateSppkg(result.sppkgPath); // entry list + zip integrity
```

## API

- `buildPackage(project, buildResult, opts)` — assemble the `.sppkg` package
- `validateSppkg(path)` — zip integrity + expected entry validation
- `BuildPackageResult` — result type

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- [Format ground truth](https://github.com/master8848/rspfx/blob/main/reference/FORMATS.md)
- License: MIT
