import { createRequire } from 'node:module';

let native: { generateManifestsJs?: (m: unknown[], meta?: unknown) => string } | undefined;
try {
  const req = createRequire(import.meta.url);
  native = req('../../crates/rspfx-manifest/index.node');
} catch {}

export async function generateManifestsJs(
  manifests: unknown[],
  metadata?: unknown
): Promise<string> {
  if (native?.generateManifestsJs) {
    try { return native.generateManifestsJs(manifests, metadata); } catch {}
  }
  const manifestsJson = JSON.stringify(manifests);
  const metadataJson = metadata === undefined ? 'undefined' : JSON.stringify(metadata);
  return `(() => {
  const MANIFESTS_ARRAY = ${manifestsJson};
  let publicPath = '';
  try {
    const scripts = document.getElementsByTagName('script');
    const currentScript = document.currentScript || (scripts.length ? scripts[scripts.length - 1] : undefined);
    if (currentScript && currentScript.src) {
      const url = new URL(currentScript.src, window.location.href);
      let base = url.href;
      if (!base.endsWith('/')) {
        const slashIndex = base.lastIndexOf('/');
        if (slashIndex >= 0) {
          base = base.slice(0, slashIndex + 1);
        }
      }
      publicPath = base;
    }
  } catch (error) {
    console.error('[rspfx] Unable to determine the base URL of the debug manifests file.', error);
  }
  function getLocaleFromQuery() {
    try {
      const query = new URLSearchParams(window.location.search);
      const locale = query.get('market') || query.get('locale');
      return locale ? locale.toLowerCase() : '';
    } catch (error) {
      return '';
    }
  }
  const a = {
    _metadata: ${metadataJson},
    getManifests: function () {
      const manifests = JSON.parse(JSON.stringify(MANIFESTS_ARRAY), function (key, value) {
        if (key === 'paths' && value && typeof value === 'object') {
          if (typeof value.l === 'object' && value.l !== null && typeof value.p === 'string' && typeof value.s === 'string') {
            const expanded = {};
            for (const locale in value.l) {
              expanded[locale] = { path: value.p + value.l[locale] + value.s };
            }
            return expanded;
          }
        }
        return value;
      });
      const locale = getLocaleFromQuery();
      for (let i = 0; i < manifests.length; i++) {
        const loaderConfig = manifests[i].loaderConfig;
        if (loaderConfig && loaderConfig.internalModuleBaseUrls && loaderConfig.internalModuleBaseUrls.length === 0) {
          loaderConfig.internalModuleBaseUrls = [publicPath];
        }
        const scriptResources = loaderConfig && loaderConfig.scriptResources;
        if (scriptResources) {
          for (const name in scriptResources) {
            const resource = scriptResources[name];
            if (resource && resource.type === 'localizedPath' && resource.paths) {
              const pathEntry = resource.paths[locale] || resource.paths['default'];
              if (pathEntry) {
                resource.path = pathEntry.path;
                if (pathEntry.integrity !== undefined) {
                  resource.integrity = pathEntry.integrity;
                }
              }
            }
          }
        }
      }
      return manifests;
    }
  };
  self.debugManifests = a;
  window.debugManifests = a;
  if (typeof define === 'function') {
    define([], function () { return a; });
  }
})();
`;
}
