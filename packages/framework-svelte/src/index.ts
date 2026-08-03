import type { FrameworkPreset, FrameworkRspackContributions, FrameworkRsbuildContributions, FrameworkViteContributions } from '@mbsks/rspfx-plugin-api';
import { svelte as sveltePlugin } from '@sveltejs/vite-plugin-svelte';

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
  },
  vite(opts: { fastRefresh: boolean }): FrameworkViteContributions {
    return {
      plugins: [sveltePlugin({ hot: opts.fastRefresh })],
      resolveExtensions: ['.svelte']
    };
  },
  rsbuild(opts: { fastRefresh: boolean }): FrameworkRsbuildContributions {
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
