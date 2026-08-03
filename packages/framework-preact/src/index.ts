import type { FrameworkPreset, FrameworkRspackContributions, FrameworkRsbuildContributions, FrameworkViteContributions } from '@mbsks/rspfx-plugin-api';
import prefresh from '@prefresh/vite';
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
  },
  vite(opts: { fastRefresh: boolean }): FrameworkViteContributions {
    return {
      plugins: [prefresh()],
      esbuild: { jsx: 'automatic', jsxImportSource: 'preact' }
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
                  '@babel/preset-react',
                  { runtime: 'automatic', importSource: 'preact', development: opts.fastRefresh }
                ],
                '@babel/preset-typescript'
              ],
              plugins: opts.fastRefresh ? ['@prefresh/babel-plugin'] : []
            }
          }
        }
      ],
      plugins: opts.fastRefresh ? [new PreactRefreshRspackPlugin({})] : []
    };
  }
};
