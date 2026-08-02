import { defineConfig } from '@mbsks/rspfx-core';

declare const process: {
  env: Record<string, string | undefined>;
  loadEnvFile?: (path?: string) => void;
};

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(new URL('./.env', import.meta.url).pathname);
  } catch {
    // no local .env — falls back to the generic placeholder below
  }
}

const tenantUrl = process.env.RSPFX_TENANT_URL ?? 'https://contoso.sharepoint.com';

export default defineConfig({
  name: '@mbsks/rspfx-example-react',
  framework: 'react',
  spfxVersion: '1.22',
  fluent: false,
  language: 'typescript',
  styling: 'scss',
  dev: {
    tenantUrl,
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
