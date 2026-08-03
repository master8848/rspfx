import type { FrameworkPreset, FrameworkRspackContributions, FrameworkRsbuildContributions, FrameworkViteContributions } from '@mbsks/rspfx-plugin-api';
import vuePlugin from '@vitejs/plugin-vue';
import { VueLoaderPlugin } from 'vue-loader';

export const preset: FrameworkPreset = {
  name: 'vue',
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions {
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
    return this.contributions(opts);
  }
};
