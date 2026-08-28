import { defineConfig } from '@mbsks/rspfx-core';
import { rspfxVite } from '@mbsks/rspfx-plugin';

export default {
  plugins: [
    rspfxVite(defineConfig({
      name: 'mixed-demo',
      version: '1.0.0',
      framework: 'react' as const,
      spfxVersion: '1.23',
      dev: {
        port: 4321,
        https: true,
        hostname: 'localhost',
        workbench: true,
        openBrowser: false
      },
      build: {
        sourcemap: false,
        minify: true,
        outDir: 'dist',
        releaseDir: 'release'
      }
    } as const))
  ],
  // build.cssCodeSplit is false by default via rspfxVite (SPFx requires a single AMD bundle per entry, no separate CSS files)
  // .module.scss is handled via Vite CSS modules (postcss) and inlined into the JS bundle by the plugin
};
