import { definePlugin } from '@mbsks/rspfx-plugin-api';

export default definePlugin({
  name: 'spfx-1-25-patch-example',
  spfxVersions: [{ target: '1.25', npmVersion: '1.25.0', toolchain: 'heft', status: 'ga' }],
  componentIds: {
    '@microsoft/sp-new-package': { id: '11111111-1111-1111-1111-111111111111', version: '1.25.0' }
  },
  patches: {
    findSpDependencies: (args, next) => {
      const map = next(args);
      if (!map.has('@microsoft/sp-new-package')) {
        map.set('@microsoft/sp-new-package', { id: '11111111-1111-1111-1111-111111111111', version: '1.25.0', manifestPath: '' });
      }
      return map;
    },
    generateComponentManifests: async (args, next) => {
      const manifests = await next(args);
      return manifests;
    },
    buildAppManifestXml: (args, next) => {
      const xml = next(args);
      return xml.replace('</App>', '  <!-- patched by spfx-1-25-patch-example -->\n</App>');
    }
  }
});
