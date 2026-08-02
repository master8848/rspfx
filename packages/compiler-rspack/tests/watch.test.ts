import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { watch, type CompileContext } from '../src/index.js';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'basic');
const DEP_FILE = path.join(FIXTURE, 'src', 'dep.ts');

function makeCtx(): CompileContext {
  return {
    projectRoot: FIXTURE,
    framework: 'vanilla',
    fastRefresh: false,
    production: true,
    entries: [
      {
        name: 'testwebpart',
        import: path.join(FIXTURE, 'src', 'index.ts'),
        componentIds: ['aaaaaaaa-0000-0000-0000-000000000001'],
        version: '1.0.0'
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

function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
  message: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error(message));
      }
    }, 100);
  });
}

describe('watch', () => {
  const original = fs.readFileSync(DEP_FILE, 'utf8');

  beforeAll(() => {
    fs.rmSync(path.join(FIXTURE, 'dist'), { recursive: true, force: true });
    fs.rmSync(path.join(FIXTURE, '.rspack-cache'), { recursive: true, force: true });
  });

  afterAll(() => {
    fs.writeFileSync(DEP_FILE, original, 'utf8');
    fs.rmSync(path.join(FIXTURE, '.rspack-cache'), { recursive: true, force: true });
  });

  it('rebuilds when a watched file changes', async () => {
    let doneCount = 0;
    let lastErrors: unknown[] = [];
    const handle = watch(makeCtx(), (_stats, errors) => {
      lastErrors = errors;
      doneCount += 1;
    });

    try {
      await waitFor(
        () => doneCount >= 1,
        60000,
        'initial watch compilation did not finish within 60s'
      );
      expect(lastErrors).toEqual([]);

      fs.appendFileSync(DEP_FILE, '\n// touched for rebuild\n');

      await waitFor(
        () => doneCount >= 2,
        60000,
        'watch did not rebuild within 60s after file change'
      );
      expect(lastErrors).toEqual([]);

      const bundle = fs.readFileSync(path.join(FIXTURE, 'dist', 'testwebpart.js'), 'utf8');
      expect(bundle).toContain('Hello from rspfx');
    } finally {
      await handle.close();
    }
  });
});
