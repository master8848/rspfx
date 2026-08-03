import { RspfxPlugin, rspfxResolve } from '@mbsks/rspfx-plugin';

export default {
  mode: 'development',
  resolve: rspfxResolve(),
  plugins: [
    new RspfxPlugin({
      name: '@mbsks/rspfx-example-svelte',
      version: '1.0.0',
      framework: 'svelte',
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
