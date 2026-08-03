import type { FrameworkPreset, FrameworkRspackContributions } from '@mbsks/rspfx-plugin-api';

export const preset: FrameworkPreset = {
  name: 'solid',
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions {
    return {
      rules: [
        {
          test: /\.(t|j)sx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                [
                  'babel-preset-solid',
                  { generate: 'dom', ...(opts.fastRefresh ? { development: true } : {}) }
                ],
                '@babel/preset-typescript'
              ],
              plugins: opts.fastRefresh ? [['solid-refresh/babel', { bundler: 'rspack-esm' }]] : []
            }
          }
        }
      ]
    };
  }
};
