import type { FrameworkPreset, FrameworkRspackContributions, FrameworkRsbuildContributions, FrameworkViteContributions } from '@mbsks/rspfx-plugin-api';
import ReactRefreshRspackPlugin from '@rspack/plugin-react-refresh';
import reactPlugin from '@vitejs/plugin-react';

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
  },
  vite(_opts: { fastRefresh: boolean }): FrameworkViteContributions {
    return {
      plugins: [reactPlugin({ jsxRuntime: 'automatic' })],
      esbuild: { jsx: 'automatic' }
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
                ['@babel/preset-react', { runtime: 'automatic', development: opts.fastRefresh }],
                '@babel/preset-typescript'
              ],
              plugins: opts.fastRefresh ? ['react-refresh/babel'] : []
            }
          }
        }
      ],
      plugins: opts.fastRefresh ? [new ReactRefreshRspackPlugin()] : []
    };
  }
};
