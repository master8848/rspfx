import type { FrameworkPreset, RspackContribs, FrameworkRsbuildContributions, FrameworkViteContributions } from '@mbsks/rspfx-plugin-api';
import vuePlugin from '@vitejs/plugin-vue';
import { VueLoaderPlugin } from 'vue-loader';

export const preset = {
  name: 'vue' as const,
  rspack(_opts: { fastRefresh: boolean }): RspackContribs {
    return {
      rules: [{ test: /\.vue$/, use: 'vue-loader' }],
      plugins: [new VueLoaderPlugin()],
      resolve: { extensions: ['.vue'] }
    };
  },
  vite(_opts: { fastRefresh: boolean }): FrameworkViteContributions {
    return {
      plugins: [vuePlugin()],
      resolveExtensions: ['.vue']
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
