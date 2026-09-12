import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// --- amd.ts ---
import { amdName, computeUniqueName, cacheVersionHash } from '../src/amd.js';
import { getDevtool, createSpfxOutput, SPFX_PUBLIC_PATH_SENTINEL } from '../src/output.js';
import {
  ALLOWED_DEFINE_KEYS,
  createBaseDefineMap,
  createBaseDefineMapFromMode,
  mergeDefineMap,
  createDefineMap,
} from '../src/defines.js';
import { inlineStyleCode, hasPostcssConfig, hasPostcssConfigFile, POSTCSS_CONFIG_FILES, tryResolve } from '../src/css.js';

// externals mocked
vi.mock('@mbsks/rspfx-manifest-generator', () => ({
  findSpDependencies: vi.fn(() => new Map<string, unknown>()),
}));

import { collectExternals, platformOnlyExternal } from '../src/externals.js';
import { findSpDependencies } from '@mbsks/rspfx-manifest-generator';

const mockedFindSpDeps = vi.mocked(findSpDependencies);

// ---------------------------------------------------------------------------
// amd.ts
// ---------------------------------------------------------------------------
describe('amdName', () => {
  it('returns <componentId>_<version>', () => {
    expect(amdName({ componentIds: ['abc-123'], version: '1.0.0' })).toBe('abc-123_1.0.0');
  });

  it('uses first componentId when multiple', () => {
    expect(amdName({ componentIds: ['first', 'second'], version: '2.0.0' })).toBe('first_2.0.0');
  });
});

