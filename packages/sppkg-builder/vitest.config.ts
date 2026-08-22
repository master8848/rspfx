import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000
  },
  resolve: {
    alias: [
      { find: /^@microsoft\/sp-webpart-base$/, replacement: fileURLToPath(new URL('../../tests/stubs/sp-webpart-base.ts', import.meta.url)) },
      { find: /^@microsoft\/sp-core-library$/, replacement: fileURLToPath(new URL('../../tests/stubs/sp-core-library.ts', import.meta.url)) },
      { find: /^@mbsks\/rspfx-diagnostics$/, replacement: fileURLToPath(new URL('../diagnostics/src/index.ts', import.meta.url)) }
    ]
  }
});
