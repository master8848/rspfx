import { describe, expect, it } from 'vitest';
import { definePlugin, getPlugins, registerPlugin } from '../src/index.js';
import type { FrameworkAdapter, FrameworkPreset, RspfxPlugin } from '../src/index.js';

describe('registerPlugin / getPlugins', () => {
  it('roundtrips registered plugins', () => {
    const alpha: RspfxPlugin = { name: 'alpha' };
    const beta: RspfxPlugin = { name: 'beta' };
    registerPlugin(alpha);
    registerPlugin(beta);
    const plugins = getPlugins();
    expect(plugins).toContain(alpha);
    expect(plugins).toContain(beta);
    expect(plugins.indexOf(alpha)).toBeLessThan(plugins.indexOf(beta));
  });

  it('replaces a previously registered plugin with the same name', () => {
    registerPlugin({ name: 'replace-me', compilerHooks: { afterStats: () => {} } });
    const latest: RspfxPlugin = { name: 'replace-me', packageHooks: { beforePackage: () => {} } };
    registerPlugin(latest);
    const matches = getPlugins().filter((p) => p.name === 'replace-me');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toBe(latest);
  });

  it('returns copies so callers cannot mutate the registry', () => {
    const plugin: RspfxPlugin = { name: 'copies' };
    registerPlugin(plugin);
    const first = getPlugins();
    const second = getPlugins();
    expect(first).not.toBe(second);
  });
});

describe('definePlugin', () => {
  it('returns the plugin unchanged', () => {
    const plugin: RspfxPlugin = { name: 'identity' };
    expect(definePlugin(plugin)).toBe(plugin);
  });
});

describe('FrameworkPreset structural compliance', () => {
  it('exposes a name, adapter factory and contributions factory', () => {
    const adapter: FrameworkAdapter = {
      name: 'react',
      mount: (root: HTMLElement, component: unknown) => {
        expect(root.tagName).toBe('DIV');
        expect(component).toBe('component');
      },
      unmount: (root: HTMLElement) => {
        expect(root).toBeTruthy();
      },
      update: () => {},
      supportsFastRefresh: () => true
    };
    const preset: FrameworkPreset = {
      name: 'react',
      adapter: () => adapter,
      contributions: (opts) => ({
        rules: [{ test: /\.tsx$/ }],
        plugins: ['react-refresh'],
        resolve: { alias: { react: 'preact/compat' }, extensions: ['.tsx'] },
        swc: { jsc: { parser: { syntax: 'typescript', tsx: true }, transform: {} } },
        define: { __DEV__: opts.fastRefresh ? 'true' : 'false' },
        moduleTest: { test: /\.module\.scss$/, type: 'css/module' }
      })
    };
    const plugin: RspfxPlugin = { name: 'framework-react', frameworkPreset: preset };
    registerPlugin(plugin);
    expect(getPlugins()).toContain(plugin);
    expect(preset.name).toBe('react');
    expect(preset.adapter()).toBe(adapter);

    const refresh = preset.contributions({ fastRefresh: true });
    expect(refresh.rules).toHaveLength(1);
    expect(refresh.plugins).toEqual(['react-refresh']);
    expect(refresh.resolve?.alias).toEqual({ react: 'preact/compat' });
    expect(refresh.swc?.jsc?.parser).toEqual({ syntax: 'typescript', tsx: true });
    expect(refresh.define?.['__DEV__']).toBe('true');
    expect(refresh.moduleTest?.test).toEqual(/\.module\.scss$/);
    expect(refresh.moduleTest?.type).toBe('css/module');

    const prod = preset.contributions({ fastRefresh: false });
    expect(prod.define?.['__DEV__']).toBe('false');
    expect(adapter.supportsFastRefresh()).toBe(true);
  });

  it('accepts a preset with only an adapter', () => {
    const preset: FrameworkPreset = {
      name: 'vanilla',
      adapter: () => ({
        name: 'vanilla',
        mount: () => {},
        unmount: () => {},
        update: () => {},
        supportsFastRefresh: () => false
      }),
      contributions: () => ({})
    };
    const plugin: RspfxPlugin = { name: 'framework-vanilla', frameworkPreset: preset };
    registerPlugin(plugin);
    expect(getPlugins()).toContain(plugin);
  });
});

describe('RspfxPlugin hooks', () => {
  it('supports compiler and package hooks', () => {
    const called: string[] = [];
    const plugin: RspfxPlugin = {
      name: 'hook-carrier',
      compilerHooks: {
        beforeCompile: (config) => {
          called.push('beforeCompile');
          return { ...(config as object) };
        },
        afterStats: () => {
          called.push('afterStats');
        }
      },
      packageHooks: {
        beforePackage: (ctx) => {
          called.push(`beforePackage:${ctx.manifests.length}:${ctx.files.length}`);
        }
      }
    };
    const config = plugin.compilerHooks!.beforeCompile!({ mode: 'development' });
    expect(config).toEqual({ mode: 'development' });
    plugin.compilerHooks!.afterStats!({});
    plugin.packageHooks!.beforePackage!({
      manifests: [{ id: 'm1' }],
      files: [{ path: 'a.js', content: new Uint8Array([1, 2]) }]
    });
    expect(called).toEqual(['beforeCompile', 'afterStats', 'beforePackage:1:1']);
  });

  it('beforeCompile can mutate a compile context in place', () => {
    const plugin: RspfxPlugin = {
      name: 'ctx-mutator',
      compilerHooks: {
        beforeCompile: (config) => {
          const ctx = config as { additionalPlugins: unknown[]; swcContributions: unknown[] };
          ctx.additionalPlugins.push('virtual-module');
          ctx.swcContributions.push({ jsc: {} });
        }
      }
    };
    const ctx = { additionalPlugins: [] as unknown[], swcContributions: [] as unknown[] };
    plugin.compilerHooks!.beforeCompile!(ctx);
    expect(ctx.additionalPlugins).toEqual(['virtual-module']);
    expect(ctx.swcContributions).toEqual([{ jsc: {} }]);
  });
});
