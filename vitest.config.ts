import { defineConfig } from 'vitest/config';
import { sharedAlias, sharedTestDefaults } from './vitest.shared.js';

export default defineConfig({
  resolve: {
    alias: sharedAlias
  },
  test: {
    ...sharedTestDefaults,
    include: ['packages/*/tests/**/*.test.ts', 'apps/*/tests/**/*.test.ts', 'tests/**/*.test.ts'],
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true }
    },
    // examples builds are heavy (Vite/Rsbuild/Rspack + Tailwind) - allow per-test override via { timeout: 180000 }
    // but keep global at 60s for fast unit tests; the examples file sets its own timeout.
    exclude: [],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/fixtures/**', '**/dist/**']
    }
  }
});
