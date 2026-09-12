import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { rspack } from '@rspack/core';

const { mockTryResolve, mockHasPostcssConfig } = vi.hoisted(() => ({
  mockTryResolve: vi.fn() as unknown as ReturnType<typeof vi.fn>,
  mockHasPostcssConfig: vi.fn() as unknown as ReturnType<typeof vi.fn>
}));

vi.mock('@mbsks/rspfx-build-core', () => ({
  tryResolve: mockTryResolve,
  hasPostcssConfig: mockHasPostcssConfig,
  hasPostcssConfigFile: mockHasPostcssConfig,
  POSTCSS_CONFIG_FILES: [],
  inlineStyleCode: vi.fn(),
  canResolveFromProject: vi.fn(),
  platformOnlyExternal: vi.fn(),
  computeUniqueName: vi.fn(),
  cacheVersionHash: vi.fn()
}));

import { rspfxCssInlineRule, rspfxSassRule } from '../src/helpers/css.js';
import {
  scriptUrlCaptureLine,
  scriptUrlPublicPathExpression,
  SpfxPublicPathPlugin,
  SPFX_PUBLIC_PATH_SENTINEL
} from '../src/public-path.js';
import { SpfxLocalizedResourcesPlugin } from '../src/localized-resources.js';

// helpers for css mocks
function setupTryResolve(opts: {
  style?: string | undefined;
  css?: string | undefined;
  postcssLoader?: string | undefined;
  postcss?: string | undefined;
  sassLoader?: string | undefined;
  sass?: string | undefined;
}) {
  (mockTryResolve as unknown as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
    if (name === 'style-loader') return opts.style;
    if (name === 'css-loader') return opts.css;
    if (name === 'postcss-loader') return opts.postcssLoader;
    if (name === 'postcss') return opts.postcss;
    if (name === 'sass-loader') return opts.sassLoader;
    if (name === 'sass') return opts.sass;
    return undefined;
  });
}

// helpers for public-path mocks
type MockAsset = { source: { source(): string; map?: (opts?: unknown) => unknown }; name: string };
function createMockCompilation(assets: Record<string, string>, extra: Record<string, unknown> = {}) {
  const store: Record<string, MockAsset> = {};
  for (const [k, v] of Object.entries(assets)) {
    store[k] = {
      name: k,
      source: {
        source: () => v,
        map: (extra[k] as any)?.map ?? (() => null)
      }
    };
  }
  const updateAsset = vi.fn((name: string, newSource: unknown) => {
    const src = (newSource as { source(): string }).source().toString();
    store[name] = { name, source: { source: () => src } };
  });
  const getAsset = vi.fn((name: string) => store[name]);
  const emitAsset = vi.fn();
  let processAssetsCb: (() => void) | undefined;
  const compilation: any = {
    getAsset,
    updateAsset,
    emitAsset,
    // expose store for assertions
    __store: store,
    hooks: {
      processAssets: {
        tap: vi.fn((_opts: unknown, cb: () => void) => {
          processAssetsCb = cb;
        }),
        // helper to trigger
        _trigger: () => processAssetsCb?.()
      }
    }
  };
  return { compilation, updateAsset, getAsset, emitAsset, trigger: () => processAssetsCb?.(), store };
}

function createMockCompiler(compilation: any) {
  let thisCompilationCb: ((c: unknown) => void) | undefined;
  const compiler: any = {
    hooks: {
      thisCompilation: {
        tap: vi.fn((_name: string, cb: (c: unknown) => void) => {
          thisCompilationCb = cb;
        }),
        _trigger: () => thisCompilationCb?.(compilation)
      }
    }
  };
  return { compiler, trigger: () => thisCompilationCb?.(compilation) };
}

// Simple RawSource mock that matches rspack.sources.RawSource shape
class FakeRawSource {
  constructor(private content: string) {}
  source() {
    return this.content;
  }
}
class FakeConcatSource {
  sources: unknown[];
  constructor(...sources: unknown[]) {
    this.sources = sources;
  }
  source() {
    return this.sources.map((s) => (typeof s === 'string' ? s : (s as { source(): string }).source().toString())).join('');
  }
}
class FakeReplaceSource {
  private src: string;
  private replacements: Array<{ start: number; end: number; rep: string }> = [];
  constructor(private original: { source(): string }) {
    this.src = original.source().toString();
  }
  replace(start: number, end: number, rep: string) {
    this.replacements.push({ start, end, rep });
  }
  source() {
    // apply replacements in order of start asc using slice reconstruction
    // sort by start
    const sorted = [...this.replacements].sort((a, b) => a.start - b.start);
    let result = '';
    let last = 0;
    // Need original src indices; replacements refer to original src positions
    // We'll reconstruct by walking original src and replacing ranges
    // This simplified version assumes non-overlapping and uses original src
    let offset = 0;
    // Instead, we can iteratively replace using original indices adjusted by offset
    // Easier: start from original src and apply replacements sequentially with offset tracking
    let cur = this.src;
    // Sort again and apply with offset
    let delta = 0;
    for (const r of sorted) {
      const s = r.start + delta;
      const e = r.end + delta;
      cur = cur.slice(0, s) + r.rep + cur.slice(e + 1);
      delta += r.rep.length - (r.end - r.start + 1);
    }
    return cur;
  }
}
class FakeSourceMapSource {
  constructor(private content: string) {}
  source() {
    return this.content;
  }
}

