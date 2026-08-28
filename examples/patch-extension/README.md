# patch-extension example

Minimal patch extension that adds SPFx 1.25 and overrides internal functions without a core publish. See [extending-runtime](../../docs/extending-runtime.md) and [internal-api](../../docs/internal-api.md).

## Usage

```ts
import { registerPlugin } from '@mbsks/rspfx-plugin-api';
import patch from '@mbsks/rspfx-patch-extension-example';

registerPlugin(patch);
```

Or import in `vite.config.ts` / `rspack.config.ts` / `rsbuild.config.ts` before the plugin:

```ts
import patch from './examples/patch-extension/src/index.js';
import { registerPlugin } from '@mbsks/rspfx-plugin-api';
import { rspfxVite } from '@mbsks/rspfx-plugin';
registerPlugin(patch);
export default { plugins: [rspfxVite({ name: 'my-app', framework: 'react', spfxVersion: '1.25' })] };
```

## What it does

- `spfxVersions` (`packages/core/src/versions.ts:13`): adds `{ target: '1.25', npmVersion: '1.25.0', toolchain: 'heft', status: 'ga' }` (`packages/plugin-api/src/types.ts:183`).
- `componentIds` (`packages/manifest-generator/src/data/component-ids.ts:1`): adds `@microsoft/sp-new-package` (`packages/plugin-api/src/types.ts:190`).
- `patches.findSpDependencies` (`packages/manifest-generator/src/sp-dependencies.ts:43`): middleware `(args, next) => result` that injects the new ID.
- `patches.generateComponentManifests` (`packages/manifest-generator/src/component-manifests.ts:52`): async middleware that can mutate manifests before packaging.
- `patches.buildAppManifestXml` (`packages/sppkg-builder/src/xml.ts:359`): sync middleware that post-processes `AppManifest.xml`.

Build the extension with `tsc -p tsconfig.build.json` and publish as `@myorg/rspfx-patch-1-25` for reuse across projects.
