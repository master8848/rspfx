import { defineConfig } from '@mbsks/rspfx-core';

export default defineConfig({
  name: 'modern-search-web-parts',
  framework: 'react',
  spfxVersion: '1.22',
  styling: 'scss',
  dev: {
    // https://{tenantdomain}/... is taken from config/serve.json initialPage
    tenantUrl: 'https://contoso.sharepoint.com'
  }
});
