import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { deterministicGuid, toPascal } from '../src/utils.js';
import { isAllowedOrigin } from '../src/cors.js';
import { isPlatformOnlyModule } from '../src/platform.js';
import { solidPng } from '../src/png.js';

describe('toPascal', () => {
  it('converts kebab-case', () => {
    expect(toPascal('hello-world')).toBe('HelloWorld');
  });

  it('converts snake_case', () => {
    expect(toPascal('snake_case')).toBe('SnakeCase');
  });

  it('converts single letters a-b-c', () => {
    expect(toPascal('a-b-c')).toBe('ABC');
  });

  it('handles alreadyPascal without separator', () => {
    expect(toPascal('HelloWorld')).toBe('HelloWorld');
    expect(toPascal('alreadyPascal')).toBe('AlreadyPascal');
  });

  it('returns empty string for empty input', () => {
    expect(toPascal('')).toBe('');
  });

  it('handles mixed separators', () => {
    expect(toPascal('foo-bar_baz')).toBe('FooBarBaz');
  });

  it('handles single word', () => {
    expect(toPascal('hello')).toBe('Hello');
  });
});

describe('deterministicGuid', () => {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('produces valid UUID v4 format', () => {
    expect(deterministicGuid('hello')).toMatch(uuidV4Regex);
    expect(deterministicGuid('')).toMatch(uuidV4Regex);
    expect(deterministicGuid('seed-123')).toMatch(uuidV4Regex);
  });

  it('sha256 slice 32 + dash insertion matches manual hash', () => {
    const seed = 'hello-world';
    const hash = createHash('sha256').update(seed).digest('hex').slice(0, 32);
    const raw = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
    const chars = raw.split('');
    chars[14] = '4';
    const variantVal = parseInt(chars[19]!, 16);
    chars[19] = ((variantVal & 0x3) | 0x8).toString(16);
    const expected = chars.join('');
    expect(deterministicGuid(seed)).toBe(expected);
  });

  it('forces chars[14] to 4 (version nibble)', () => {
    for (const seed of ['a', 'b', 'test', 'another-seed', '123']) {
      expect(deterministicGuid(seed)[14]).toBe('4');
    }
  });

  it('forces variant bits (val &0x3)|0x8 at pos 19 => 8/9/a/b', () => {
    for (const seed of ['a', 'b', 'hello', 'world', 'seed1', 'seed2']) {
      const c = deterministicGuid(seed)[19]!;
      expect(['8', '9', 'a', 'b']).toContain(c);
      const rawHash = createHash('sha256').update(seed).digest('hex').slice(0, 32);
      const rawUuid = `${rawHash.slice(0, 8)}-${rawHash.slice(8, 12)}-${rawHash.slice(12, 16)}-${rawHash.slice(16, 20)}-${rawHash.slice(20, 32)}`;
      const orig = parseInt(rawUuid[19]!, 16);
      const expected = ((orig & 0x3) | 0x8).toString(16);
      expect(c).toBe(expected);
    }
  });

  it('is deterministic for same seed', () => {
    expect(deterministicGuid('same-seed')).toBe(deterministicGuid('same-seed'));
  });

  it('different seeds produce different GUIDs', () => {
    expect(deterministicGuid('seed-a')).not.toBe(deterministicGuid('seed-b'));
  });

  it('inserts dashes at correct positions', () => {
    const guid = deterministicGuid('dash-test');
    expect(guid[8]).toBe('-');
    expect(guid[13]).toBe('-');
    expect(guid[18]).toBe('-');
    expect(guid[23]).toBe('-');
    expect(guid.length).toBe(36);
  });
});