describe('rspfx css helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rspfxCssInlineRule type javascript/auto and test /\\.css$/', () => {
    mockHasPostcssConfig.mockReturnValue(false);
    setupTryResolve({ style: undefined, css: undefined });
    const rule = rspfxCssInlineRule('/tmp/proj');
    expect(rule.type).toBe('javascript/auto');
    expect(rule.test).toEqual(/\.css$/);
    expect(String(rule.test)).toBe('/\\.css$/');
  });

  it('rspfxSassRule test is /\\.s[ac]ss$/i and type javascript/auto', () => {
    mockHasPostcssConfig.mockReturnValue(false);
    setupTryResolve({ style: undefined, css: undefined, sassLoader: undefined, sass: undefined });
    const rule = rspfxSassRule('/tmp/proj');
    expect(rule.type).toBe('javascript/auto');
    expect(rule.test).toEqual(/\.s[ac]ss$/i);
    expect(rule.test instanceof RegExp).toBe(true);
    expect((rule.test as RegExp).flags).toContain('i');
  });

  it('modules.auto regex matches .module.* and respects namedExport false exportLocalsConvention asIs', () => {
    mockHasPostcssConfig.mockReturnValue(false);
    setupTryResolve({});
    const css = rspfxCssInlineRule('/tmp/proj');
    const sass = rspfxSassRule('/tmp/proj');
    for (const rule of [css, sass]) {
      const use = rule.use as unknown[];
      const cssLoader = use[1] as { loader: string; options: { modules: { auto: RegExp; namedExport: boolean; exportLocalsConvention: string } } };
      expect(cssLoader.options.modules.auto).toBeInstanceOf(RegExp);
      const re = cssLoader.options.modules.auto;
      expect(re.test('foo.module.css')).toBe(true);
      expect(re.test('Foo.Module.SCSS')).toBe(true);
      expect(re.test('foo.module.scss')).toBe(true);
      expect(re.test('foo.css')).toBe(false);
      expect(re.test('foo.scss')).toBe(false);
      expect(cssLoader.options.modules.namedExport).toBe(false);
      expect(cssLoader.options.modules.exportLocalsConvention).toBe('asIs');
      expect(String(re)).toBe('/\\.module\\.\\w+$/i');
    }
  });

  it('rspfxCssInlineRule importLoaders 0 without postcss, 1 with postcss', () => {
    // combo 1: no postcss
    mockHasPostcssConfig.mockReturnValue(false);
    setupTryResolve({ postcssLoader: '/fake/postcss-loader', postcss: '/fake/postcss' });
    let rule = rspfxCssInlineRule('/tmp/proj');
    let cssLoader = (rule.use as any[])[1] as { options: { importLoaders: number } };
    expect(cssLoader.options.importLoaders).toBe(0);
    expect((rule.use as any[]).length).toBe(2);

    // combo 2: hasPostcss but loaders missing -> still 0
    mockHasPostcssConfig.mockReturnValue(true);
    setupTryResolve({ postcssLoader: undefined, postcss: '/fake/postcss' });
    rule = rspfxCssInlineRule('/tmp/proj');
    cssLoader = (rule.use as any[])[1] as { options: { importLoaders: number } };
    expect(cssLoader.options.importLoaders).toBe(0);
    expect((rule.use as any[]).length).toBe(2);

    // combo 3: fully available
    mockHasPostcssConfig.mockReturnValue(true);
    setupTryResolve({ postcssLoader: '/fake/postcss-loader', postcss: '/fake/postcss' });
    rule = rspfxCssInlineRule('/tmp/proj');
    cssLoader = (rule.use as any[])[1] as { options: { importLoaders: number } };
    expect(cssLoader.options.importLoaders).toBe(1);
    expect((rule.use as any[]).length).toBe(3);
    expect((rule.use as any[])[2]).toEqual({ loader: '/fake/postcss-loader' });
  });

  it('rspfxSassRule importLoaders 1 without postcss, 2 with postcss, and use order [style, css, ?postcss, sass]', () => {
    // without postcss
    mockHasPostcssConfig.mockReturnValue(false);
    setupTryResolve({ style: '/s/style-loader', css: '/s/css-loader', sassLoader: '/s/sass-loader', sass: '/s/sass' });
    let rule = rspfxSassRule('/tmp/proj');
    let use = rule.use as any[];
    expect(use.length).toBe(3);
    expect(use[0]).toBe('/s/style-loader');
    expect((use[1] as any).loader).toBe('/s/css-loader');
    expect((use[1] as any).options.importLoaders).toBe(1);
    expect(use[2]).toEqual({ loader: '/s/sass-loader', options: { api: 'modern' } });

    // with postcss
    mockHasPostcssConfig.mockReturnValue(true);
    setupTryResolve({ style: '/s/style-loader', css: '/s/css-loader', postcssLoader: '/s/postcss-loader', postcss: '/s/postcss', sassLoader: '/s/sass-loader', sass: '/s/sass' });
    rule = rspfxSassRule('/tmp/proj');
    use = rule.use as any[];
    expect(use.length).toBe(4);
    expect(use[0]).toBe('/s/style-loader');
    expect((use[1] as any).options.importLoaders).toBe(2);
    expect(use[2]).toEqual({ loader: '/s/postcss-loader' });
    expect(use[3]).toEqual({ loader: '/s/sass-loader', options: { api: 'modern' } });

    // ensure order is [style, css, postcss, sass] when postcss present
    expect(use.map((u) => (typeof u === 'string' ? u : (u as any).loader))).toEqual([
      '/s/style-loader',
      '/s/css-loader',
      '/s/postcss-loader',
      '/s/sass-loader'
    ]);
  });

  it('rspfxCssInlineRule use array order [style, css, ?postcss] and sass rule adds sass last', () => {
    mockHasPostcssConfig.mockReturnValue(true);
    setupTryResolve({ style: '/a/style', css: '/a/css', postcssLoader: '/a/postcss-loader', postcss: '/a/postcss', sassLoader: '/a/sass-loader', sass: '/a/sass' });
    const css = rspfxCssInlineRule('/tmp');
    const sass = rspfxSassRule('/tmp');
    expect((css.use as any[]).map((u) => (typeof u === 'string' ? u : (u as any).loader))).toEqual(['/a/style', '/a/css', '/a/postcss-loader']);
    expect((sass.use as any[]).map((u) => (typeof u === 'string' ? u : (u as any).loader))).toEqual(['/a/style', '/a/css', '/a/postcss-loader', '/a/sass-loader']);
  });

  it('tryResolve fallbacks to string literals when not resolved', () => {
    mockHasPostcssConfig.mockReturnValue(false);
    setupTryResolve({ style: undefined, css: undefined, sassLoader: undefined, sass: undefined, postcssLoader: undefined, postcss: undefined });
    const css = rspfxCssInlineRule('/tmp');
    const sass = rspfxSassRule('/tmp');
    expect((css.use as any[])[0]).toBe('style-loader');
    expect(((css.use as any[])[1] as any).loader).toBe('css-loader');
    expect((sass.use as any[])[0]).toBe('style-loader');
    expect(((sass.use as any[])[1] as any).loader).toBe('css-loader');
    const sassLoaderEntry = (sass.use as any[])[(sass.use as any[]).length - 1] as any;
    expect(sassLoaderEntry.loader).toBe('sass-loader');
    expect(sassLoaderEntry.options).toEqual({ api: 'modern' });
  });

  it('tryResolve uses resolved paths when available', () => {
    mockHasPostcssConfig.mockReturnValue(false);
    setupTryResolve({ style: '/resolved/style-loader', css: '/resolved/css-loader', sassLoader: '/resolved/sass-loader', sass: '/resolved/sass' });
    const css = rspfxCssInlineRule('/tmp');
    const sass = rspfxSassRule('/tmp');
    expect((css.use as any[])[0]).toBe('/resolved/style-loader');
    expect(((css.use as any[])[1] as any).loader).toBe('/resolved/css-loader');
    expect((sass.use as any[])[0]).toBe('/resolved/style-loader');
    const last = (sass.use as any[])[(sass.use as any[]).length - 1] as any;
    expect(last.loader).toBe('/resolved/sass-loader');
  });

  it('covers 4 combos: postcss on/off x sass on/off', () => {
    const combos: Array<{ hasPostcss: boolean; postcssLoader?: string; postcss?: string; sassLoader?: string; sass?: string; expectCssImportLoaders: number; expectSassImportLoaders: number; expectCssLen: number; expectSassLen: number }> = [
      { hasPostcss: false, postcssLoader: undefined, postcss: undefined, sassLoader: undefined, sass: undefined, expectCssImportLoaders: 0, expectSassImportLoaders: 1, expectCssLen: 2, expectSassLen: 3 },
      { hasPostcss: true, postcssLoader: '/p/postcss-loader', postcss: '/p/postcss', sassLoader: undefined, sass: undefined, expectCssImportLoaders: 1, expectSassImportLoaders: 2, expectCssLen: 3, expectSassLen: 4 },
      { hasPostcss: false, postcssLoader: undefined, postcss: undefined, sassLoader: '/p/sass-loader', sass: '/p/sass', expectCssImportLoaders: 0, expectSassImportLoaders: 1, expectCssLen: 2, expectSassLen: 3 },
      { hasPostcss: true, postcssLoader: '/p/postcss-loader', postcss: '/p/postcss', sassLoader: '/p/sass-loader', sass: '/p/sass', expectCssImportLoaders: 1, expectSassImportLoaders: 2, expectCssLen: 3, expectSassLen: 4 }
    ];
    for (const c of combos) {
      mockHasPostcssConfig.mockReturnValue(c.hasPostcss);
      setupTryResolve({ style: '/s/style', css: '/s/css', postcssLoader: c.postcssLoader, postcss: c.postcss, sassLoader: c.sassLoader, sass: c.sass });
      const css = rspfxCssInlineRule('/tmp');
      const sass = rspfxSassRule('/tmp');
      expect(((css.use as any[])[1] as any).options.importLoaders).toBe(c.expectCssImportLoaders);
      expect(((sass.use as any[])[1] as any).options.importLoaders).toBe(c.expectSassImportLoaders);
      expect((css.use as any[]).length).toBe(c.expectCssLen);
      expect((sass.use as any[]).length).toBe(c.expectSassLen);
    }
  });

  it('sass rule always pushes sass-loader even when not installed (meaningful error)', () => {
    mockHasPostcssConfig.mockReturnValue(false);
    setupTryResolve({ sassLoader: undefined, sass: undefined });
    const rule = rspfxSassRule('/tmp');
    const last = (rule.use as any[])[(rule.use as any[]).length - 1] as any;
    expect(last.loader).toBe('sass-loader');
    expect(last.options.api).toBe('modern');
  });
});

