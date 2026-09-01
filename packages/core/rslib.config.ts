import { defineConfig } from '@rslib/core';
import { createRspfxLib } from '../../tools/rslib.preset.ts';

export default defineConfig({
  lib: [createRspfxLib()],
  source: {
    entry: {
      "index": "./src/index.ts",
      "inline-css": "./src/inline-css.ts",
      "base-web-part": "./src/base-web-part.ts",
      "headless": "./src/headless.ts",
      "platform": "./src/platform.ts",
    },
    tsconfigPath: './tsconfig.json',
  },
});
