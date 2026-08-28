# @mbsks/rspfx-sppkg-builder

Package builder for [RSPFx](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Works with Vite, Rsbuild, and Rspack.

Assembles the deployable SharePoint package: `sharepoint/solution/<name>.sppkg` — a ZIP containing the app manifest, features, and assets, exactly matching official SPFx output.

## Install

```sh
npm i @mbsks/rspfx-sppkg-builder
```

## Usage

```ts
import { buildPackage, validateSppkg } from '@mbsks/rspfx-sppkg-builder';
import type { BuildPackageResult } from '@mbsks/rspfx-sppkg-builder';

const result: BuildPackageResult = await buildPackage({
  projectRoot: process.cwd(),
  solutionConfigPath: 'config/package-solution.json',
  manifestsDir: 'temp/manifests',
  assetsDir: 'dist',
  production: true,
});
// result.outputPath -> sharepoint/solution/my-solution.sppkg

const { ok, errors } = await validateSppkg(result.outputPath); // zip integrity
```

## API

- `buildPackage(opts)` — assemble the `.sppkg` package (`opts: BuildPackageOptions { projectRoot, manifestsDir, solutionConfigPath, assetsDir, production, outDir?, prettyXml?, teamsDir?, resxDir?, spfxVersion? }` — `spfxVersion: '1.24'` suppresses deprecated `IsDomainIsolated`)
- `validateSppkg(path)` — zip integrity + expected entry validation (`Promise<SppkgValidationResult>`)
- `BuildPackageResult` — result type (`{ outputPath, zipEntries, appManifest }`)

## Links

- [Documentation](https://rspfx.mbsks.me) — [Deploy](https://rspfx.mbsks.me/docs/deployment)
- [Format ground truth](https://github.com/master8848/rspfx/blob/main/reference/FORMATS.md)
- [GitHub](https://github.com/master8848/rspfx)
- License: MIT
