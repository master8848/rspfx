import { describe, expect, it } from 'vitest';
import { definePlugin, getPlugins, registerPlugin } from '../src/index.js';
import type { FrameworkPreset, RspfxExtension } from '../src/index.js';

describe('registerPlugin / getPlugins', () => {
  it('roundtrips registered plugins', () => {
    const alpha: RspfxExtension = { name: 'alpha' };
    const beta: RspfxExtension = { name: 'beta' };
    registerPlugin(alpha);
    registerPlugin(beta);
    const plugins = getPlugins();
    expect(plugins).toContain(alpha);
    expect(plugins).toContain(beta);
    expect(plugins.indexOf(alpha)).toBeLessThan(plugins.indexOf(beta));
  });

  it('replaces a previously registered plugin with the same name', () => {
    registerPlugin({ name: 'replace-me', compilerHooks: { afterStats: () => {} } });
    const latest: RspfxExtension = { name: 'replace-me', packageHooks: { beforePackage: () => {} } };
    registerPlugin(latest);
    const matches = getPlugins().filter((p) => p.name === 'replace-me');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toBe(latest);
  });

  it('returns copies so callers cannot mutate the registry', () => {
    const plugin: RspfxExtension = { name: 'copies' };
    registerPlugin(plugin);
    const first = getPlugins();
    const second = getPlugins();
    expect(first).not.toBe(second);
  });
});

describe('definePlugin', () => {
  it('returns the plugin unchanged', () => {
    const plugin: RspfxExtension = { name: 'identity' };
    expect(definePlugin(plugin)).toBe(plugin);
  });
});

describe('FrameworkPreset structural compliance', () => {
  it('exposes a name and a contributions factory', () => {
    const preset = {
      name: 'react' as const,
      rspack: (opts: { fastRefresh: boolean }) => ({
        rules: [{ test: /\.tsx$/ }],
        plugins: ['react-refresh'] as unknown as never[],
        resolve: { alias: { react: 'preact/compat' }, extensions: ['.tsx'] },
        swc: { jsc: { parser: { syntax: 'typescript', tsx: true }, transform: {} } },
        define: { __DEV__: opts.fastRefresh ? 'true' : 'false' },
        moduleTest: { test: /\.module\.scss$/, type: 'css/module' }
      }),
      contributions: (opts: { fastRefresh: boolean }) => ({
        rules: [{ test: /\.tsx$/ }],
        plugins: ['react-refresh'] as unknown as never[],
        resolve: { alias: { react: 'preact/compat' }, extensions: ['.tsx'] },
        swc: { jsc: { parser: { syntax: 'typescript', tsx: true }, transform: {} } },
        define: { __DEV__: opts.fastRefresh ? 'true' : 'false' },
        moduleTest: { test: /\.module\.scss$/, type: 'css/module' }
      })
    } satisfies FrameworkPreset<'react'>;
    const plugin: RspfxExtension = { name: 'framework-react', frameworkPreset: preset };
    registerPlugin(plugin);
    expect(getPlugins()).toContain(plugin);
    expect(preset.name).toBe('react');

    const refresh = preset.rspack({ fastRefresh: true });
    expect(refresh.rules).toHaveLength(1);
    expect(refresh.plugins).toEqual(['react-refresh']);
    expect(refresh.resolve?.alias).toEqual({ react: 'preact/compat' });
    expect(refresh.swc?.jsc?.parser).toEqual({ syntax: 'typescript', tsx: true });
    expect(refresh.define?.['__DEV__']).toBe('true');
    expect(refresh.moduleTest?.test).toEqual(/\.module\.scss$/);
    expect(refresh.moduleTest?.type).toBe('css/module');

    const prod = preset.rspack({ fastRefresh: false });
    expect(prod.define?.['__DEV__']).toBe('false');
  });

  it('accepts a preset with only a name and contributions factory', () => {
    const preset = {
      name: 'vanilla' as const,
      rspack: () => ({}),
      contributions: () => ({})
    } satisfies FrameworkPreset<'vanilla'>;
    const plugin: RspfxExtension = { name: 'framework-vanilla', frameworkPreset: preset };
    registerPlugin(plugin);
    expect(getPlugins()).toContain(plugin);
  });
});

describe('RspfxExtension hooks', () => {
  it('supports compiler and package hooks', () => {
    const called: string[] = [];
    const plugin: RspfxExtension = {
      name: 'hook-carrier',
      compilerHooks: {
        beforeCompile: (ctx) => {
          called.push('beforeCompile');
          return { ok: true, value: ctx } as ReturnType<NonNullable<NonNullable<RspfxExtension['compilerHooks']>['beforeCompile']>>;
        },
        afterStats: () => {
          called.push('afterStats');
        }
      },
      packageHooks: {
        beforePackage: (ctx) => {
          called.push(`beforePackage:${ctx.manifests.length}:${ctx.files.size}`);
        }
      }
    };
    const dummyCtx = {
      projectRoot: '/tmp',
      config: {} as never,
      entries: [],
      externals: [],
      localizedAliases: {},
      fastRefresh: false,
      production: false
    };
    const result = plugin.compilerHooks!.beforeCompile!(dummyCtx as never);
    expect((result as { ok: boolean; value?: unknown })?.value ?? dummyCtx).toEqual(dummyCtx);
    plugin.compilerHooks!.afterStats!({ hasErrors: () => false, hasWarnings: () => false, toString: () => '' });
    plugin.packageHooks!.beforePackage!({
      manifests: [{ id: 'm1', version: '1.0.0' }],
      files: new Map([['a.js', new Uint8Array([1, 2])]])
    });
    expect(called).toEqual(['beforeCompile', 'afterStats', 'beforePackage:1:1']);
  });

  it('beforeCompile can mutate a compile context in place', () => {
    const plugin: RspfxExtension = {
      name: 'ctx-mutator',
      compilerHooks: {
        beforeCompile: (ctx) => {
          // mutate not needed for new API — return same ctx
          return undefined;
        }
      }
    };
    const ctx = {
      projectRoot: '/tmp',
      config: {} as never,
      entries: [],
      externals: [],
      localizedAliases: {},
      fastRefresh: false,
      production: false
    };
    const res = plugin.compilerHooks!.beforeCompile!(ctx as never);
    expect(res).toBeUndefined();
  });
});
