import { defineConfig } from '@mbsks/rspfx-core';
import { rspfxRsbuild } from '@mbsks/rspfx-plugin';

export default {
  plugins: [
    rspfxRsbuild(defineConfig({
      name: '@mbsks/rspfx-example-rsbuild-solid',
      version: '1.0.0',
      framework: 'solid' as const,
      spfxVersion: '1.22',
      dev: {
        port: 4321,
        https: true,
        hostname: 'localhost',
        workbench: true,
        openBrowser: false,
        tenantUrl: "https://contoso.sharepoint.com"
      },
      build: {
        sourcemap: false,
        minify: true,
        outDir: 'dist',
        releaseDir: 'release'
      }
    } as const))
  ],
  output: {
    // SPFx requires styles inlined into the JS bundle — no separate CSS emit
    injectStyles: true
  },
  tools: {
    // handles .module.scss via postcss/css-loader chain
    postcss: {
      // use default postcss handling; rspfxRsbuild wires CSS modules (auto:true)
    }
  }
};