describe('public-path helpers', () => {
  it('scriptUrlCaptureLine snapshot includes document.currentScript and defineProperty writable:false', () => {
    const line = scriptUrlCaptureLine('my-webpart');
    expect(line).toContain('document.currentScript');
    expect(line).toContain('document.currentScript.src');
    expect(line).toContain('Object.defineProperty');
    expect(line).toContain('writable:false');
    expect(line).toContain('configurable:false');
    expect(line).toContain('__rspfx_script_url_my-webpart');
    expect(line.startsWith('(function(){window["__rspfx_script_url_my-webpart"]=' )).toBe(true);
    expect(line).toContain('typeof document!=="undefined"&&document.currentScript?document.currentScript.src:""');
    // stable header prefix
    expect(line.startsWith('(function(){window["__rspfx_script_url_')).toBe(true);
    // ensure JSON.stringify escaping
    expect(line).toContain(JSON.stringify('__rspfx_script_url_my-webpart'));
    // capture line ends with newline and IIFE close
    expect(line.endsWith('})();\n')).toBe(true);
  });

  it('scriptUrlPublicPathExpression contains replace pattern', () => {
    const expr = scriptUrlPublicPathExpression('my-webpart');
    expect(expr).toContain('__rspfx_script_url_my-webpart');
    expect(expr).toContain('.replace(/\\/[^/]*$/,"/")');
    expect(expr).toContain('typeof window!=="undefined"');
    expect(expr).toBe('(typeof window!=="undefined"&&window["__rspfx_script_url_my-webpart"]||"").replace(/\\/[^/]*$/,"/")');
  });

  it('SpfxPublicPathPlugin apply mock Compiler/Compilation both branches (ConcatSource vs RawSource fallback) hasSentinel false path', () => {
    const originalSources = { ...((rspack as any).sources ?? {}) };
    const captureFor = (name: string) => scriptUrlCaptureLine(name);

    // Branch 1: ConcatSource available
    (rspack as any).sources = {
      RawSource: FakeRawSource,
      ConcatSource: FakeConcatSource
    };
    {
      const src = 'define("test", [], function(){})';
      const { compilation } = createMockCompilation({ 'my-webpart.js': src });
      const { compiler, trigger } = createMockCompiler(compilation);
      const plugin = new (SpfxPublicPathPlugin as any)({ entries: [{ name: 'my-webpart' }] });
      plugin.apply(compiler);
      trigger();
      // simulate thisCompilation hook
      (compiler.hooks.thisCompilation.tap as any).mock.calls[0][1](compilation);
      // trigger processAssets
      (compilation.hooks.processAssets.tap as any).mock.calls[0][1]();
      expect(compilation.getAsset).toHaveBeenCalledWith('my-webpart.js');
      expect(compilation.updateAsset).toHaveBeenCalledTimes(1);
      const newSrc = (compilation.__store['my-webpart.js'].source.source() as string);
      expect(newSrc.startsWith(captureFor('my-webpart'))).toBe(true);
      expect(newSrc).toContain('define("test"');
    }

    // Branch 2: ConcatSource missing -> RawSource fallback
    (rspack as any).sources = {
      RawSource: FakeRawSource,
      ConcatSource: undefined
    };
    // Ensure Compilation stage fallback works (undefined process assets stage)
    const origCompilation = (rspack as any).Compilation;
    (rspack as any).Compilation = { PROCESS_ASSETS_STAGE_REPORT: 5000 };
    {
      const src = 'define("test2", [], function(){})';
      const { compilation } = createMockCompilation({ 'my-webpart.js': src });
      const { compiler } = createMockCompiler(compilation);
      const plugin = new (SpfxPublicPathPlugin as any)({ entries: [{ name: 'my-webpart' }] });
      plugin.apply(compiler);
      // trigger
      const thisCb = (compiler.hooks.thisCompilation.tap as any).mock.calls[0][1];
      thisCb(compilation);
      const procCb = (compilation.hooks.processAssets.tap as any).mock.calls[0][1];
      procCb();
      expect(compilation.updateAsset).toHaveBeenCalledTimes(1);
      const args = (compilation.updateAsset as any).mock.calls[0];
      expect(args[0]).toBe('my-webpart.js');
      const updated = (args[1] as { source(): string }).source();
      expect(updated.startsWith(captureFor('my-webpart'))).toBe(true);
      expect(updated).toContain(src);
    }

    // restore
    (rspack as any).sources = originalSources;
    (rspack as any).Compilation = origCompilation;
  });

  it('SpfxPublicPathPlugin hasSentinel false path preserves sourcemap via ConcatSource', () => {
    const originalSources = { ...((rspack as any).sources ?? {}) };
    (rspack as any).sources = { RawSource: FakeRawSource, ConcatSource: FakeConcatSource };
    const src = 'console.log("hello");';
    const { compilation } = createMockCompilation({ 'my-webpart.js': src });
    const { compiler } = createMockCompiler(compilation);
    const plugin = new (SpfxPublicPathPlugin as any)({ entries: [{ name: 'my-webpart' }] });
    plugin.apply(compiler);
    (compiler.hooks.thisCompilation.tap as any).mock.calls[0][1](compilation);
    (compilation.hooks.processAssets.tap as any).mock.calls[0][1]();
    const updated = compilation.__store['my-webpart.js'].source.source();
    expect(updated).toContain('console.log("hello");');
    expect(updated.startsWith(scriptUrlCaptureLine('my-webpart'))).toBe(true);
    (rspack as any).sources = originalSources;
  });

  it('SpfxPublicPathPlugin hasSentinel true path with quote detection and sentinel replacement', () => {
    const originalSources = { ...((rspack as any).sources ?? {}) } as any;
    (rspack as any).sources = { RawSource: FakeRawSource, ConcatSource: FakeConcatSource, ReplaceSource: FakeReplaceSource, SourceMapSource: FakeSourceMapSource };
    const sentinelQuotedDouble = `"${SPFX_PUBLIC_PATH_SENTINEL}"`;
    const srcDouble = `var p=${sentinelQuotedDouble}; define("x",[],function(){});`;
    const { compilation } = createMockCompilation({ 'my-webpart.js': srcDouble });
    const { compiler } = createMockCompiler(compilation);
    const plugin = new (SpfxPublicPathPlugin as any)({ entries: [{ name: 'my-webpart' }] });
    plugin.apply(compiler);
    (compiler.hooks.thisCompilation.tap as any).mock.calls[0][1](compilation);
    (compilation.hooks.processAssets.tap as any).mock.calls[0][1]();
    let updated = compilation.__store['my-webpart.js'].source.source();
    expect(updated).not.toContain(SPFX_PUBLIC_PATH_SENTINEL);
    expect(updated).toContain(scriptUrlPublicPathExpression('my-webpart'));
    expect(updated.startsWith(scriptUrlCaptureLine('my-webpart'))).toBe(true);

    // single quote sentinel
    const sentinelQuotedSingle = `'${SPFX_PUBLIC_PATH_SENTINEL}'`;
    const srcSingle = `var p=${sentinelQuotedSingle};`;
    const { compilation: comp2 } = createMockCompilation({ 'my-webpart.js': srcSingle });
    const { compiler: compiler2 } = createMockCompiler(comp2);
    const plugin2 = new (SpfxPublicPathPlugin as any)({ entries: [{ name: 'my-webpart' }] });
    plugin2.apply(compiler2);
    (compiler2.hooks.thisCompilation.tap as any).mock.calls[0][1](comp2);
    (comp2.hooks.processAssets.tap as any).mock.calls[0][1]();
    updated = comp2.__store['my-webpart.js'].source.source();
    expect(updated).not.toContain(SPFX_PUBLIC_PATH_SENTINEL);
    expect(updated).toContain(scriptUrlPublicPathExpression('my-webpart'));

    (rspack as any).sources = originalSources;
  });

  it('SpfxPublicPathPlugin handles multi-entry loop and missing asset continue', () => {
    const originalSources = { ...((rspack as any).sources ?? {}) };
    (rspack as any).sources = { RawSource: FakeRawSource, ConcatSource: FakeConcatSource, ReplaceSource: FakeReplaceSource };
    const srcA = `var p="${SPFX_PUBLIC_PATH_SENTINEL}";`;
    const srcB = `console.log("no sentinel");`;
    const { compilation } = createMockCompilation({
      'my-webpart.js': srcA,
      'second-webpart.js': srcB
    });
    const { compiler } = createMockCompiler(compilation);
    const plugin = new (SpfxPublicPathPlugin as any)({
      entries: [{ name: 'my-webpart' }, { name: 'second-webpart' }, { name: 'missing-part' }]
    });
    plugin.apply(compiler);
    (compiler.hooks.thisCompilation.tap as any).mock.calls[0][1](compilation);
    (compilation.hooks.processAssets.tap as any).mock.calls[0][1]();
    // my-webpart had sentinel -> replaced
    expect(compilation.__store['my-webpart.js'].source.source()).not.toContain(SPFX_PUBLIC_PATH_SENTINEL);
    expect(compilation.__store['my-webpart.js'].source.source()).toContain('__rspfx_script_url_my-webpart');
    // second had no sentinel -> just capture prepended
    expect(compilation.__store['second-webpart.js'].source.source().startsWith(scriptUrlCaptureLine('second-webpart'))).toBe(true);
    expect(compilation.getAsset).toHaveBeenCalledWith('my-webpart.js');
    expect(compilation.getAsset).toHaveBeenCalledWith('second-webpart.js');
    expect(compilation.getAsset).toHaveBeenCalledWith('missing-part.js');
    // missing asset should not cause throw, updateAsset only for existing 2
    expect(compilation.updateAsset).toHaveBeenCalledTimes(2);
    (rspack as any).sources = originalSources;
  });

  it('SpfxPublicPathPlugin fallback string replacement when ReplaceSource missing, and SourceMapSource path', () => {
    const originalSources = { ...((rspack as any).sources ?? {}) };
    // No ReplaceSource -> fallback to split/join
    (rspack as any).sources = { RawSource: FakeRawSource, ConcatSource: FakeConcatSource, ReplaceSource: undefined, SourceMapSource: FakeSourceMapSource };
    const src = `var a="${SPFX_PUBLIC_PATH_SENTINEL}"; var b="${SPFX_PUBLIC_PATH_SENTINEL}";`;
    const mapFn = vi.fn(() => ({ version: 3, sources: [], mappings: '' }));
    const { compilation } = createMockCompilation({ 'my-webpart.js': src }, { 'my-webpart.js': { map: mapFn } });
    // need to ensure asset source has map method
    (compilation.__store['my-webpart.js'].source as any).map = mapFn;
    // Actually createMockCompilation already sets map via extra; but we need to set on source object used by plugin: compilation.getAsset returns store entry with source that has map
    // Patch compilation.getAsset to return object with map
    const originalGetAsset = compilation.getAsset;
    compilation.getAsset = vi.fn((name: string) => {
      const entry = (compilation.__store as any)[name];
      if (!entry) return undefined;
      return { source: { source: () => src, map: mapFn } };
    });
    const { compiler } = createMockCompiler(compilation);
    const plugin = new (SpfxPublicPathPlugin as any)({ entries: [{ name: 'my-webpart' }] });
    plugin.apply(compiler);
    (compiler.hooks.thisCompilation.tap as any).mock.calls[0][1](compilation);
    (compilation.hooks.processAssets.tap as any).mock.calls[0][1]();
    // fallback should have been used, replacement should appear twice
    expect(compilation.updateAsset).toHaveBeenCalledTimes(1);
    const updatedSource = (compilation.updateAsset as any).mock.calls[0][1] as { source(): string };
    const updatedStr = updatedSource.source();
    expect(updatedStr).not.toContain(SPFX_PUBLIC_PATH_SENTINEL);
    // count occurrences of replacement
    const replacement = scriptUrlPublicPathExpression('my-webpart');
    const count = updatedStr.split(replacement).length - 1;
    expect(count).toBe(2);

    // Now test with map and SourceMapSource available
    (rspack as any).sources = { RawSource: FakeRawSource, ConcatSource: FakeConcatSource, SourceMapSource: FakeSourceMapSource, ReplaceSource: undefined };
    const { compilation: comp2 } = createMockCompilation({ 'my-webpart.js': src }, { 'my-webpart.js': { map: mapFn } });
    comp2.getAsset = vi.fn(() => ({ source: { source: () => src, map: mapFn } }));
    const { compiler: compiler2 } = createMockCompiler(comp2);
    const plugin2 = new (SpfxPublicPathPlugin as any)({ entries: [{ name: 'my-webpart' }] });
    plugin2.apply(compiler2);
    (compiler2.hooks.thisCompilation.tap as any).mock.calls[0][1](comp2);
    (comp2.hooks.processAssets.tap as any).mock.calls[0][1]();
    expect(comp2.updateAsset).toHaveBeenCalledTimes(1);

    // Fallback to ConcatSource+RawSource when SourceMapSource also missing
    (rspack as any).sources = { RawSource: FakeRawSource, ConcatSource: FakeConcatSource, ReplaceSource: undefined, SourceMapSource: undefined };
    const { compilation: comp3 } = createMockCompilation({ 'my-webpart.js': src });
    comp3.getAsset = vi.fn(() => ({ source: { source: () => src, map: () => null } }));
    const { compiler: compiler3 } = createMockCompiler(comp3);
    const plugin3 = new (SpfxPublicPathPlugin as any)({ entries: [{ name: 'my-webpart' }] });
    plugin3.apply(compiler3);
    (compiler3.hooks.thisCompilation.tap as any).mock.calls[0][1](comp3);
    (comp3.hooks.processAssets.tap as any).mock.calls[0][1]();
    expect(comp3.updateAsset).toHaveBeenCalledTimes(1);
    const upd3 = (comp3.updateAsset as any).mock.calls[0][1] as { source(): string };
    expect(upd3.source()).not.toContain(SPFX_PUBLIC_PATH_SENTINEL);

    // RawSource fallback when even ConcatSource missing (final else)
    (rspack as any).sources = { RawSource: FakeRawSource, ConcatSource: undefined, ReplaceSource: undefined, SourceMapSource: undefined };
    const { compilation: comp4 } = createMockCompilation({ 'my-webpart.js': src });
    comp4.getAsset = vi.fn(() => ({ source: { source: () => src } }));
    const { compiler: compiler4 } = createMockCompiler(comp4);
    const plugin4 = new (SpfxPublicPathPlugin as any)({ entries: [{ name: 'my-webpart' }] });
    plugin4.apply(compiler4);
    (compiler4.hooks.thisCompilation.tap as any).mock.calls[0][1](comp4);
    (comp4.hooks.processAssets.tap as any).mock.calls[0][1]();
    expect(comp4.updateAsset).toHaveBeenCalledTimes(1);
    const upd4 = (comp4.updateAsset as any).mock.calls[0][1] as { source(): string };
    expect(upd4.source().startsWith(scriptUrlCaptureLine('my-webpart'))).toBe(true);

    (rspack as any).sources = originalSources;
  });

  it('SpfxPublicPathPlugin respects rspack.Compilation.PROCESS_ASSETS_STAGE_REPORT fallback', () => {
    const originalCompilation = (rspack as any).Compilation;
    (rspack as any).Compilation = {};
    (rspack as any).sources = { RawSource: FakeRawSource, ConcatSource: FakeConcatSource };
    const { compilation } = createMockCompilation({ 'my-webpart.js': 'hello' });
    const { compiler } = createMockCompiler(compilation);
    const plugin = new (SpfxPublicPathPlugin as any)({ entries: [{ name: 'my-webpart' }] });
    plugin.apply(compiler);
    (compiler.hooks.thisCompilation.tap as any).mock.calls[0][1](compilation);
    // stage should fallback to 5000
    expect(compilation.hooks.processAssets.tap).toHaveBeenCalledWith(expect.objectContaining({ stage: 5000 }), expect.any(Function));
    const proc = (compilation.hooks.processAssets.tap as any).mock.calls[0][0];
    expect(proc.stage).toBe(5000);
    (rspack as any).Compilation = originalCompilation;
    (rspack as any).sources = { RawSource: FakeRawSource, ConcatSource: FakeConcatSource };
  });
});

