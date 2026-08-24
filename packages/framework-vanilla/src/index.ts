import type { FrameworkPreset, RspackContribs } from '@mbsks/rspfx-plugin-api';

export const preset = {
  name: 'vanilla' as const,
  rspack(_opts: { fastRefresh: boolean }): RspackContribs {
    return {};
  },
  /** @deprecated use rspack() */
  contributions(_opts?: { fastRefresh: boolean }): RspackContribs {
    return this.rspack({ fastRefresh: _opts?.fastRefresh ?? false });
  }
} satisfies FrameworkPreset<'vanilla'>;
