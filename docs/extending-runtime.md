# Extending the runtime — patch as extension

Reference for authoring a patch extension that adds SPFx versions, component IDs, and internal function overrides without a core publish. See [internal-api](internal-api.md) for `RspfxExtension` fields, [compatibility](compatibility.md#spfx-version-matrix) for the version matrix, [supporting-a-new-spfx-version](supporting-a-new-spfx-version.md#add-version) for maintainer procedure, [architecture](architecture.md#packages) for pipeline, [commands](commands.md#rspfx-build) for CLI.

## When to use a patch extension

Use a patch extension when a new SPFx version ships or a component ID changes and no core release is available. The extension lives in your org or as an npm package and is imported in `rspack.config.ts` / `vite.config.ts` / `rsbuild.config.ts` before the core pipeline runs. Core remains unchanged; the extension patches `packages/core/src/versions.ts:13`, `packages/manifest-generator/src/sp-dependencies.ts:43`, `packages/manifest-generator/src/component-manifests.ts:52`, and `packages/sppkg-builder/src/xml.ts:359` at runtime.

## Creating a patch extension

Create an npm package that exports a `RspfxExtension` via `definePlugin` from `@mbsks/rspfx-plugin-api` (`packages/plugin-api/src/types.ts:198`). The package has no runtime dependency on `@microsoft/sp-*`; it only depends on `@mbsks/rspfx-plugin-api` and `@mbsks/rspfx-core`.

```ts
import { definePlugin } from '@mbsks/rspfx-plugin-api';

export const myPatch = definePlugin({
  name: 'my-spfx-patch',
  spfxVersions: [{ target: '1.25', npmVersion: '1.25.0', toolchain: 'heft', status: 'ga' }],
  componentIds: { '@microsoft/sp-webpart-base': { id: '974a60f5-96bc-40a8-b351-e4a0656d72b4', version: '1.25.0' } },
  patches: {
    findSpDependencies: (args, next) => { const m = next(args); return m; },
    generateComponentManifests: async (args, next) => next(args),
    buildAppManifestXml: (args, next) => next(args)
  }
});
```

Fields are optional and compose: `spfxVersions` merges with `packages/core/src/versions.ts:13`, `componentIds` merges with `packages/manifest-generator/src/data/component-ids.ts:1`, `patches` wraps internal functions via middleware `(args, next) => result`.

## Adding a new SPFx version

Add `spfxVersions` to the extension: `[{ target: '1.25', npmVersion: '1.25.0', toolchain: 'heft', status: 'ga' }]` (`packages/plugin-api/src/types.ts:183`). `target` is the user-facing `spfxVersion` string, `npmVersion` is the scaffold pin, `toolchain` is `heft` since 1.23 or `gulp` before, `status` is `ga` or `preview`.

The extension version is merged by `getPatchedSpfxVersions` (`packages/plugin-api/src/patches.ts:4`) with `SPFX_VERSIONS`; `isSpfxTarget` and `spfxNpmVersion` in `packages/core/src/versions.ts:24` resolve against the merged list when the extension is registered before config validation. Without the extension the target is rejected by `packages/core/src/config.ts:101`.

Use the extension immediately in `rspack.config.ts` / `vite.config.ts` / `rsbuild.config.ts`: set `spfxVersion: '1.25'` in the plugin options (`@mbsks/rspfx-plugin` `packages/plugin/src/index.ts:12`). No core bump is required; `rspfx build` and `rspfx package` see the new target via the extension.

## Overriding componentIds

Add `componentIds` to the extension: `Record<string, { id: string; version: string }>` (`packages/plugin-api/src/types.ts:190`). Keys are npm names like `@microsoft/sp-webpart-base`, values are `{ id, version }` harvested from `node_modules/@microsoft/sp-*/dist/*.manifest.json`.

The map is merged by `getPatchedComponentIds` (`packages/plugin-api/src/patches.ts:13`) over `SP_COMPONENT_IDS` (`packages/manifest-generator/src/data/component-ids.ts:1`) and `reference/sp-component-ids.json:1`. `findSpDependencies` (`packages/manifest-generator/src/sp-dependencies.ts:43`) and `generateComponentManifests` (`packages/manifest-generator/src/component-manifests.ts:52`) read from the merged map when the extension is registered.

Use this to add a new `sp-*` package or to override a changed ID without updating `reference/sp-component-ids.json`.

## Patching internal functions

Add `patches` to the extension: `RspfxPatches` (`packages/plugin-api/src/types.ts:192`). Each patch is middleware `(args, next) => result` where `next` is the original implementation.

| Patch | File | Signature |
|---|---|---|
| `findSpDependencies` | `packages/manifest-generator/src/sp-dependencies.ts:43` | `({ projectRoot }, next) => Map<string, { id, version, manifestPath }>` |
| `generateComponentManifests` | `packages/manifest-generator/src/component-manifests.ts:52` | `({ projectRoot, production, baseUrls, packageVersion, bundleFiles, externals, webpartsDir, entryModuleIds }, next) => Promise<ComponentManifest[]>` |
| `buildAppManifestXml` | `packages/sppkg-builder/src/xml.ts:359` | `({ name, productId, version, skipFeatureDeployment, isDomainIsolated, spfxVersion, developer, metadata, localizedStrings, webApiPermissionRequests, pretty }, next) => string` |

Patches compose in registration order via `applyFindSpDependencies` / `applyGenerateComponentManifests` / `applyBuildAppManifestXml` (`packages/plugin-api/src/patches.ts:17`). Call `next(args)` to invoke the next patch or the base; return a new value to override; mutate `args` before calling `next` to adjust inputs.

Example: `buildAppManifestXml` override adds custom XML by post-processing the string returned by `next`.

Example: `findSpDependencies` override injects a synthetic dependency by mutating the `Map` returned by `next`.

Patches run in the same process as `rspfx build` / `rspfx package` / `rspfx dev`; they see the same `projectRoot` and `ManifestContext` as the base implementation.

## Packaging and reuse

Publish the extension as an npm package (e.g. `@myorg/rspfx-patch-1-25`) with `main` → `dist/index.js` and `types` → `dist/index.d.ts`, built with `tsc -p tsconfig.build.json` (`packages/plugin-api/package.json:20`).

Consume via import in the bundler config that `jiti` loads (`apps/cli/src/config.ts:1`):

```ts
import { definePlugin, registerPlugin } from '@mbsks/rspfx-plugin-api';
import { myPatch } from '@myorg/rspfx-patch-1-25';

registerPlugin(myPatch);

import { rspfxVite } from '@mbsks/rspfx-plugin';
export default { plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.25' })] };
```

Or via `rspfx.config.extensions` when that field is available; otherwise use the `registerPlugin` import. The extension must be imported at the top level before the plugin instance is constructed so `getPlugins()` in `packages/manifest-generator/src/sp-dependencies.ts:43` and `packages/sppkg-builder/src/xml.ts:359` sees it.

Reuse across projects by declaring the patch package as a `devDependency` and importing it in each project's `vite.config.ts` / `rspack.config.ts` / `rsbuild.config.ts`.

## Future SPFx versions without core publish

A future SPFx version requires no core publish when covered by an extension: add one entry to `spfxVersions`, add any new IDs to `componentIds`, and optionally patch `buildAppManifestXml` / `generateComponentManifests` / `findSpDependencies` for format changes (`packages/plugin-api/src/types.ts:192`).

The user publishes the extension, updates `spfxVersion` in the app config, and runs `rspfx build` / `rspfx package`; artifacts match `reference/FORMATS.md:1` for the new version. Maintainer procedure in [supporting-a-new-spfx-version](supporting-a-new-spfx-version.md#harvest-core-methodology) still applies to harvest ground truth, but the extension unblocks early adoption before the core PR lands.

Verify by comparing the produced `.sppkg` against an official `npm pack` of the target SPFx version per [supporting-a-new-spfx-version](supporting-a-new-spfx-version.md#verify).

## Example: SPFx 1.25 with new IDs

Extension that adds SPFx 1.25 and two new component IDs, patches `findSpDependencies` to inject one synthetic dependency:

```ts
import { definePlugin } from '@mbsks/rspfx-plugin-api';

export default definePlugin({
  name: 'spfx-1-25-patch',
  spfxVersions: [{ target: '1.25', npmVersion: '1.25.0', toolchain: 'heft', status: 'ga' }],
  componentIds: {
    '@microsoft/sp-new-package': { id: '11111111-1111-1111-1111-111111111111', version: '1.25.0' },
    '@microsoft/sp-webpart-base': { id: '974a60f5-96bc-40a8-b351-e4a0656d72b4', version: '1.25.0' }
  },
  patches: {
    findSpDependencies: (args, next) => {
      const map = next(args);
      if (!map.has('@microsoft/sp-new-package')) map.set('@microsoft/sp-new-package', { id: '11111111-1111-1111-1111-111111111111', version: '1.25.0', manifestPath: '' });
      return map;
    }
  }
});
```

Use in `vite.config.ts`: `import patch from '@myorg/rspfx-patch-1-25'; registerPlugin(patch);` then `rspfxVite({ name: 'my-app', spfxVersion: '1.25' })` (`packages/plugin/src/index.ts:12`).

## Example: override buildAppManifestXml to add custom XML

Extension that appends a custom element to `AppManifest.xml` by wrapping `buildAppManifestXml` (`packages/sppkg-builder/src/xml.ts:359`):

```ts
import { definePlugin } from '@mbsks/rspfx-plugin-api';

export default definePlugin({
  name: 'custom-app-manifest',
  patches: {
    buildAppManifestXml: (args, next) => {
      const xml = next(args);
      return xml.replace('</App>', '  <CustomExtension Id="my-id" />\n</App>');
    }
  }
});
```

The patch receives `AppManifestOptions` (`packages/sppkg-builder/src/xml.ts:248`) and returns the XML string; `next` is the base `buildAppManifestXmlBase` that honors `isDomainIsolated` deprecation for `1.24+` (`packages/sppkg-builder/src/xml.ts:266`) and native `crates/rspfx-sppkg` when available.

Full scaffold: `examples/patch-extension/src/index.ts:1` (`examples/patch-extension/package.json:1`, `examples/patch-extension/README.md:1`).
