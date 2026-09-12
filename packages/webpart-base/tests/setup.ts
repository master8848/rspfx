import { vi } from 'vitest';

vi.mock('@microsoft/sp-webpart-base', async () => {
  const mod = await import('../../../tests/stubs/sp-webpart-base.js');
  return { BaseClientSideWebPart: mod.BaseClientSideWebPart };
});
