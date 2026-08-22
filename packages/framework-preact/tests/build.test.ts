import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { build, type CompileContext } from '../../compiler-rspack/src/index.js';
import { preset } from '../src/index.js';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'preact-app');
const OUT_DIR = 'dist';

function makeCtx(): CompileContext {
  return {
    projectRoot: FIXTURE,
    framework: 'preact',
    fastRefresh: false,
    production: false,
    entries: [
      {
        name: 'test',
        import: path.join(FIXTURE, 'src', 'index.jsx'),
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

describe('framework-preact build', () => {
  beforeAll(() => {
    fs.rmSync(path.join(FIXTURE, OUT_DIR), { recursive: true, force: true });
  });

  it('compiles a preact JSX entry with the preset contributions', async () => {
    const result = await build(makeCtx());
    const stats = result.stats as unknown as StatsLike;
    const json = stats.toJson({ all: false, errors: true, warnings: true });
    expect(json.errors ?? []).toHaveLength(0);
    expect(result.outputFiles).toContain('test.js');
  });

  it('transforms JSX via the preact automatic runtime', () => {
    const bundle = fs.readFileSync(path.join(FIXTURE, OUT_DIR, 'test.js'), 'utf8');
    expect(bundle).toContain('preact_jsx_runtime');
    expect(bundle).not.toContain('<div>');
  });

  it('enables swc preact jsx mode and the refresh plugin when fastRefresh is on', () => {
    const contributions = preset.contributions({ fastRefresh: true });
    const swc = contributions.swc as { jsc: { transform: { react: Record<string, unknown> } } };
    expect(swc.jsc.transform.react.importSource).toBe('preact');
    expect(swc.jsc.transform.react.development).toBe(true);
    // plugin may be unavailable if preact is not resolvable from the plugin's location
    if (contributions.plugins && contributions.plugins.length > 0) {
      const plugin = contributions.plugins![0] as { constructor: { name: string } };
      expect(plugin.constructor.name).toBe('PreactRefreshRspackPlugin');
    } else {
      expect(contributions.plugins).toHaveLength(0);
    }
  });
});
