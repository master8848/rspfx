import type { FrameworkPreset, FrameworkRspackContributions } from '@mbsks/rspfx-plugin-api';
import { VueLoaderPlugin } from 'vue-loader';

export const preset: FrameworkPreset = {
  name: 'vue',
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions {
    return {
      rules: [{ test: /\.vue$/, use: 'vue-loader' }],
      plugins: [new VueLoaderPlugin()],
      resolve: { extensions: ['.vue'] }
    };
  }
};
