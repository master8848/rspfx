import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { build, type CompileContext } from '../../compiler-rspack/src/index.js';
import { preset } from '../src/index.js';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'solid-app');
const OUT_DIR = 'dist';

function makeCtx(overrides: Partial<CompileContext> = {}): CompileContext {
  return {
    projectRoot: FIXTURE,
    framework: 'solid',
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
    swcContributions: [
      preset.contributions({ fastRefresh: false }) as unknown as Record<string, unknown>
    ],
    ...overrides
  };
}

interface StatsLike {
  toJson(opts: { all: boolean; errors: boolean; warnings: boolean }): {
    errors?: { message: string }[];
    warnings?: unknown[];
  };
}

describe('framework-solid build', () => {
  beforeAll(() => {
    fs.rmSync(path.join(FIXTURE, OUT_DIR), { recursive: true, force: true });
  });

  it('compiles a solid JSX entry with the preset contributions', async () => {
    const result = await build(makeCtx());
    const stats = result.stats as unknown as StatsLike;
    const json = stats.toJson({ all: false, errors: true, warnings: true });
    expect(json.errors ?? []).toHaveLength(0);
    expect(result.outputFiles).toContain('test.js');
  });

  it('compiles solid JSX via babel-preset-solid', () => {
    const bundle = fs.readFileSync(path.join(FIXTURE, OUT_DIR, 'test.js'), 'utf8');
    expect(bundle).toContain('createSignal');
    expect(bundle).toContain('createComponent');
    expect(bundle).not.toContain('React.createElement');
    expect(bundle).not.toContain('$$registry');
  });

  it('wires the solid-refresh babel plugin and dev mode when fastRefresh is on', () => {
    const contributions = preset.contributions({ fastRefresh: true }) as {
      rules: Array<{ use: { options: { presets: unknown[]; plugins: unknown[] } } }>;
    };
    const options = contributions.rules[0]!.use.options;
    expect((options.plugins[0] as unknown[])[0]).toMatch(/solid-refresh/);
    expect((options.plugins[0] as unknown[])[1]).toEqual({ bundler: 'rspack-esm' });
    expect((options.presets[0] as unknown[])[0]).toMatch(/babel-preset-solid/);
    expect((options.presets[0] as unknown[])[1]).toEqual({ generate: 'dom', development: true });
  });

  it('compiles with fast refresh on and bundles the solid-refresh runtime', async () => {
    const ctx = makeCtx({ fastRefresh: true });
    ctx.swcContributions = [
      preset.contributions({ fastRefresh: true }) as unknown as Record<string, unknown>
    ];
    const result = await build(ctx);
    const stats = result.stats as unknown as StatsLike;
    const json = stats.toJson({ all: false, errors: true, warnings: true });
    expect(json.errors ?? []).toHaveLength(0);
    const bundle = fs.readFileSync(path.join(FIXTURE, OUT_DIR, 'test.js'), 'utf8');
    expect(bundle).toContain('$$registry');
    expect(bundle).toContain('solid-refresh');
    expect(bundle).not.toContain('fast-refresh plugin for solid is not installed');
  });
});
