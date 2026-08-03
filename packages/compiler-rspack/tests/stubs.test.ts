import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createRspackConfig, type CompileContext } from '../src/index.js';
import type { Configuration } from '@rspack/core';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'framework-import');
const COMPONENT_ID = 'aaaaaaaa-0000-0000-0000-000000000099';
const VERSION = '1.0.0';

const tmpDirs: string[] = [];

function makeTempProject(installSolidRefresh: boolean): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rspfx-solid-stub-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'tmp-proj', version: '1.0.0' }));
  if (installSolidRefresh) {
    const pkgDir = path.join(dir, 'node_modules', 'solid-refresh');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'solid-refresh', version: '0.7.8', main: 'index.js' })
    );
    fs.writeFileSync(path.join(pkgDir, 'index.js'), 'export {};\n');
  }
  tmpDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeCtx(overrides: Partial<CompileContext> = {}): CompileContext {
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
    },
    ...overrides
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

  it('aliases solid-refresh to the stub only when it cannot be resolved from the project', async () => {
    const aliasOf = async (ctx: CompileContext): Promise<Record<string, string> | undefined> => {
      const config = (await createRspackConfig(ctx)) as Configuration;
      return config.resolve?.alias as Record<string, string> | undefined;
    };
    const missing = makeTempProject(false);
    const installed = makeTempProject(true);

    const withStub = await aliasOf(makeCtx({ projectRoot: missing, framework: 'solid', fastRefresh: true }));
    expect(withStub?.['solid-refresh']).toBeDefined();
    expect(withStub!['solid-refresh']).toContain('stubs');
    expect(withStub!['solid-refresh']).not.toContain('node_modules');

    const withoutStub = await aliasOf(
      makeCtx({ projectRoot: installed, framework: 'solid', fastRefresh: true })
    );
    expect(withoutStub?.['solid-refresh']).toBeUndefined();
  });

  it('does not alias solid-refresh outside solid fast refresh', async () => {
    const aliasOf = async (ctx: CompileContext): Promise<Record<string, string> | undefined> => {
      const config = (await createRspackConfig(ctx)) as Configuration;
      return config.resolve?.alias as Record<string, string> | undefined;
    };
    const missing = makeTempProject(false);
    const noRefresh = await aliasOf(makeCtx({ projectRoot: missing, framework: 'solid', fastRefresh: false }));
    expect(noRefresh?.['solid-refresh']).toBeUndefined();
    const otherFramework = await aliasOf(makeCtx({ projectRoot: missing, framework: 'react', fastRefresh: true }));
    expect(otherFramework?.['solid-refresh']).toBeUndefined();
  });

  it('warns and no-ops the solid-refresh runtime helpers when the stub is loaded', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const mod = (await import('../src/stubs/solid-refresh.js')) as {
        $$registry(): unknown;
        $$component(registry: unknown, id: string, component: unknown): unknown;
        $$context(registry: unknown, id: string, context: unknown): unknown;
        $$refresh(): void;
        $$decline(): void;
      };
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('solid-refresh'));
      expect(mod.$$registry()).toEqual({});
      const component = () => undefined;
      expect(mod.$$component({}, 'App', component)).toBe(component);
      const context = {};
      expect(mod.$$context({}, 'Ctx', context)).toBe(context);
      expect(mod.$$refresh()).toBeUndefined();
      expect(mod.$$decline()).toBeUndefined();
    } finally {
      warn.mockRestore();
    }
  });
});
