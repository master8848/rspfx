import type { FrameworkPreset, FrameworkRspackContributions } from '@mbsks/rspfx-plugin-api';
import PreactRefreshRspackPlugin from '@rspack/plugin-preact-refresh';

export const preset: FrameworkPreset = {
  name: 'preact',
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions {
    return {
      swc: {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          transform: {
            react: {
              runtime: 'automatic',
              importSource: 'preact',
              development: opts.fastRefresh
            }
          }
        }
      },
      plugins: opts.fastRefresh ? [new PreactRefreshRspackPlugin({})] : []
    };
  }
};