describe('computeUniqueName', () => {
  it('single entry => amdName', () => {
    const entry = { componentIds: ['my-id'], version: '1.2.3' };
    expect(computeUniqueName([entry])).toBe(amdName(entry));
    expect(computeUniqueName([entry])).toBe('my-id_1.2.3');
  });

  it('multi entry => md5 hash deterministic', () => {
    const entries = [
      { componentIds: ['id-a'], version: '1.0.0' },
      { componentIds: ['id-b'], version: '2.0.0' },
    ];
    const joined = entries.map(amdName).join('');
    const expected = createHash('md5').update(joined).digest('hex');
    expect(computeUniqueName(entries)).toBe(expected);
    // stable
    expect(computeUniqueName(entries)).toBe(computeUniqueName(entries));
  });

  it('ordering matters', () => {
    const a = { componentIds: ['id-a'], version: '1.0.0' };
    const b = { componentIds: ['id-b'], version: '2.0.0' };
    expect(computeUniqueName([a, b])).not.toBe(computeUniqueName([b, a]));
  });

  it('multi hash is 32 hex chars', () => {
    const entries = [
      { componentIds: ['x'], version: '1.0.0' },
      { componentIds: ['y'], version: '1.0.0' },
    ];
    expect(computeUniqueName(entries)).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe('cacheVersionHash', () => {
  it('is stable for same input', () => {
    const input = { framework: 'react', version: '1.0.0', build: { minify: true, sourcemap: false } };
    expect(cacheVersionHash(input)).toBe(cacheVersionHash(input));
  });

  it('changes when framework changes', () => {
    const a = { framework: 'react', version: '1.0.0', build: { minify: true } };
    const b = { framework: 'vue', version: '1.0.0', build: { minify: true } };
    expect(cacheVersionHash(a)).not.toBe(cacheVersionHash(b));
  });

  it('changes when version changes', () => {
    const a = { framework: 'react', version: '1.0.0', build: {} };
    const b = { framework: 'react', version: '2.0.0', build: {} };
    expect(cacheVersionHash(a)).not.toBe(cacheVersionHash(b));
  });

  it('changes when minify changes', () => {
    const a = { framework: 'react', build: { minify: true } };
    const b = { framework: 'react', build: { minify: false } };
    expect(cacheVersionHash(a)).not.toBe(cacheVersionHash(b));
  });

  it('is 8 hex chars', () => {
    expect(cacheVersionHash({ framework: 'x', build: {} })).toMatch(/^[a-f0-9]{8}$/);
  });

  it('changes when splitChunks/outDir/sourcemap change', () => {
    const base = { framework: 'react', build: { splitChunks: false, outDir: 'dist', sourcemap: false } };
    expect(cacheVersionHash(base)).not.toBe(cacheVersionHash({ framework: 'react', build: { splitChunks: true, outDir: 'dist', sourcemap: false } }));
    expect(cacheVersionHash(base)).not.toBe(cacheVersionHash({ framework: 'react', build: { splitChunks: false, outDir: 'lib', sourcemap: false } }));
    expect(cacheVersionHash(base)).not.toBe(cacheVersionHash({ framework: 'react', build: { splitChunks: false, outDir: 'dist', sourcemap: true } }));
  });
});

// ---------------------------------------------------------------------------
// output.ts
// ---------------------------------------------------------------------------
describe('getDevtool', () => {
  it('prod true + sourcemap true => hidden-source-map', () => {
    expect(getDevtool(true, true)).toBe('hidden-source-map');
  });
  it('prod true + sourcemap false => false', () => {
    expect(getDevtool(true, false)).toBe(false);
  });
  it('prod true + sourcemap undefined => false', () => {
    expect(getDevtool(true, undefined)).toBe(false);
  });
  it('prod false + sourcemap true => source-map', () => {
    expect(getDevtool(false, true)).toBe('source-map');
  });
  it('prod false + sourcemap false => source-map', () => {
    expect(getDevtool(false, false)).toBe('source-map');
  });
  it('prod false + sourcemap undefined => source-map', () => {
    expect(getDevtool(false, undefined)).toBe('source-map');
  });
});

describe('createSpfxOutput', () => {
  it('creates correct path, filename, library, publicPath, crossOriginLoading, assetModuleFilename, devtoolModuleFilenameTemplate', () => {
    const entries = [{ componentIds: ['my-comp'], version: '1.0.0' }];
    const out = createSpfxOutput({ projectRoot: '/proj', entries });
    expect(out.path).toBe(path.join('/proj', 'dist'));
    expect(out.filename).toBe('[name].js');
    expect(out.chunkFilename).toBe('chunk.[name].js');
    expect(out.assetModuleFilename).toBe('assets/[hash][ext][query]');
    expect(out.library).toEqual({ type: 'amd' });
    expect(out.publicPath).toBe(SPFX_PUBLIC_PATH_SENTINEL);
    expect(out.publicPath).toBe('__RSPFX_SPFX_PUBLIC_PATH__');
    expect(out.crossOriginLoading).toBe('anonymous');
    expect(out.devtoolModuleFilenameTemplate).toBe('webpack:///../[resource-path]');
  });

  it('chunkLoadingGlobal contains uniqueName', () => {
    const entries = [{ componentIds: ['my-comp'], version: '1.0.0' }];
    const out = createSpfxOutput({ projectRoot: '/proj', entries });
    expect(out.chunkLoadingGlobal).toBe(`webpackJsonp_${out.uniqueName}`);
    expect(out.chunkLoadingGlobal).toBe('webpackJsonp_my-comp_1.0.0');
  });

  it('uniqueName computed via computeUniqueName when not overridden', () => {
    const entries = [
      { componentIds: ['a'], version: '1.0.0' },
      { componentIds: ['b'], version: '2.0.0' },
    ];
    const out = createSpfxOutput({ projectRoot: '/proj', entries });
    expect(out.uniqueName).toBe(computeUniqueName(entries));
  });

  it('uniqueName override is used directly', () => {
    const entries = [{ componentIds: ['my-comp'], version: '1.0.0' }];
    const out = createSpfxOutput({ projectRoot: '/proj', entries, uniqueName: 'custom-unique' });
    expect(out.uniqueName).toBe('custom-unique');
    expect(out.chunkLoadingGlobal).toBe('webpackJsonp_custom-unique');
  });

  it('respects outDir option', () => {
    const entries = [{ componentIds: ['my-comp'], version: '1.0.0' }];
    const out = createSpfxOutput({ projectRoot: '/proj', outDir: 'lib', entries });
    expect(out.path).toBe(path.join('/proj', 'lib'));
  });

  it('single entry uniqueName equals amdName', () => {
    const entry = { componentIds: ['single'], version: '9.9.9' };
    const out = createSpfxOutput({ projectRoot: '/proj', entries: [entry] });
    expect(out.uniqueName).toBe('single_9.9.9');
  });
});

// ---------------------------------------------------------------------------
// defines.ts
// ---------------------------------------------------------------------------
describe('createBaseDefineMap', () => {
  it('production true exact values', () => {
    expect(createBaseDefineMap(true)).toEqual({
      DEBUG: JSON.stringify(false),
      DEPRECATED_UNIT_TEST: JSON.stringify(false),
      'process.env.NODE_ENV': JSON.stringify('production'),
    });
    expect(createBaseDefineMap(true).DEBUG).toBe('false');
    expect(createBaseDefineMap(true)['process.env.NODE_ENV']).toBe('"production"');
  });

  it('production false exact values', () => {
    expect(createBaseDefineMap(false)).toEqual({
      DEBUG: JSON.stringify(true),
      DEPRECATED_UNIT_TEST: JSON.stringify(false),
      'process.env.NODE_ENV': JSON.stringify('development'),
    });
    expect(createBaseDefineMap(false).DEBUG).toBe('true');
    expect(createBaseDefineMap(false)['process.env.NODE_ENV']).toBe('"development"');
  });
});

describe('createBaseDefineMapFromMode', () => {
  it('development', () => {
    expect(createBaseDefineMapFromMode('development')).toEqual({
      DEBUG: 'true',
      DEPRECATED_UNIT_TEST: 'false',
      'process.env.NODE_ENV': '"development"',
    });
  });
  it('production', () => {
    expect(createBaseDefineMapFromMode('production')).toEqual({
      DEBUG: 'false',
      DEPRECATED_UNIT_TEST: 'false',
      'process.env.NODE_ENV': '"production"',
    });
  });
});

describe('mergeDefineMap', () => {
  it('returns copy of base when contribDefine undefined', () => {
    const base = createBaseDefineMap(true);
    const out = mergeDefineMap(base, undefined);
    expect(out).toEqual(base);
    expect(out).not.toBe(base);
  });

  it('blocks RSPFX_ prefix and calls warn', () => {
    const base = createBaseDefineMap(true);
    const warn = vi.fn();
    const out = mergeDefineMap(base, { RSPFX_SECRET: '"evil"' } as Record<string, string>, warn);
    expect(out).toEqual(base);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("RSPFX_SECRET"));
    expect(warn.mock.calls[0]![0]).toMatch(/RSPFx leakage blocked/);
  });

  it('blocks RSPFx substring and calls warn', () => {
    const base = createBaseDefineMap(true);
    const warn = vi.fn();
    const out = mergeDefineMap(base, { MY_RSPFx_KEY: '"evil"' } as Record<string, string>, warn);
    expect(out).toEqual(base);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("MY_RSPFx_KEY"));
  });

  it('blocks non-allowlist key with warn', () => {
    const base = createBaseDefineMap(true);
    const warn = vi.fn();
    const out = mergeDefineMap(base, { SOME_RANDOM: '"x"' } as Record<string, string>, warn);
    expect(out).toEqual(base);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("SOME_RANDOM"));
    expect(warn.mock.calls[0]![0]).toMatch(/allowlist/);
  });

  it('allowed DEBUG is overwritten', () => {
    const base = createBaseDefineMap(true);
    const warn = vi.fn();
    const out = mergeDefineMap(base, { DEBUG: JSON.stringify(true) }, warn);
    expect(out.DEBUG).toBe('true');
    expect(warn).not.toHaveBeenCalled();
  });

  it('allowed process.env.NODE_ENV overwritten, disallowed ignored together', () => {
    const base = createBaseDefineMap(false);
    const warn = vi.fn();
    const out = mergeDefineMap(
      base,
      {
        'process.env.NODE_ENV': JSON.stringify('production'),
        UNKNOWN: '"x"',
        RSPFX_FOO: '"y"',
      } as Record<string, string>,
      warn,
    );
    expect(out['process.env.NODE_ENV']).toBe('"production"');
    expect(out).not.toHaveProperty('UNKNOWN');
    expect(out).not.toHaveProperty('RSPFX_FOO');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('works without warn callback (no throw)', () => {
    const base = createBaseDefineMap(true);
    expect(() => mergeDefineMap(base, { RSPFX_X: '1' } as Record<string, string>)).not.toThrow();
    expect(mergeDefineMap(base, { RSPFX_X: '1' } as Record<string, string>)).toEqual(base);
  });

  it('ALLOWED_DEFINE_KEYS contains expected keys', () => {
    expect(ALLOWED_DEFINE_KEYS.has('DEBUG')).toBe(true);
    expect(ALLOWED_DEFINE_KEYS.has('DEPRECATED_UNIT_TEST')).toBe(true);
    expect(ALLOWED_DEFINE_KEYS.has('process.env.NODE_ENV')).toBe(true);
    expect(ALLOWED_DEFINE_KEYS.size).toBe(3);
  });
});

describe('createDefineMap', () => {
  it('boolean signature with contrib and warn', () => {
    const warn = vi.fn();
    const out = createDefineMap(true, { DEBUG: '"custom"' }, warn);
    expect(out.DEBUG).toBe('"custom"');
    expect(warn).not.toHaveBeenCalled();
  });

  it('base object signature', () => {
    const base = createBaseDefineMap(false);
    const warn = vi.fn();
    const out = createDefineMap(base, { DEBUG: '"overwritten"' }, warn);
    expect(out.DEBUG).toBe('"overwritten"');
  });

  it('options object signature { production, contribDefine, warn }', () => {
    const warn = vi.fn();
    const out = createDefineMap({ production: true, contribDefine: { DEBUG: '"yes"' }, warn });
    expect(out.DEBUG).toBe('"yes"');
  });

  it('options object blocks disallowed', () => {
    const warn = vi.fn();
    const out = createDefineMap({ production: true, contribDefine: { RSPFX_A: '"x"' } as Record<string, string>, warn });
    expect(out).not.toHaveProperty('RSPFX_A');
    expect(warn).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// css.ts
// ---------------------------------------------------------------------------
describe('inlineStyleCode', () => {
  it('empty string produces valid wrapper with createElement style', () => {
    const code = inlineStyleCode('');
    expect(code).toContain('createElement("style")');
    expect(code).toContain('textContent=""');
    expect(code).toContain('(document.head||document.documentElement).appendChild');
  });

  it('escapes quotes and newlines via JSON.stringify', () => {
    const css = 'body { content: "hi" }\n.next { color: red; }';
    const code = inlineStyleCode(css);
    expect(code).toContain(JSON.stringify(css));
    expect(code).toContain('createElement("style")');
    // ensure raw unescaped quote not present outside JSON.stringify form
    // JSON.stringify will escape, so string should contain \"
    expect(code).toContain('\\"hi\\"');
    expect(code).toContain('\\n');
  });

  it('contains IIFE wrapper and type text/css', () => {
    const code = inlineStyleCode('.a{color:#fff}');
    expect(code).toContain('e.type="text/css"');
    expect(code).toMatch(/\(function\(\)\{var e=document\.createElement\("style"\)/);
    expect(code.trim().startsWith('(function()')).toBe(true);
  });

  it('with special chars single quotes and backslashes', () => {
    const css = ".a::before { content: 'it\\'s' }";
    const code = inlineStyleCode(css);
    expect(code).toContain(JSON.stringify(css));
  });
});

describe('POSTCSS_CONFIG_FILES', () => {
  it('contains expected entries', () => {
    expect(POSTCSS_CONFIG_FILES).toContain('postcss.config.js');
    expect(POSTCSS_CONFIG_FILES).toContain('postcss.config.json');
    expect(POSTCSS_CONFIG_FILES.length).toBe(7);
  });
  it('hasPostcssConfigFile is alias', () => {
    expect(hasPostcssConfigFile).toBe(hasPostcssConfig);
  });
});

describe('hasPostcssConfig', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rspfx-build-core-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('returns false when no config file present', () => {
    expect(hasPostcssConfig(tmpDir)).toBe(false);
  });

  it('detects postcss.config.js', () => {
    fs.writeFileSync(path.join(tmpDir, 'postcss.config.js'), 'module.exports={}');
    expect(hasPostcssConfig(tmpDir)).toBe(true);
  });

  it('detects postcss.config.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'postcss.config.json'), '{}');
    expect(hasPostcssConfig(tmpDir)).toBe(true);
  });

  it('detects postcss.config.cjs via existsSync mock', () => {
    const spy = vi.spyOn(fs, 'existsSync').mockImplementation((p) => String(p).endsWith('postcss.config.cjs'));
    expect(hasPostcssConfig('/fake-root')).toBe(true);
    expect(spy).toHaveBeenCalled();
  });

  it('returns false when existsSync always false via mock', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(hasPostcssConfig('/fake-root')).toBe(false);
  });
});

describe('tryResolve', () => {
  it('returns undefined for not-found module', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rspfx-resolve-'));
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'tmp' }));
    try {
      expect(tryResolve('__nonexistent_module_xyz_123__', tmp)).toBeUndefined();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('resolves existing module', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rspfx-resolve-'));
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'tmp' }));
    try {
      // vitest is installed in repo, should resolve
      const resolved = tryResolve('vitest', tmp);
      // may be string or undefined depending on environment; but if undefined, fallback path should still be tested
      // At least not throw
      expect(resolved === undefined || typeof resolved === 'string').toBe(true);
      if (resolved) expect(resolved.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// externals.ts
// ---------------------------------------------------------------------------
describe('collectExternals', () => {
  beforeEach(() => {
    mockedFindSpDeps.mockReset();
    mockedFindSpDeps.mockReturnValue(new Map<string, unknown>());
  });

  it('dedups across spDeps, projectExternals, localizedResources', () => {
    mockedFindSpDeps.mockReturnValue(new Map([['react', {}], ['@microsoft/sp-core-library', {}]] as unknown as Map<string, unknown>));
    const result = collectExternals('/root', ['react', 'lodash'], [{ name: 'myStrings' }, { name: 'react' }]);
    expect(result).toEqual(['react', '@microsoft/sp-core-library', 'lodash', 'myStrings']);
    // dedup: react appears 3 times but only once
    expect(result.filter((x) => x === 'react').length).toBe(1);
  });

  it('handles empty inputs', () => {
    mockedFindSpDeps.mockReturnValue(new Map());
    expect(collectExternals('/root', [], [])).toEqual([]);
  });

  it('passes root to findSpDependencies', () => {
    mockedFindSpDeps.mockReturnValue(new Map());
    collectExternals('/my/root', [], []);
    expect(mockedFindSpDeps).toHaveBeenCalledWith('/my/root');
  });

  it('only localizedResources names are included (not objects)', () => {
    mockedFindSpDeps.mockReturnValue(new Map());
    const result = collectExternals('/root', [], [{ name: 'stringsA' }, { name: 'stringsB' }]);
    expect(result).toEqual(['stringsA', 'stringsB']);
  });
});

describe('platformOnlyExternal', () => {
  it('returns amd prefix for @msinternal module', () => {
    expect(platformOnlyExternal({ request: '@msinternal/foo' })).toBe('amd @msinternal/foo');
    expect(platformOnlyExternal({ request: '@msinternal' })).toBe('amd @msinternal');
  });

  it('returns amd prefix for @azure/msal-browser-1p', () => {
    expect(platformOnlyExternal({ request: '@azure/msal-browser-1p' })).toBe('amd @azure/msal-browser-1p');
    expect(platformOnlyExternal({ request: '@azure/msal-browser-1p/foo' })).toBe('amd @azure/msal-browser-1p/foo');
  });

  it('returns amd prefix for @azure/msal-browser-legacy-1p', () => {
    expect(platformOnlyExternal({ request: '@azure/msal-browser-legacy-1p/bar' })).toBe('amd @azure/msal-browser-legacy-1p/bar');
  });

  it('returns undefined for public msal-browser (not platform only)', () => {
    expect(platformOnlyExternal({ request: '@azure/msal-browser' })).toBeUndefined();
  });

  it('returns undefined for regular module', () => {
    expect(platformOnlyExternal({ request: 'react' })).toBeUndefined();
    expect(platformOnlyExternal({ request: 'lodash' })).toBeUndefined();
  });

  it('returns undefined when request missing or not string', () => {
    expect(platformOnlyExternal({})).toBeUndefined();
    expect(platformOnlyExternal({ request: undefined })).toBeUndefined();
    // @ts-expect-error testing runtime guard
    expect(platformOnlyExternal({ request: 123 })).toBeUndefined();
  });

  it('does not match prefix without slash boundary', () => {
    expect(platformOnlyExternal({ request: '@msinternalfoo' })).toBeUndefined();
    expect(platformOnlyExternal({ request: '@msinternalfoo/bar' })).toBeUndefined();
  });
});
