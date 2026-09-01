import { defineConfig } from '@rslib/core';
import { createRspfxLib } from '../../tools/rslib.preset.ts';

export default defineConfig({
  lib: [createRspfxLib()],
  source: {
    entry: {
      "index": "./src/index.ts",
      "inline-css": "./src/inline-css.ts",
    },
    tsconfigPath: './tsconfig.json',
  },
});
