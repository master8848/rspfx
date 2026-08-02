import { RspfxPlugin } from '@mbsks/rspfx-plugin';

export default {
  mode: 'development',
  plugins: [
    new RspfxPlugin({
      name: '@mbsks/rspfx-example-solid',
      version: '1.0.0',
      framework: 'solid',
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
