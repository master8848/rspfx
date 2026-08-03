import { rspfxRsbuild } from '@mbsks/rspfx-plugin';

export default {
  plugins: [
    rspfxRsbuild({
      name: '@mbsks/rspfx-example-rsbuild-react',
      version: '1.0.0',
      framework: 'react',
      spfxVersion: '1.22',
      language: 'typescript',
      dev: {
        tenantUrl: 'https://contoso.sharepoint.com',
        port: 4321,
        https: true
      },
      build: {
        minify: true
      }
    })
  ]
};
