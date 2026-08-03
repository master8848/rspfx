import { describe, expect, it } from 'vitest';
import { localPreviewUnavailableWarning } from '../src/commands/dev.js';

describe('localPreviewUnavailableWarning', () => {
  it('warns for vite and rsbuild projects in local mode', () => {
    for (const bundler of ['vite', 'rsbuild'] as const) {
      const warning = localPreviewUnavailableWarning(bundler, 'local');
      expect(warning).toContain(bundler);
      expect(warning).toContain('Rspack');
      expect(warning).toContain('--tenant');
    }
  });

  it('is silent in sharepoint mode', () => {
    for (const bundler of ['vite', 'rsbuild'] as const) {
      expect(localPreviewUnavailableWarning(bundler, 'sharepoint')).toBeUndefined();
    }
  });
});
