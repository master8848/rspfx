import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@microsoft\/sp-webpart-base$/, replacement: fileURLToPath(new URL('../../tests/stubs/sp-webpart-base.ts', import.meta.url)) },
      { find: /^@microsoft\/sp-core-library$/, replacement: fileURLToPath(new URL('../../tests/stubs/sp-core-library.ts', import.meta.url)) }
    ]
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120000,
    hookTimeout: 120000,
    fileParallelism: false
  }
});
