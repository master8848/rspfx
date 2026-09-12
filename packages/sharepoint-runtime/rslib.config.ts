import { defineConfig } from '@rslib/core';
import { createRspfxLib } from '../../tools/rslib.preset.ts';

export default defineConfig({
  lib: [createRspfxLib()],
  source: {
    entry: {
      "index": "./src/index.ts",
      "local-bootstrap": "./src/local-bootstrap.ts",
      "platform-modules": "./src/platform-modules.ts",
    },
    tsconfigPath: './tsconfig.json',
  },
});