describe('isAllowedOrigin', () => {
  it('allows localhost and loopback', () => {
    expect(isAllowedOrigin('https://localhost:4321')).toBe(true);
    expect(isAllowedOrigin('https://localhost')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:4321')).toBe(true);
    expect(isAllowedOrigin('http://[::1]:4321')).toBe(true);
    expect(isAllowedOrigin('https://[::1]')).toBe(true);
  });

  it('allows sharepoint domains', () => {
    expect(isAllowedOrigin('https://mytenant.sharepoint.com')).toBe(true);
    expect(isAllowedOrigin('https://mytenant.sharepoint-df.com')).toBe(true);
    expect(isAllowedOrigin('https://mytenant.sharepoint.cn')).toBe(true);
    expect(isAllowedOrigin('https://FOO.SHAREPOINT.COM')).toBe(true);
  });

  it('rejects non-allowed origins', () => {
    expect(isAllowedOrigin('https://example.com')).toBe(false);
    expect(isAllowedOrigin('https://evilsharepoint.com')).toBe(false);
    expect(isAllowedOrigin('https://sharepoint.com')).toBe(false);
    expect(isAllowedOrigin('https://localhost.evil.com')).toBe(false);
  });

  it('returns false for invalid URL', () => {
    expect(isAllowedOrigin('')).toBe(false);
    expect(isAllowedOrigin('not-a-url')).toBe(false);
    expect(isAllowedOrigin('http://')).toBe(false);
  });
});

describe('isPlatformOnlyModule', () => {
  it('returns true for exact prefixes', () => {
    expect(isPlatformOnlyModule('@msinternal')).toBe(true);
    expect(isPlatformOnlyModule('@azure/msal-browser-1p')).toBe(true);
    expect(isPlatformOnlyModule('@azure/msal-browser-legacy-1p')).toBe(true);
  });

  it('returns true for subpaths', () => {
    expect(isPlatformOnlyModule('@msinternal/foo')).toBe(true);
    expect(isPlatformOnlyModule('@msinternal/feature-flags')).toBe(true);
    expect(isPlatformOnlyModule('@azure/msal-browser-1p/dist')).toBe(true);
    expect(isPlatformOnlyModule('@azure/msal-browser-legacy-1p/utils')).toBe(true);
  });

  it('returns false for similar but non-matching', () => {
    expect(isPlatformOnlyModule('@msinternalfoo')).toBe(false);
    expect(isPlatformOnlyModule('@azure/msal-browser')).toBe(false);
    expect(isPlatformOnlyModule('react')).toBe(false);
    expect(isPlatformOnlyModule('@microsoft/sp-http')).toBe(false);
    expect(isPlatformOnlyModule('')).toBe(false);
  });
});

describe('solidPng', () => {
  it('produces PNG with correct 8-byte signature', () => {
    const png = solidPng(1, 1, [255, 0, 0]);
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.subarray(0, 8)).toEqual(sig);
  });

  it('encodes width/height in IHDR', () => {
    const png = solidPng(2, 3, [0, 128, 255]);
    // IHDR chunk: 8 sig + 4 len + 4 type( IHDR) + 13 data
    // IHDR data starts at offset 8+8=16, width at 16, height at 20
    const ihdrDataOffset = 8 + 8;
    expect(png.readUInt32BE(ihdrDataOffset)).toBe(2);
    expect(png.readUInt32BE(ihdrDataOffset + 4)).toBe(3);
    expect(png[ihdrDataOffset + 8]).toBe(8); // bit depth
    expect(png[ihdrDataOffset + 9]).toBe(2); // color type truecolor
  });

  it('ends with IEND chunk', () => {
    const png = solidPng(1, 1, [0, 0, 0]);
    // last 12 bytes: 4 len(0) + 4 type(IEND) + 4 crc
    const tail = png.subarray(png.length - 12);
    expect(tail.readUInt32BE(0)).toBe(0);
    expect(tail.subarray(4, 8).toString('ascii')).toBe('IEND');
  });

  it('different colors produce different buffers', () => {
    const a = solidPng(1, 1, [255, 0, 0]);
    const b = solidPng(1, 1, [0, 255, 0]);
    expect(a.equals(b)).toBe(false);
  });
});
