import { RspfxPlugin } from '@mbsks/rspfx-plugin';

export default {
  mode: 'development',
  plugins: [
    new RspfxPlugin({
      name: 'modern-search-web-parts',
      version: '4.23.3',
      framework: 'react',
      spfxVersion: '1.22',
      styling: 'scss',
      dev: {
        // https://{tenantdomain}/... is taken from config/serve.json initialPage
        tenantUrl: 'https://contoso.sharepoint.com'
      }
    })
  ]
};
