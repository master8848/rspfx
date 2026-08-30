import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@microsoft\/sp-webpart-base$/,
        replacement: fileURLToPath(new URL('./tests/stubs/sp-webpart-base.ts', import.meta.url))
      },
      {
        find: /^@microsoft\/sp-core-library$/,
        replacement: fileURLToPath(new URL('./tests/stubs/sp-core-library.ts', import.meta.url))
      }
    ]
  },
  test: {
    include: ['packages/*/tests/**/*.test.ts', 'apps/*/tests/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    pool: 'forks',
    maxWorkers: 1,
    isolate: false,
    // examples builds are heavy (Vite/Rsbuild/Rspack + Tailwind) - allow per-test override via { timeout: 180000 }
    // but keep global at 60s for fast unit tests; the examples file sets its own timeout.
    exclude: [],
  }
});
