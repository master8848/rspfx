import { defineConfig } from 'vite';
import { rspfxVite } from '@mbsks/rspfx-plugin';
import react from '@vitejs/plugin-react';

// React Compiler via the official Rust-based Vite plugin (Oxc).
// Vite 8 + @vitejs/plugin-react 6 ships the compiler in Rust — no Babel needed.
export default defineConfig({
  plugins: [
    rspfxVite({
      name: '@mbsks/rspfx-example-vite-react19',
      version: '1.0.0',
      framework: 'react',
      spfxVersion: '1.23',
      dev: {
        tenantUrl: 'https://contoso.sharepoint.com',
        port: 4321,
        https: true
      },
      build: {
        minify: true
      }
    }),
    react({ compiler: true })
  ]
});
