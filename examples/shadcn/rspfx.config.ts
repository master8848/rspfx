import { defineConfig } from '@mbsks/rspfx-core';

export default defineConfig({
  name: '@mbsks/rspfx-example-shadcn',
  framework: 'react',
  spfxVersion: '1.22',
  fluent: false,
  language: 'typescript',
  styling: 'tailwind',
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
});
