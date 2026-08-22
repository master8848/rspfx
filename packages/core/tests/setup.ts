import { vi } from 'vitest';

// Canonical BaseClientSideWebPart stub lives at tests/stubs/sp-webpart-base.ts.
// Re-export it here so per-package and root vitest runs share the same double.
vi.mock('@microsoft/sp-webpart-base', async () => {
  const mod = await import('../../../tests/stubs/sp-webpart-base.js');
  return { BaseClientSideWebPart: mod.BaseClientSideWebPart };
});
