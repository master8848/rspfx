import { defineConfig } from '@mbsks/rspfx-core';

export default defineConfig({
  name: '@mbsks/rspfx-example-solid',
  framework: 'solid',
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
});
