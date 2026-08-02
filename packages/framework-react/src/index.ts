import type { FrameworkPreset, FrameworkRspackContributions } from '@mbsks/rspfx-plugin-api';
import ReactRefreshRspackPlugin from '@rspack/plugin-react-refresh';

export const preset: FrameworkPreset = {
  name: 'react',
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions {
    return {
      swc: {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          transform: {
            react: {
              runtime: 'automatic',
              development: opts.fastRefresh
            }
          }
        }
      },
      plugins: opts.fastRefresh ? [new ReactRefreshRspackPlugin()] : []
    };
  }
};