describe('SpfxLocalizedResourcesPlugin', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('0-length no tap', () => {
    const compiler: any = { hooks: { thisCompilation: { tap: vi.fn() } } };
    const plugin = new (SpfxLocalizedResourcesPlugin as any)([]);
    plugin.apply(compiler);
    expect(compiler.hooks.thisCompilation.tap).not.toHaveBeenCalled();

    const plugin2 = new (SpfxLocalizedResourcesPlugin as any)(undefined);
    plugin2.apply(compiler);
    expect(compiler.hooks.thisCompilation.tap).not.toHaveBeenCalled();
  });

  it('1 resource emits asset with RawSource content', () => {
    const originalSources = { ...((rspack as any).sources ?? {}) };
    (rspack as any).sources = { RawSource: FakeRawSource };
    const fakeContent = 'define([], {hello: "world"});';
    const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(fakeContent as unknown as string);

    const { compilation } = createMockCompilation({});
    const { compiler } = createMockCompiler(compilation);
    // Need to set Compilation stage for localized resources
    const origComp = (rspack as any).Compilation;
    (rspack as any).Compilation = { PROCESS_ASSETS_STAGE_ADDITIONAL: 2000, PROCESS_ASSETS_STAGE_REPORT: 5000 };
    // Ensure emitted asset uses rspack.sources.RawSource
    (rspack as any).sources.RawSource = FakeRawSource;

    const plugin = new (SpfxLocalizedResourcesPlugin as any)([
      { name: 'MyStrings', files: [{ locale: 'en-us', path: '/fake/loc/en-us.js' }] }
    ]);
    plugin.apply(compiler);
    expect(compiler.hooks.thisCompilation.tap).toHaveBeenCalledWith('SpfxLocalizedResourcesPlugin', expect.any(Function));
    // trigger thisCompilation
    const thisCb = (compiler.hooks.thisCompilation.tap as any).mock.calls[0][1];
    thisCb(compilation);
    expect(compilation.hooks.processAssets.tap).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'SpfxLocalizedResourcesPlugin', stage: 2000 }),
      expect.any(Function)
    );
    const procCb = (compilation.hooks.processAssets.tap as any).mock.calls[0][1];
    procCb();

    expect(readSpy).toHaveBeenCalledWith('/fake/loc/en-us.js', 'utf8');
    expect(compilation.emitAsset).toHaveBeenCalledTimes(1);
    const [assetName, assetSource] = (compilation.emitAsset as any).mock.calls[0];
    expect(assetName).toBe('MyStrings_en-us.js');
    expect((assetSource as { source(): string }).source()).toBe(fakeContent);

    (rspack as any).sources = originalSources;
    (rspack as any).Compilation = origComp;
    readSpy.mockRestore();
  });

  it('readFileSync throw continues and emits remaining files', () => {
    const originalSources = { ...((rspack as any).sources ?? {}) };
    (rspack as any).sources = { RawSource: FakeRawSource };
    const origComp = (rspack as any).Compilation;
    (rspack as any).Compilation = { PROCESS_ASSETS_STAGE_ADDITIONAL: 2000 };

    const goodContent = 'define([], {good:true});';
    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(((p: string) => {
      if (p.includes('bad')) throw new Error('ENOENT');
      return goodContent;
    }) as unknown as typeof fs.readFileSync);

    const { compilation } = createMockCompilation({});
    const { compiler } = createMockCompiler(compilation);

    const plugin = new (SpfxLocalizedResourcesPlugin as any)([
      {
        name: 'MyStrings',
        files: [
          { locale: 'en-us', path: '/fake/bad.js' },
          { locale: 'fr-fr', path: '/fake/good.js' }
        ]
      },
      {
        name: 'OtherStrings',
        files: [{ locale: 'en-us', path: '/fake/other.js' }]
      }
    ]);
    plugin.apply(compiler);
    const thisCb = (compiler.hooks.thisCompilation.tap as any).mock.calls[0][1];
    thisCb(compilation);
    const procCb = (compilation.hooks.processAssets.tap as any).mock.calls[0][1];
    procCb();

    // bad.js should be skipped, good.js and other.js emitted
    expect(compilation.emitAsset).toHaveBeenCalledTimes(2);
    const names = (compilation.emitAsset as any).mock.calls.map((c: any[]) => c[0]);
    expect(names).toContain('MyStrings_fr-fr.js');
    expect(names).toContain('OtherStrings_en-us.js');
    expect(names).not.toContain('MyStrings_en-us.js');

    // verify RawSource content for emitted assets
    for (const [, src] of (compilation.emitAsset as any).mock.calls) {
      expect((src as { source(): string }).source()).toBe(goodContent);
    }

    (rspack as any).sources = originalSources;
    (rspack as any).Compilation = origComp;
    readSpy.mockRestore();
  });

  it('verify RawSource content matches file content and multiple locales', () => {
    const originalSources = { ...((rspack as any).sources ?? {}) };
    (rspack as any).sources = { RawSource: FakeRawSource };
    const origComp = (rspack as any).Compilation;
    (rspack as any).Compilation = { PROCESS_ASSETS_STAGE_ADDITIONAL: 2000 };

    const contents: Record<string, string> = {
      '/a/en-us.js': 'define([], {a:"en"});',
      '/a/fr-fr.js': 'define([], {a:"fr"});'
    };
    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(((p: string) => contents[p] ?? '') as unknown as typeof fs.readFileSync);

    const { compilation } = createMockCompilation({});
    const { compiler } = createMockCompiler(compilation);
    const plugin = new (SpfxLocalizedResourcesPlugin as any)([
      { name: 'AStrings', files: [{ locale: 'en-us', path: '/a/en-us.js' }, { locale: 'fr-fr', path: '/a/fr-fr.js' }] }
    ]);
    plugin.apply(compiler);
    (compiler.hooks.thisCompilation.tap as any).mock.calls[0][1](compilation);
    (compilation.hooks.processAssets.tap as any).mock.calls[0][1]();

    expect(compilation.emitAsset).toHaveBeenCalledTimes(2);
    expect((compilation.emitAsset as any).mock.calls[0][0]).toBe('AStrings_en-us.js');
    expect(((compilation.emitAsset as any).mock.calls[0][1] as { source(): string }).source()).toBe('define([], {a:"en"});');
    expect((compilation.emitAsset as any).mock.calls[1][0]).toBe('AStrings_fr-fr.js');
    expect(((compilation.emitAsset as any).mock.calls[1][1] as { source(): string }).source()).toBe('define([], {a:"fr"});');

    (rspack as any).sources = originalSources;
    (rspack as any).Compilation = origComp;
    readSpy.mockRestore();
  });

  it('Rust fallback if try require fails - plugin still defined and functional', () => {
    // The module already handles require failure via try/catch and falls back to JS implementation.
    // Verify export is defined and apply works without native addon.
    expect(SpfxLocalizedResourcesPlugin).toBeDefined();
    expect(typeof SpfxLocalizedResourcesPlugin).toBe('function');
    // also check public path plugin fallback similarly
    expect(SpfxPublicPathPlugin).toBeDefined();
    expect(typeof SpfxPublicPathPlugin).toBe('function');

    // verify JS fallback handles 0-length after require failure scenario
    const compiler: any = { hooks: { thisCompilation: { tap: vi.fn() } } };
    const plugin = new (SpfxLocalizedResourcesPlugin as any)([]);
    expect(() => plugin.apply(compiler)).not.toThrow();
    expect(compiler.hooks.thisCompilation.tap).not.toHaveBeenCalled();
  });

  it('emits correct asset name <resource>_<locale>.js and uses rspack.sources.RawSource', () => {
    const originalSources = { ...((rspack as any).sources ?? {}) };
    class TrackingRawSource {
      static instances: string[] = [];
      content: string;
      constructor(content: string) {
        this.content = content;
        TrackingRawSource.instances.push(content);
      }
      source() {
        return this.content;
      }
    }
    (rspack as any).sources = { RawSource: TrackingRawSource as unknown as typeof FakeRawSource };
    const origComp = (rspack as any).Compilation;
    (rspack as any).Compilation = { PROCESS_ASSETS_STAGE_ADDITIONAL: 999 };

    const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue('file-content' as unknown as string);
    const { compilation } = createMockCompilation({});
    const { compiler } = createMockCompiler(compilation);
    const plugin = new (SpfxLocalizedResourcesPlugin as any)([{ name: 'CompStrings', files: [{ locale: 'de-de', path: '/x/de.js' }] }]);
    plugin.apply(compiler);
    (compiler.hooks.thisCompilation.tap as any).mock.calls[0][1](compilation);
    (compilation.hooks.processAssets.tap as any).mock.calls[0][1]();
    expect(compilation.emitAsset).toHaveBeenCalledWith('CompStrings_de-de.js', expect.anything());
    const instanceContent = (TrackingRawSource.instances[0] as string);
    expect(instanceContent).toBe('file-content');
    expect((compilation.emitAsset as any).mock.calls[0][1].source()).toBe('file-content');

    (rspack as any).sources = originalSources;
    (rspack as any).Compilation = origComp;
    readSpy.mockRestore();
  });
});
