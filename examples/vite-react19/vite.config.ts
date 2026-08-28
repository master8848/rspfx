import { defineConfig } from 'vite';
import { rspfxVite } from '@mbsks/rspfx-plugin';
import react from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

// React Compiler via Babel (Vite 7 + RSPFX AMD). Ox Rust path (Vite 8 + @vitejs/plugin-react 6.1 + oxc-transform-react + react({ compiler: true }))
// is documented in docs/react-19.md:3 — Vite 8 Rolldown currently lacks AMD output, so the demo uses the Babel fallback which builds today.
// Switch to Ox when RSPFX Vite 8 AMD lands: replace the babel preset with react({ compiler: true }).
export default defineConfig({
  plugins: [
    rspfxVite({
      name: '@mbsks/rspfx-example-vite-react19',
      version: '1.0.0',
      framework: 'react',
      spfxVersion: '1.23',
      language: 'typescript',
      dev: {
        tenantUrl: 'https://contoso.sharepoint.com',
        port: 4321,
        https: true
      },
      build: {
        minify: true
      }
    }),
    react(),
    babel({ plugins: [['babel-plugin-react-compiler', {}]] })
  ]
});
