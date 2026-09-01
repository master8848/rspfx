import { defineConfig } from '@rslib/core';
import { createRspfxLib } from '../../tools/rslib.preset.ts';

export default defineConfig({
  lib: [createRspfxLib()],
  source: {
    entry: {
      "index": "./src/index.ts",
      "vite-shared": "./src/vite-shared.ts",
    },
    tsconfigPath: './tsconfig.json',
  },
});
