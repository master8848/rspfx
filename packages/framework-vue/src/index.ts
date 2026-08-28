import type { FrameworkPreset, RspackContribs, FrameworkRsbuildContributions, FrameworkViteContributions } from '@mbsks/rspfx-plugin-api';
import { VueLoaderPlugin } from 'vue-loader';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadVuePlugin(): ((opts?: unknown) => unknown) | undefined {
  try {
    const mod = require('@vitejs/plugin-vue') as { default?: unknown } & Record<string, unknown>;
    const fn = (mod as { default?: (o?: unknown) => unknown }).default ?? (mod as unknown as (o?: unknown) => unknown);
    return typeof fn === 'function' ? (fn as (o?: unknown) => unknown) : undefined;
  } catch {
    return undefined;
  }
}

export const preset = {
  name: 'vue' as const,
  rspack(_opts: { fastRefresh: boolean }): RspackContribs {
    return {
      rules: [{ test: /\.vue$/, use: 'vue-loader', exclude: /node_modules\/(?!my-lib)/ }],
      plugins: [new VueLoaderPlugin()],
      resolve: { extensions: ['.vue'] }
    };
  },
  vite(_opts: { fastRefresh: boolean }): FrameworkViteContributions {
    const vuePlugin = loadVuePlugin();
    return {
      plugins: vuePlugin ? [vuePlugin()] : [],
      resolveExtensions: ['.vue', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.json']
    };
  },
  rsbuild(opts: { fastRefresh: boolean }): FrameworkRsbuildContributions {
    return this.rspack(opts);
  },
  /** @deprecated use rspack() */
  contributions(opts: { fastRefresh: boolean }): RspackContribs {
    return this.rspack(opts);
  }
} satisfies FrameworkPreset<'vue'>;
