import type { FrameworkPreset, FrameworkRspackContributions, FrameworkRsbuildContributions, FrameworkViteContributions } from '@mbsks/rspfx-plugin-api';
import { createRequire } from 'node:module';
import prefresh from '@prefresh/vite';
import PreactRefreshRspackPlugin from '@rspack/plugin-preact-refresh';

const require = createRequire(import.meta.url);
function resolveOrFallback(spec: string): string {
  try {
    return require.resolve(spec);
  } catch {
    return spec;
  }
}

export const preset: FrameworkPreset = {
  name: 'preact',
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions {
    const getRefreshPlugins = (): unknown[] => {
      if (!opts.fastRefresh) return [];
      try {
        require.resolve('preact');
      } catch {
        return [];
      }
      try {
        return [new PreactRefreshRspackPlugin({})];
      } catch {
        return [];
      }
    };
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
      plugins: getRefreshPlugins() as never[],
    };
  },
  vite(opts: { fastRefresh: boolean }): FrameworkViteContributions {
    return {
      plugins: opts.fastRefresh ? [prefresh()] : [],
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
                  resolveOrFallback('@babel/preset-react'),
                  { runtime: 'automatic', importSource: resolveOrFallback('preact'), development: opts.fastRefresh }
                ],
                resolveOrFallback('@babel/preset-typescript')
              ],
              plugins: opts.fastRefresh ? [resolveOrFallback('@prefresh/babel-plugin')] : []
            }
          }
        }
      ],
      plugins: (() => {
        if (!opts.fastRefresh) return [];
        try {
          require.resolve('preact');
        } catch {
          return [];
        }
        try {
          return [new PreactRefreshRspackPlugin({})];
        } catch {
          return [];
        }
      })()
    };
  }
};
