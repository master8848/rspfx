import { RspfxPlugin } from '@mbsks/rspfx-plugin';

export default {
  mode: 'development',
  plugins: [
    new RspfxPlugin({
      name: '@mbsks/rspfx-example-vanilla',
      version: '1.0.0',
      framework: 'vanilla',
      spfxVersion: '1.22',
      fluent: false,
      language: 'typescript',
      styling: 'scss',
      dev: {
        tenantUrl: 'https://contoso.sharepoint.com',
        port: 4321,
        https: true,
        fastRefresh: true
      },
      build: {
        sourcemap: false,
        minify: true
      },
      playground: {
        port: 3000
      }
    })
  ]
};
