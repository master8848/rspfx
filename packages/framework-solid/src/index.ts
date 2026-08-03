import type { FrameworkPreset, FrameworkRspackContributions, FrameworkRsbuildContributions, FrameworkViteContributions } from '@mbsks/rspfx-plugin-api';
import solidPlugin from 'vite-plugin-solid';

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
  },
  vite(opts: { fastRefresh: boolean }): FrameworkViteContributions {
    return {
      plugins: [solidPlugin()],
      resolveExtensions: ['.tsx', '.jsx']
    };
  },
  rsbuild(opts: { fastRefresh: boolean }): FrameworkRsbuildContributions {
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
