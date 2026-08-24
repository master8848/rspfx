import type { FrameworkPreset, RspackContribs, FrameworkRsbuildContributions, FrameworkViteContributions } from '@mbsks/rspfx-plugin-api';
import { svelte as sveltePlugin } from '@sveltejs/vite-plugin-svelte';

export const preset = {
  name: 'svelte' as const,
  rspack(opts: { fastRefresh: boolean }): RspackContribs {
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
  },
  /** @deprecated use rspack() */
  contributions(opts: { fastRefresh: boolean }): RspackContribs {
    return this.rspack(opts);
  }
} satisfies FrameworkPreset<'svelte'>;
