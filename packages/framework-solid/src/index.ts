import type { FrameworkPreset, RspackContribs, FrameworkRsbuildContributions, FrameworkViteContributions } from '@mbsks/rspfx-plugin-api';
import { createRequire } from 'node:module';
import solidPlugin from 'vite-plugin-solid';

const require = createRequire(import.meta.url);

function solidBabelRule(fastRefresh: boolean): RspackContribs['rules'] {
  return [
    {
      test: /\.(t|j)sx?$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: [
            [require.resolve('babel-preset-solid'), { generate: 'dom', ...(fastRefresh ? { development: true } : {}) }],
            require.resolve('@babel/preset-typescript')
          ],
          plugins: fastRefresh ? [[require.resolve('solid-refresh/babel'), { bundler: 'rspack-esm' }]] : []
        }
      }
    }
  ];
}

export const preset = {
  name: 'solid' as const,
  rspack(opts: { fastRefresh: boolean }): RspackContribs {
    return { rules: solidBabelRule(opts.fastRefresh) };
  },
  vite(_opts: { fastRefresh: boolean }): FrameworkViteContributions {
    return {
      plugins: [solidPlugin()],
      resolveExtensions: ['.tsx', '.jsx']
    };
  },
  rsbuild(opts: { fastRefresh: boolean }): FrameworkRsbuildContributions {
    return { rules: solidBabelRule(opts.fastRefresh) };
  },
  /** @deprecated use rspack() */
  contributions(opts: { fastRefresh: boolean }): RspackContribs {
    return this.rspack(opts);
  }
} satisfies FrameworkPreset<'solid'>;
