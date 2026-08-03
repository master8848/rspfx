import { RspfxPlugin } from '@mbsks/rspfx-plugin';

export default {
  mode: 'development',
  plugins: [
    new RspfxPlugin({
      name: '@mbsks/rspfx-playground',
      version: '0.0.1',
      framework: 'vanilla',
      spfxVersion: '1.22',
      language: 'typescript',
      dev: {
        tenantUrl: 'https://contoso.sharepoint.com',
        port: 4321,
        https: true,
        fastRefresh: true
      },
      build: {
        minify: true
      }
    })
  ]
};
