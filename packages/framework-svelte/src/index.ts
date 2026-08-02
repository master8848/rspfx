import type { FrameworkPreset, FrameworkRspackContributions } from '@mbsks/rspfx-plugin-api';

export const preset: FrameworkPreset = {
  name: 'svelte',
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions {
    return {
      rules: [
        {
          test: /\.svelte$/,
          use: {
            loader: 'svelte-loader',
            options: {
              hotReload: opts.fastRefresh,
              compilerOptions: { dev: opts.fastRefresh }
            }
          }
        }
      ],
      resolve: { extensions: ['.svelte'] }
    };
  }
};
