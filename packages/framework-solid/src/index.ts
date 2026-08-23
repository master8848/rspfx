import type { FrameworkPreset, FrameworkRspackContributions, FrameworkRsbuildContributions, FrameworkViteContributions } from '@mbsks/rspfx-plugin-api';
import { createRequire } from 'node:module';
import solidPlugin from 'vite-plugin-solid';

const require = createRequire(import.meta.url);

function solidBabelRule(fastRefresh: boolean): FrameworkRspackContributions['rules'] {
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

export const preset: FrameworkPreset = {
  name: 'solid',
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions {
    return { rules: solidBabelRule(opts.fastRefresh) as unknown as FrameworkRspackContributions['rules'] };
  },
  vite(_opts: { fastRefresh: boolean }): FrameworkViteContributions {
    return {
      plugins: [solidPlugin()],
      resolveExtensions: ['.tsx', '.jsx']
    };
  },
  rsbuild(opts: { fastRefresh: boolean }): FrameworkRsbuildContributions {
    return { rules: solidBabelRule(opts.fastRefresh) as unknown as FrameworkRsbuildContributions['rules'] };
  }
};
