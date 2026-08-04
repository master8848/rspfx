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
  /**
   * Base origin for debug URLs; a function is re-evaluated on every
   * regenerate (the dev server's real port is only known after it binds).
   */
  origin: string | (() => string);
  packageVersion: string;
  entries: BundleEntry[];
  externals: string[];
  localizedResources: LocalizedResource[];
  webpartsDir?: string;
  extensionsDir?: string;
  entryModuleIds: Record<string, string>;
  refreshRuntime?: RefreshRuntime;
  bundleUrlSuffix?: () => string;
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
        const origin = typeof opts.origin === 'function' ? opts.origin() : opts.origin;
        const manifests = await generateComponentManifests({
          projectRoot: opts.projectRoot,
          production: opts.production,
          baseUrls: { debug: `${origin}/dist/`, release: [] },
          packageVersion: opts.packageVersion,
          bundleFiles: new Map(
            opts.entries.map((entry) => [
              entry.name,
              `${entry.name}.js${opts.bundleUrlSuffix?.() ?? ''}`
            ])
          ),
          externals: opts.externals,
          localizedResources: opts.localizedResources.map((resource) => ({
            name: resource.name,
            locales: resource.files.map((file) => file.locale)
          })),
          webpartsDir: opts.webpartsDir,
          extensionsDir: opts.extensionsDir,
          entryModuleIds: opts.entryModuleIds
        });
        const debugManifests = await collectDebugManifests({
          projectRoot: opts.projectRoot,
          componentManifests: manifests,
          serverOrigin: origin
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
