import { defineConfig } from 'vitest/config';
import { sharedAlias, sharedTestDefaults } from '../../vitest.shared.js';

export default defineConfig({
  resolve: { alias: sharedAlias },
  test: { ...sharedTestDefaults, testTimeout: 120000, hookTimeout: 120000, fileParallelism: false },
});
