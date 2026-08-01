import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120000,
    hookTimeout: 120000,
    fileParallelism: false
  }
});
