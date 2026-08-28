import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SPFX_VERSIONS, SPFX_TARGETS, getSpfxVersions, registerSpfxVersion, isSpfxTarget, spfxNpmVersion, __clearRegisteredSpfxVersionsForTests } from '../src/versions.js';
import { tryResolveConfig } from '../src/config.js';

describe('SpfxVersion registry', () => {
  afterEach(() => {
    __clearRegisteredSpfxVersionsForTests();
  });

  it('SPFX_VERSIONS stays as default list initially', () => {
    expect(SPFX_VERSIONS.map((v) => v.target)).toEqual(['1.20', '1.21', '1.22', '1.23', '1.24']);
    expect(getSpfxVersions().map((v) => v.target)).toEqual(['1.20', '1.21', '1.22', '1.23', '1.24']);
  });

  it('registerSpfxVersion adds to getSpfxVersions and SPFX_TARGETS', () => {
    registerSpfxVersion({ target: '1.25', npmVersion: '1.25.0', toolchain: 'heft', status: 'ga' });
    expect(getSpfxVersions().some((v) => v.target === '1.25')).toBe(true);
    expect(SPFX_TARGETS.includes('1.25')).toBe(true);
    expect(isSpfxTarget('1.25')).toBe(true);
    expect(spfxNpmVersion('1.25')).toBe('1.25.0');
  });

  it('registerSpfxVersion validates target pattern', () => {
    expect(() => registerSpfxVersion({ target: '2.0', npmVersion: '2.0.0', toolchain: 'heft', status: 'ga' })).toThrow(/must match/);
    expect(() => registerSpfxVersion({ target: '1.x', npmVersion: '1.x.0', toolchain: 'heft', status: 'ga' })).toThrow(/must match/);
    expect(() => registerSpfxVersion({ target: '1.25 ', npmVersion: '1.25.0', toolchain: 'heft', status: 'ga' } as any)).not.toThrow(); // trimmed passes, but '1.25 ' trimmed is 1.25
    __clearRegisteredSpfxVersionsForTests();
    expect(() => registerSpfxVersion({ target: 'invalid', npmVersion: '1.25.0', toolchain: 'heft', status: 'ga' })).toThrow();
  });

  it('registerSpfxVersion rejects duplicate', () => {
    registerSpfxVersion({ target: '1.26', npmVersion: '1.26.0', toolchain: 'heft', status: 'ga' });
    expect(() => registerSpfxVersion({ target: '1.26', npmVersion: '1.26.0', toolchain: 'heft', status: 'ga' })).toThrow(/already registered/);
    expect(() => registerSpfxVersion({ target: '1.20', npmVersion: '1.20.0', toolchain: 'gulp', status: 'ga' })).toThrow(/already registered/);
  });

  it('tryResolveConfig allows registered version', () => {
    registerSpfxVersion({ target: '1.99', npmVersion: '1.99.0', toolchain: 'heft', status: 'preview' });
    const ok = tryResolveConfig({ name: 'test', spfxVersion: '1.99' });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.spfxVersion).toBe('1.99');
    const bad = tryResolveConfig({ name: 'test', spfxVersion: '1.100' });
    expect(bad.ok).toBe(false);
  });

  it('spfxNpmVersion throws for unknown target', () => {
    expect(() => spfxNpmVersion('9.9')).toThrow(/Unknown SPFx target/);
  });

  it('SPFX_TARGETS is mutable and reflects registry', () => {
    const initialLen = SPFX_TARGETS.length;
    registerSpfxVersion({ target: '1.27', npmVersion: '1.27.0', toolchain: 'heft', status: 'ga' });
    expect(SPFX_TARGETS.length).toBe(initialLen + 1);
    expect(SPFX_TARGETS).toContain('1.27');
  });

  it('isDomainIsolatedDeprecated can be configured via metadata', async () => {
    // Use dynamic import to avoid cycle in core; test sppkg-builder logic separately if needed.
    // Here we just verify the version info carries the flag.
    registerSpfxVersion({ target: '1.30', npmVersion: '1.30.0', toolchain: 'heft', status: 'ga', isDomainIsolatedDeprecated: false });
    const v = getSpfxVersions().find((x) => x.target === '1.30');
    expect(v?.isDomainIsolatedDeprecated).toBe(false);
    registerSpfxVersion({ target: '1.31', npmVersion: '1.31.0', toolchain: 'heft', status: 'ga', isDomainIsolatedDeprecated: true });
    const v2 = getSpfxVersions().find((x) => x.target === '1.31');
    expect(v2?.isDomainIsolatedDeprecated).toBe(true);
  });

  it('register rejects invalid toolchain/status', () => {
    expect(() => registerSpfxVersion({ target: '1.32', npmVersion: '1.32.0', toolchain: 'invalid' as any, status: 'ga' })).toThrow(/toolchain/);
    expect(() => registerSpfxVersion({ target: '1.33', npmVersion: '1.33.0', toolchain: 'heft', status: 'invalid' as any })).toThrow(/status/);
  });

  it('backward compatible: SpfxTarget still accepts 1.23', () => {
    expect(isSpfxTarget('1.23')).toBe(true);
    expect(spfxNpmVersion('1.23')).toBe('1.23.0');
  });
});
