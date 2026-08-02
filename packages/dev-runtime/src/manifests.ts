import {
  collectDebugManifests,
  generateComponentManifests,
  generateManifestsJs
} from '@mbsks/rspfx-manifest-generator';
import type { BundleEntry, LocalizedResource } from '@mbsks/rspfx-compiler-rspack';
import type { RefreshRuntime } from './refresh.js';

export interface ManifestRegeneratorOptions {
  projectRoot: string;
  production: boolean;
  origin: string;
  packageVersion: string;
  entries: BundleEntry[];
  externals: string[];
  localizedResources: LocalizedResource[];
  webpartsDir?: string;
  entryModuleIds: Record<string, string>;
  refreshRuntime?: RefreshRuntime;
}

export interface ManifestRegenerator {
  readonly manifestsJs: string;
  regenerate(): Promise<void>;
}

/**
 * Bundler-agnostic manifests.js production: component manifests → debug
 * manifests → cumulative `manifests.js` string. Used by the Rspack dev server
 * (dev-runtime serve) and the Vite plugin alike.
 */
export function createManifestRegenerator(opts: ManifestRegeneratorOptions): ManifestRegenerator {
  let manifestsJs = '';
  let regeneration: Promise<void> | null = null;

  const regenerate = (): Promise<void> => {
    regeneration ??= (async () => {
      opts.refreshRuntime?.preserveState();
      try {
        const manifests = await generateComponentManifests({
          projectRoot: opts.projectRoot,
          production: opts.production,
          baseUrls: { debug: `${opts.origin}/dist/`, release: [] },
          packageVersion: opts.packageVersion,
          bundleFiles: new Map(opts.entries.map((entry) => [entry.name, `${entry.name}.js`])),
          externals: opts.externals,
          localizedResources: opts.localizedResources.map((resource) => ({
            name: resource.name,
            locales: resource.files.map((file) => file.locale)
          })),
          webpartsDir: opts.webpartsDir,
          entryModuleIds: opts.entryModuleIds
        });
        const debugManifests = await collectDebugManifests({
          projectRoot: opts.projectRoot,
          componentManifests: manifests,
          serverOrigin: opts.origin
        });
        manifestsJs = await generateManifestsJs(debugManifests);
      } finally {
        opts.refreshRuntime?.restoreState();
        regeneration = null;
      }
    })();
    return regeneration;
  };

  return {
    get manifestsJs(): string {
      return manifestsJs;
    },
    regenerate
  };
}
