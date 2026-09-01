import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { sharedAlias, sharedTestDefaults } from '../../vitest.shared.js';

export default defineConfig({
  resolve: {
    alias: [
      ...sharedAlias,
      { find: /^@mbsks\/rspfx-diagnostics$/, replacement: fileURLToPath(new URL('../diagnostics/src/index.ts', import.meta.url)) },
    ],
  },
  test: { ...sharedTestDefaults },
});
