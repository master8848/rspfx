import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { createRspackConfig, type CompileContext } from '../src/index.js';
import type { Configuration } from '@rspack/core';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'framework-import');
const COMPONENT_ID = 'aaaaaaaa-0000-0000-0000-000000000099';
const VERSION = '1.0.0';

function makeCtx(): CompileContext {
  return {
    projectRoot: FIXTURE,
    framework: 'react',
    fastRefresh: false,
    production: true,
    entries: [
      {
        name: 'testwebpart',
        import: path.join(FIXTURE, 'src', 'index.ts'),
        componentIds: [COMPONENT_ID],
        version: VERSION
      }
    ],
    externals: ['@microsoft/sp-core-library', '@microsoft/sp-webpart-base'],
    build: {
      sourcemap: false,
      minify: false,
      splitChunks: false,
      outDir: 'dist',
      releaseDir: 'release'
    }
  };
}

describe('build-time alias stubs', () => {
  it('aliases build-time-only framework modules out of the browser bundle', async () => {
    const config = (await createRspackConfig(makeCtx())) as Configuration;
    const alias = config.resolve?.alias as Record<string, string> | undefined;
    expect(alias).toBeDefined();
    for (const key of [
      '@rspack/plugin-react-refresh',
      '@rspack/plugin-preact-refresh',
      'vue-loader'
    ]) {
      expect(alias![key]).toBeDefined();
      expect(alias![key]).toContain('stubs');
      expect(alias![key]).not.toContain('node_modules');
    }
  });

  it('warns that fast refresh is disabled when a stub is loaded', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const cases: Array<[string, string]> = [
        ['../src/stubs/react-refresh.js?stub-react', '@rspack/plugin-react-refresh'],
        ['../src/stubs/preact-refresh.js?stub-preact', '@rspack/plugin-preact-refresh'],
        ['../src/stubs/vue-loader.js?stub-vue', 'vue-loader']
      ];
      for (const [specifier, packageName] of cases) {
        const mod = (await import(specifier)) as { default: { name: string } | undefined };
        expect(mod.default?.name).toBeDefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining(packageName));
      }
    } finally {
      warn.mockRestore();
    }
  });

  it('builds an app importing @mbsks/rspfx-framework-react without node:* scheme errors', async () => {
    const { build } = await import('../src/index.js');
    const { stats, outputFiles } = await build(makeCtx());
    const errors = (stats as { toJson(opts: Record<string, boolean>): { errors?: unknown[] } }).toJson({
      all: false,
      errors: true
    }).errors ?? [];
    expect(errors).toHaveLength(0);
    expect(outputFiles).toContain('testwebpart.js');
  });
});
