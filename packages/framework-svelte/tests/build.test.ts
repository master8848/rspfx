import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { build, type CompileContext } from '../../compiler-rspack/src/index.js';
import { preset } from '../src/index.js';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'svelte-app');
const OUT_DIR = 'dist';

function makeCtx(): CompileContext {
  return {
    projectRoot: FIXTURE,
    framework: 'svelte',
    fastRefresh: false,
    production: false,
    entries: [
      {
        name: 'test',
        import: path.join(FIXTURE, 'src', 'index.ts'),
        componentIds: ['test'],
        version: '1.0.0'
      }
    ],
    externals: ['@microsoft/sp-core-library', '@microsoft/sp-webpart-base'],
    build: {
      sourcemap: false,
      minify: false,
      splitChunks: false,
      outDir: OUT_DIR,
      releaseDir: 'release'
    },
    serveMode: false,
    swcContributions: [preset.contributions({ fastRefresh: false }) as unknown as Record<string, unknown>]
  };
}

interface StatsLike {
  toJson(opts: { all: boolean; errors: boolean; warnings: boolean }): {
    errors?: { message: string }[];
    warnings?: unknown[];
  };
}

describe('framework-svelte build', () => {
  beforeAll(() => {
    fs.rmSync(path.join(FIXTURE, OUT_DIR), { recursive: true, force: true });
  });

  it('compiles a svelte component entry with the preset contributions', async () => {
    const result = await build(makeCtx());
    const stats = result.stats as unknown as StatsLike;
    const json = stats.toJson({ all: false, errors: true, warnings: true });
    expect(json.errors ?? []).toHaveLength(0);
    expect(result.outputFiles).toContain('test.js');
  });

  it('compiles the svelte template into DOM construction code', () => {
    const bundle = fs.readFileSync(path.join(FIXTURE, OUT_DIR, 'test.js'), 'utf8');
    expect(bundle).toContain('hello');
    expect(bundle).toContain('svelte_internal__rspack_import_0');
  });
});
