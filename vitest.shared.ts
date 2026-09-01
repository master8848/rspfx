import { fileURLToPath } from 'node:url';

export const sharedAlias = [
  { find: /^@microsoft\/sp-webpart-base$/, replacement: fileURLToPath(new URL('./tests/stubs/sp-webpart-base.ts', import.meta.url)) },
  { find: /^@microsoft\/sp-core-library$/, replacement: fileURLToPath(new URL('./tests/stubs/sp-core-library.ts', import.meta.url)) },
];

export const sharedTestDefaults = {
  include: ['tests/**/*.test.ts'],
  environment: 'node' as const,
  testTimeout: 60000,
  hookTimeout: 60000,
};
