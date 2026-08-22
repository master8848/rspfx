import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDevServer, type CompileContext } from '../src/index.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'basic');
const COMPONENT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const VERSION = '1.0.0';
const AMD_PREFIX = `define('${COMPONENT_ID}_${VERSION}', ["@microsoft/sp-core-library"],`;

function makeCtx(): CompileContext {
  return {
    projectRoot: FIXTURE,
    framework: 'vanilla',
    fastRefresh: false,
    production: false,
    entries: [
      {
        name: 'testwebpart',
        import: path.join(FIXTURE, 'src', 'index.ts'),
        componentIds: [COMPONENT_ID],
        version: VERSION
      }
    ],
    externals: ['@microsoft/sp-core-library'],
    aliases: { XxxWebPartStrings: path.join(FIXTURE, 'src', 'loc', 'en-us') },
    build: {
      sourcemap: false,
      minify: false,
      splitChunks: false,
      outDir: 'dist',
      releaseDir: 'release'
    }
  };
}

describe('startDevServer', () => {
  beforeAll(() => {
    fs.rmSync(path.join(FIXTURE, 'dist'), { recursive: true, force: true });
    fs.rmSync(path.join(FIXTURE, '.rspack-cache'), { recursive: true, force: true });
  });

  afterAll(() => {
    fs.rmSync(path.join(FIXTURE, '.rspack-cache'), { recursive: true, force: true });
  });

  it('serves the compiled bundle over HTTP with CORS and AMD wrapper', async () => {
    const result = await startDevServer(makeCtx(), {
      port: 0,
      hostname: 'localhost',
      https: false,
      hot: true
    });

    let emitCount = 0;
    let resolveEmitted!: () => void;
    const emitted = new Promise<void>((resolve) => {
      resolveEmitted = resolve;
    });
    result.onEmit(() => {
      emitCount += 1;
      resolveEmitted();
    });

    try {
      expect(result.port).toBeGreaterThan(0);
      expect(result.compiler).toBeDefined();

      const response = await fetch(`http://localhost:${result.port}/dist/testwebpart.js`);
      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');

      await emitted;
      expect(emitCount).toBeGreaterThanOrEqual(1);

      const body = await response.text();
      expect(body).toContain(AMD_PREFIX);
      expect(body.startsWith(`(function(){window["__rspfx_script_url_testwebpart"]=`)).toBe(true);
      expect(body).not.toContain('__RSPFX_SPFX_PUBLIC_PATH__');

      const onDisk = path.join(FIXTURE, 'dist', 'testwebpart.js');
      expect(fs.existsSync(onDisk)).toBe(true);
    } finally {
      await result.close();
    }
  });
});
