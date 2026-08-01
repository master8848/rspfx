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
    alias: {
      '@mbsks/rspfx-diagnostics': fileURLToPath(new URL('../diagnostics/src/index.ts', import.meta.url))
    }
  }
});
