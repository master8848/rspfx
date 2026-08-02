import { rspfxVite } from '@mbsks/rspfx-plugin';

export default {
  plugins: [
    rspfxVite({
      name: '@mbsks/rspfx-example-vite-react',
      version: '1.0.0',
      framework: 'react',
      spfxVersion: '1.22',
      language: 'typescript',
      styling: 'scss',
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
