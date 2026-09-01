import { defineConfig } from '@rslib/core';
import { createRspfxLib } from '../../tools/rslib.preset.ts';

export default defineConfig({
  lib: [createRspfxLib()],
  source: {
    entry: {
      "index": "./src/index.ts",
      "webpart": "./src/webpart.ts",
      "headless": "./src/headless.ts",
    },
    tsconfigPath: './tsconfig.json',
  },
});
