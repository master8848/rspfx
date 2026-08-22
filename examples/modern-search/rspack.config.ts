import { RspfxPlugin, rspfxResolve } from '@mbsks/rspfx-plugin';

export default {
  mode: 'development',
  resolve: rspfxResolve(),
  plugins: [
    new RspfxPlugin({
      name: 'modern-search-web-parts',
      version: '4.23.3',
      framework: 'react',
      spfxVersion: '1.23',
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
