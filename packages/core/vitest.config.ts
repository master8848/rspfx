import { defineConfig } from 'vitest/config';
import { sharedAlias, sharedTestDefaults } from '../../vitest.shared.js';

export default defineConfig({
  resolve: { alias: sharedAlias },
  test: { ...sharedTestDefaults, setupFiles: ['tests/setup.ts'] },
});
