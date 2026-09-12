import { defineConfig } from '@rslib/core';
import { createRspfxLib } from '../../tools/rslib.preset.ts';

export default defineConfig({
  lib: [createRspfxLib()],
  source: {
    entry: {
      "index": "./src/index.ts",
      "helpers/css": "./src/helpers/css.ts",
      "helpers/inline-css": "./src/helpers/inline-css.ts",
    },
    tsconfigPath: './tsconfig.json',
  },
});
