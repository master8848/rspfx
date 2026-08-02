import fs from 'node:fs';
import { rspack, type Compiler } from '@rspack/core';
import type { LocalizedResource } from './types.js';

/**
 * Emits localized resource files (e.g. `CommonStrings_en-us.js`) into the
 * output directory so sp-loader can load them as `localizedPath` script
 * resources declared in the generated manifests. Source files are the raw
 * AMD loc files (`define([], ...)`) from the project's loc folders, matching
 * the official SPFx layout: `<resourceName>_<locale>.js`.
 */
export class SpfxLocalizedResourcesPlugin {
  private readonly resources: LocalizedResource[];

  constructor(resources: LocalizedResource[] | undefined) {
    this.resources = resources ?? [];
  }

  apply(compiler: Compiler): void {
    if (this.resources.length === 0) {
      return;
    }
    compiler.hooks.thisCompilation.tap('SpfxLocalizedResourcesPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: 'SpfxLocalizedResourcesPlugin', stage: rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
        () => {
          for (const resource of this.resources) {
            for (const file of resource.files) {
              let content: string;
              try {
                content = fs.readFileSync(file.path, 'utf8');
              } catch {
                continue;
              }
              compilation.emitAsset(
                `${resource.name}_${file.locale}.js`,
                new rspack.sources.RawSource(content)
              );
            }
          }
        }
      );
    });
  }
}
