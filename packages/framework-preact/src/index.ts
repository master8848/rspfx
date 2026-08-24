import type { FrameworkPreset, RspackContribs, FrameworkRsbuildContributions, FrameworkViteContributions } from '@mbsks/rspfx-plugin-api';
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

export const preset = {
  name: 'preact' as const,
  rspack(opts: { fastRefresh: boolean }): RspackContribs {
    const getRefreshPlugins = (): Array<Record<string, unknown> & { apply?: unknown }> => {
      if (!opts.fastRefresh) return [];
      try {
        require.resolve('preact');
      } catch {
        return [];
      }
      try {
        return [new PreactRefreshRspackPlugin({}) as unknown as Record<string, unknown> & { apply?: unknown }];
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
      plugins: getRefreshPlugins(),
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
          return [new PreactRefreshRspackPlugin({}) as unknown as Record<string, unknown> & { apply?: unknown }];
        } catch {
          return [];
        }
      })()
    };
  },
  /** @deprecated use rspack() */
  contributions(opts: { fastRefresh: boolean }): RspackContribs {
    return this.rspack(opts);
  }
} satisfies FrameworkPreset<'preact'>;
