import type { FrameworkPreset, FrameworkRspackContributions } from '@mbsks/rspfx-plugin-api';

export const preset: FrameworkPreset = {
  name: 'vanilla',
  contributions(): FrameworkRspackContributions {
    return {};
  }
};
