import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as crypto from 'node:crypto';

// hoisted mocks for child_process
const { mockExecFile, mockSpawn } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
  mockSpawn: vi.fn(),
}));
vi.mock('node:child_process', async () => {
  const actual = (await vi.importActual('node:child_process')) as Record<string, unknown>;
  const { promisify } = await import('node:util');
  (mockExecFile as unknown as Record<symbol, unknown>)[promisify.custom] = (cmd: unknown, args: unknown, opts: unknown) =>
    new Promise((resolve, reject) => {
      (mockExecFile as unknown as (c: unknown, a: unknown, o: unknown, cb: (err: unknown, stdout?: string, stderr?: string) => void) => void)(
        cmd,
        args,
        opts,
        (err: unknown, stdout?: string, stderr?: string) => {
          if (err) reject(err);
          else resolve({ stdout: stdout ?? '', stderr: stderr ?? '' });
        }
      );
    });
  return { ...actual, execFile: mockExecFile, spawn: mockSpawn };
});

import {
  validateCustomHostname,
  ensureCertificates,
  getCertStatus,
  isCertTrusted,
  tryTrustCert,
  formatTrustInstructions,
} from '../src/index.js';

describe('validateCustomHostname', () => {
  it('allows built-ins localhost, 127.0.0.1, ::1', () => {
    expect(() => validateCustomHostname('localhost')).not.toThrow();
    expect(() => validateCustomHostname('127.0.0.1')).not.toThrow();
    expect(() => validateCustomHostname('::1')).not.toThrow();
  });

  it('allows valid IPs via isIP', () => {
    expect(() => validateCustomHostname('192.168.1.1')).not.toThrow();
    expect(() => validateCustomHostname('10.0.0.5')).not.toThrow();
    expect(() => validateCustomHostname('::1')).not.toThrow();
    expect(() => validateCustomHostname('2001:db8::1')).not.toThrow();
    expect(() => validateCustomHostname('fe80::1')).not.toThrow();
  });

  it('rejects sharepoint.com suffixes', () => {
    expect(() => validateCustomHostname('foo.sharepoint.com')).toThrow(/sharepoint domain/);
    expect(() => validateCustomHostname('bar.sharepoint-df.com')).toThrow(/sharepoint domain/);
    expect(() => validateCustomHostname('baz.sharepoint.cn')).toThrow(/sharepoint domain/);
    expect(() => validateCustomHostname('sharepoint.com')).toThrow(/sharepoint domain/);
    expect(() => validateCustomHostname('sharepoint-df.com')).toThrow(/sharepoint domain/);
    expect(() => validateCustomHostname('sharepoint.cn')).toThrow(/sharepoint domain/);
    // case-insensitive
    expect(() => validateCustomHostname('FOO.SHAREPOINT.COM')).toThrow(/sharepoint domain/);
    expect(() => validateCustomHostname('My.SharePoint.Cn')).toThrow(/sharepoint domain/);
  });

  it('rejects empty and too long (>253)', () => {
    expect(() => validateCustomHostname('')).toThrow(/length must be 1..253/);
    expect(() => validateCustomHostname('a'.repeat(254))).toThrow(/length must be 1..253/);
  });

  it('rejects label empty, too long (>63), starts-with -', () => {
    // label empty via leading dot or double dot already, but direct via split
    expect(() => validateCustomHostname('.foo')).toThrow(/must not start\/end/);
    expect(() => validateCustomHostname('foo.')).toThrow(/must not start\/end/);
    // label >63
    const longLabel = 'a'.repeat(64);
    expect(() => validateCustomHostname(`${longLabel}.com`)).toThrow(/label.*length must be 1..63/);
    // label starts/ends with -
    expect(() => validateCustomHostname('-foo.com')).toThrow(/must not start\/end/);
    expect(() => validateCustomHostname('foo.-bar.com')).toThrow(/label.*must not start\/end/);
    expect(() => validateCustomHostname('foo.bar-')).toThrow(/must not start\/end/);
    expect(() => validateCustomHostname('a.-b')).toThrow(/label/);
    expect(() => validateCustomHostname('a.b-')).toThrow(/must not start/);
  });

  it('rejects ..', () => {
    expect(() => validateCustomHostname('foo..bar')).toThrow(/must not contain "\.\."/);
    expect(() => validateCustomHostname('a..b..c')).toThrow(/\.\./);
  });

  it('rejects regex [^a-z0-9.-] with ; & etc', () => {
    const bad = ['foo;bar', 'foo&bar', 'foo/bar', 'foo:bar', 'foo bar', 'foo%bar', 'foo"bar', "foo'bar", 'foo\\bar', 'foo@bar', 'foo!bar', 'foo*bar', 'foo+bar', 'foo=bar', 'foo$bar'];
    for (const h of bad) {
      expect(() => validateCustomHostname(h), `should reject ${JSON.stringify(h)}`).toThrow(/must match/);
    }
  });

  it('rejects leading/trailing . or -', () => {
    expect(() => validateCustomHostname('.example.com')).toThrow(/must not start\/end/);
    expect(() => validateCustomHostname('example.com.')).toThrow(/must not start\/end/);
    expect(() => validateCustomHostname('-example.com')).toThrow(/must not start\/end/);
    expect(() => validateCustomHostname('example.com-')).toThrow(/must not start\/end/);
  });

  it('accepts valid DNS names', () => {
    expect(() => validateCustomHostname('my-dev.local')).not.toThrow();
    expect(() => validateCustomHostname('dev-host')).not.toThrow();
    expect(() => validateCustomHostname('example.com')).not.toThrow();
    expect(() => validateCustomHostname('a-b.c-d')).not.toThrow();
    expect(() => validateCustomHostname('host123')).not.toThrow();
  });
});

describe('ensureCertificates', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'rspfx-cert-extra-'));
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  async function genPems(altNames: { type: number; value?: string; ip?: string }[], days = 825) {
    const selfsigned = (await import('selfsigned')).default as unknown as {
      generate: (attrs: { name: string; value: string }[], opts: unknown) => Promise<{ private: string; cert: string }>;
    };
    return selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
      keySize: 2048,
      days,
      algorithm: 'sha256',
      extensions: [
        { name: 'extKeyUsage', serverAuth: true },
        { name: 'subjectAltName', altNames },
      ],
    });
  }

  it('regen when expiry <7 days', async () => {
    const altNames = [
      { type: 2, value: 'localhost' },
      { type: 7, ip: '127.0.0.1' },
      { type: 7, ip: '::1' },
    ];
    const pems = await genPems(altNames, 3); // 3 days = <7
    await mkdir(tmp, { recursive: true });
    await writeFile(path.join(tmp, 'key.pem'), pems.private);
    await writeFile(path.join(tmp, 'cert.pem'), pems.cert);
    const result = await ensureCertificates(tmp);
    // should have regenerated to 825 days -> expiry far future
    const x509 = new crypto.X509Certificate(result.cert);
    const expiry = Date.parse(x509.validTo);
    expect(expiry - Date.now()).toBeGreaterThan(7 * 24 * 60 * 60 * 1000);
    expect(result.cert).not.toBe(pems.cert);
  });

  it('regen when hostname SAN missing', async () => {
    const altNames = [
      { type: 2, value: 'localhost' },
      { type: 7, ip: '127.0.0.1' },
      { type: 7, ip: '::1' },
    ];
    const pems = await genPems(altNames, 825);
    await mkdir(tmp, { recursive: true });
    await writeFile(path.join(tmp, 'key.pem'), pems.private);
    await writeFile(path.join(tmp, 'cert.pem'), pems.cert);
    // request custom hostname missing from existing cert -> regen
    const result = await ensureCertificates(tmp, 'myhost.local');
    const x509 = new crypto.X509Certificate(result.cert);
    expect(x509.subjectAltName ?? '').toContain('myhost.local');
  });

  it('regen when ::1 missing', async () => {
    const altNames = [
      { type: 2, value: 'localhost' },
      { type: 7, ip: '127.0.0.1' },
      // missing ::1
    ];
    const pems = await genPems(altNames, 825);
    await mkdir(tmp, { recursive: true });
    await writeFile(path.join(tmp, 'key.pem'), pems.private);
    await writeFile(path.join(tmp, 'cert.pem'), pems.cert);
    const before = pems.cert;
    const result = await ensureCertificates(tmp);
    const x509 = new crypto.X509Certificate(result.cert);
    const alt = x509.subjectAltName ?? '';
    expect(alt.includes('::1') || alt.includes('0:0:0:0:0:0:0:1')).toBe(true);
    expect(result.cert).not.toBe(before);
  });

  it('regen on cert parse throw (invalid cert)', async () => {
    await mkdir(tmp, { recursive: true });
    await writeFile(path.join(tmp, 'key.pem'), 'invalid-key');
    await writeFile(path.join(tmp, 'cert.pem'), 'not-a-cert');
    const result = await ensureCertificates(tmp);
    expect(result.cert).toContain('BEGIN CERTIFICATE');
    expect(result.key).toMatch(/BEGIN .*PRIVATE KEY/);
  });

  it('altNames IPv4 vs DNS: IP hostname adds type 7, DNS adds type 2', async () => {
    const ipDir = await mkdtemp(path.join(os.tmpdir(), 'rspfx-ip-'));
    const dnsDir = await mkdtemp(path.join(os.tmpdir(), 'rspfx-dns-'));
    try {
      const ipResult = await ensureCertificates(ipDir, '192.168.5.10');
      const ip509 = new crypto.X509Certificate(ipResult.cert);
      const ipAlt = ip509.subjectAltName ?? '';
      expect(ipAlt).toContain('192.168.5.10');
      // IP should appear as IP Address
      expect(ipAlt).toMatch(/IP Address:192\.168\.5\.10/);

      const dnsResult = await ensureCertificates(dnsDir, 'myhost.local');
      const dns509 = new crypto.X509Certificate(dnsResult.cert);
      const dnsAlt = dns509.subjectAltName ?? '';
      expect(dnsAlt).toContain('myhost.local');
      expect(dnsAlt).toMatch(/DNS:myhost\.local/);
    } finally {
      await rm(ipDir, { recursive: true, force: true });
      await rm(dnsDir, { recursive: true, force: true });
    }
  });

  it('file write .tmp->rename, no .tmp left, modes 0o600/0o644', async () => {
    const result = await ensureCertificates(tmp, 'extra.local');
    const files = await readdir(tmp);
    expect(files).not.toContain('key.pem.tmp');
    expect(files).not.toContain('cert.pem.tmp');
    expect(files).not.toContain('cert.pem.trust.txt.tmp');
    expect(files).toContain('key.pem');
    expect(files).toContain('cert.pem');
    expect(files).toContain('cert.pem.trust.txt');
    const keyMode = (await stat(path.join(tmp, 'key.pem'))).mode & 0o777;
    const certMode = (await stat(path.join(tmp, 'cert.pem'))).mode & 0o777;
    const trustMode = (await stat(path.join(tmp, 'cert.pem.trust.txt'))).mode & 0o777;
    expect(keyMode).toBe(0o600);
    expect(certMode).toBe(0o644);
    expect(trustMode).toBe(0o644);
    // sanity: returned values match files
    const keyFile = await readFile(path.join(tmp, 'key.pem'), 'utf8');
    const certFile = await readFile(path.join(tmp, 'cert.pem'), 'utf8');
    expect(result.key).toBe(keyFile);
    expect(result.cert).toBe(certFile);
  });

  it('caches when valid cert exists (no regen)', async () => {
    const first = await ensureCertificates(tmp);
    // capture mtime
    const s1 = await stat(path.join(tmp, 'cert.pem'));
    await new Promise((r) => setTimeout(r, 10));
    const second = await ensureCertificates(tmp);
    const s2 = await stat(path.join(tmp, 'cert.pem'));
    expect(second.cert).toBe(first.cert);
    expect(s2.mtimeMs).toBe(s1.mtimeMs);
  });
});

describe('getCertStatus', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'rspfx-status-'));
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('returns exists false when missing files', async () => {
    const st = await getCertStatus(tmp);
    expect(st.exists).toBe(false);
    expect(st.valid).toBe(false);
    expect(st.detail).toMatch(/missing/);
    expect(st.keyExists).toBe(false);
    expect(st.certExists).toBe(false);
  });

  it('returns valid true with daysUntilExpiry calc and expiresAt', async () => {
    await ensureCertificates(tmp);
    const st = await getCertStatus(tmp);
    expect(st.exists).toBe(true);
    expect(st.valid).toBe(true);
    expect(st.expiresAt).toBeDefined();
    expect(typeof st.daysUntilExpiry).toBe('number');
    // 825 days -> approx 825
    expect(st.daysUntilExpiry!).toBeGreaterThan(800);
    expect(st.daysUntilExpiry!).toBeLessThan(830);
  });

  it('returns valid false when expiry <7 days', async () => {
    // generate 2-day cert manually
    const selfsigned = (await import('selfsigned')).default as unknown as {
      generate: (a: unknown, o: unknown) => Promise<{ private: string; cert: string }>;
    };
    const pems = await selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
      keySize: 2048,
      days: 2,
      algorithm: 'sha256',
      extensions: [
        { name: 'extKeyUsage', serverAuth: true },
        { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }, { type: 7, ip: '::1' }] },
      ],
    });
    await mkdir(tmp, { recursive: true });
    await writeFile(path.join(tmp, 'key.pem'), pems.private);
    await writeFile(path.join(tmp, 'cert.pem'), pems.cert);
    const st = await getCertStatus(tmp);
    expect(st.valid).toBe(false);
    expect(st.detail).toMatch(/expires in/);
    expect(st.daysUntilExpiry).toBeDefined();
    expect(st.daysUntilExpiry!).toBeLessThan(7);
  });

  it('hostnameMismatch true for missing ::1 and missing hostname', async () => {
    const selfsigned = (await import('selfsigned')).default as unknown as {
      generate: (a: unknown, o: unknown) => Promise<{ private: string; cert: string }>;
    };
    const pemsNoIpv6 = await selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
      keySize: 2048,
      days: 825,
      algorithm: 'sha256',
      extensions: [
        { name: 'extKeyUsage', serverAuth: true },
        { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }] },
      ],
    });
    await mkdir(tmp, { recursive: true });
    await writeFile(path.join(tmp, 'key.pem'), pemsNoIpv6.private);
    await writeFile(path.join(tmp, 'cert.pem'), pemsNoIpv6.cert);

    const st1 = await getCertStatus(tmp);
    expect(st1.valid).toBe(false);
    expect(st1.hostnameMismatch).toBe(true);
    expect(st1.detail).toMatch(/SAN missing ::1/);

    const st2 = await getCertStatus(tmp, 'myhost.local');
    expect(st2.valid).toBe(false);
    expect(st2.hostnameMismatch).toBe(true);
    // missing hostname takes precedence when both missing
    expect(st2.detail).toMatch(/SAN missing hostname/);

    // now valid cert but hostname mismatch
    const validDir = await mkdtemp(path.join(os.tmpdir(), 'rspfx-status-valid-'));
    try {
      await ensureCertificates(validDir); // has ::1 but not myhost.local
      const st3 = await getCertStatus(validDir, 'other.local');
      expect(st3.valid).toBe(false);
      expect(st3.hostnameMismatch).toBe(true);
      expect(st3.detail).toMatch(/SAN missing hostname other.local/);
    } finally {
      await rm(validDir, { recursive: true, force: true });
    }
  });

  it('catch returns detail error on invalid cert', async () => {
    await mkdir(tmp, { recursive: true });
    await writeFile(path.join(tmp, 'key.pem'), 'key');
    await writeFile(path.join(tmp, 'cert.pem'), 'not-a-cert-pem');
    const st = await getCertStatus(tmp);
    expect(st.exists).toBe(true);
    expect(st.valid).toBe(false);
    expect(st.detail).toBeDefined();
    expect(typeof st.detail).toBe('string');
    expect(st.detail!.length).toBeGreaterThan(0);
  });

  it('!X509CertificateCtor valid true (mocked crypto)', async () => {
    // isolate module with X509Certificate undefined
    vi.resetModules();
    vi.doMock('node:crypto', async () => {
      const actual = (await vi.importActual('node:crypto')) as Record<string, unknown>;
      return { ...actual, X509Certificate: undefined };
    });
    // need to re-mock child_process after reset
    vi.doMock('node:child_process', async () => {
      const actual = (await vi.importActual('node:child_process')) as Record<string, unknown>;
      return { ...actual, execFile: mockExecFile, spawn: mockSpawn };
    });
    const mod = (await import('../src/index.js')) as typeof import('../src/index.js');
    const dir = await mkdtemp(path.join(os.tmpdir(), 'rspfx-nox509-'));
    try {
      // create files so exists check passes
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, 'key.pem'), 'dummy-key');
      await writeFile(path.join(dir, 'cert.pem'), 'dummy-cert');
      const st = await mod.getCertStatus(dir);
      expect(st.exists).toBe(true);
      expect(st.valid).toBe(true);
      expect(st.detail).toMatch(/X509Certificate unavailable/);
    } finally {
      await rm(dir, { recursive: true, force: true });
      vi.resetModules();
    }
  });

  it('expiresAt invalid NaN returns valid false', async () => {
    vi.resetModules();
    // mock X509Certificate to return invalid validTo
    vi.doMock('node:crypto', async () => {
      const actual = (await vi.importActual('node:crypto')) as Record<string, unknown>;
      class FakeX509 {
        validTo = 'not-a-date';
        subjectAltName = 'DNS:localhost, IP Address:127.0.0.1, IP Address:::1';
        constructor(_pem: string) {}
      }
      return { ...actual, X509Certificate: FakeX509 };
    });
    vi.doMock('node:child_process', async () => {
      const actual = (await vi.importActual('node:child_process')) as Record<string, unknown>;
      return { ...actual, execFile: mockExecFile, spawn: mockSpawn };
    });
    const mod = (await import('../src/index.js')) as typeof import('../src/index.js');
    const dir = await mkdtemp(path.join(os.tmpdir(), 'rspfx-nan-'));
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, 'key.pem'), 'k');
      await writeFile(path.join(dir, 'cert.pem'), 'c');
      const st = await mod.getCertStatus(dir);
      expect(st.valid).toBe(false);
      expect(st.detail).toMatch(/invalid expiry/);
      expect(st.expiresAt).toBe('not-a-date');
    } finally {
      await rm(dir, { recursive: true, force: true });
      vi.resetModules();
    }
  });

  it('daysUntilExpiry calc is floor of (expiry-now)/day', async () => {
    // generate cert with known days and check daysUntilExpiry roughly equals days
    const dir = await mkdtemp(path.join(os.tmpdir(), 'rspfx-days-'));
    try {
      await ensureCertificates(dir);
      const st = await getCertStatus(dir);
      // compute expected via X509Certificate directly
      const certPem = await readFile(path.join(dir, 'cert.pem'), 'utf8');
      const x509 = new crypto.X509Certificate(certPem);
      const expiry = Date.parse(x509.validTo);
      const expected = Math.floor((expiry - Date.now()) / (24 * 60 * 60 * 1000));
      expect(st.daysUntilExpiry).toBe(expected);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('isCertTrusted platform branches', () => {
  const origPlatform = process.platform;
  const origEnv = { ...process.env };
  beforeEach(() => {
    mockExecFile.mockReset();
    mockSpawn.mockReset();
  });
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    process.env = { ...origEnv };
    vi.restoreAllMocks();
  });

  it('darwin success -> trusted true', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (e: Error | null, out?: string) => void) => {
      cb(null, '', '');
    });
    const res = await isCertTrusted('/tmp/cert.pem');
    expect(res.trusted).toBe(true);
    expect(res.detail).toMatch(/security verify-cert succeeded/);
    expect(mockExecFile).toHaveBeenCalledWith('security', expect.arrayContaining(['verify-cert']), expect.any(Object), expect.any(Function));
  });

  it('darwin failure with CSSMERR -> trusted false', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (e: unknown) => void) => {
      cb(new Error('CSSMERR_TP_NOT_TRUSTED'));
    });
    // need cert file to exist for fallback readFile branch? Actually first catch checks msg includes CSSMERR -> returns false immediately before readFile.
    const res = await isCertTrusted('/tmp/cert.pem');
    expect(res.trusted).toBe(false);
    expect(res.detail).toMatch(/untrusted/);
  });

  it('darwin failure generic -> fallback readFile and trusted false with path', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (e: unknown) => void) => {
      cb(new Error('some other failure'));
    });
    const dir = await mkdtemp(path.join(os.tmpdir(), 'rspfx-trust-'));
    try {
      const certPath = path.join(dir, 'cert.pem');
      await writeFile(certPath, 'dummy-pem');
      const res = await isCertTrusted(certPath);
      expect(res.trusted).toBe(false);
      expect(res.detail).toContain(certPath);
      expect(res.detail).toMatch(/not trusted/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('darwin failure and readFile fails -> unknown', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (e: unknown) => void) => {
      cb(new Error('generic fail no trust'));
    });
    const res = await isCertTrusted('/nonexistent/cert.pem');
    expect(res.trusted).toBe('unknown');
  });

  it('win32 stdout trusted -> true', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (e: null, out: string, err: string) => void) => {
      cb(null, 'Cert is trusted Verified OK', '');
    });
    const res = await isCertTrusted('C:\\cert.pem');
    expect(res.trusted).toBe(true);
    expect(res.detail).toMatch(/certutil -verify reports trusted/);
  });

  it('win32 stdout not trusted -> false', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (e: null, out: string) => void) => {
      cb(null, 'some output without trusted keyword');
    });
    const res = await isCertTrusted('C:\\cert.pem');
    expect(res.trusted).toBe(false);
    expect(res.detail).toMatch(/not in Trusted Root/);
  });

  it('win32 exec error -> unknown', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (e: unknown) => void) => {
      cb(new Error('certutil not found'));
    });
    const res = await isCertTrusted('C:\\cert.pem');
    expect(res.trusted).toBe('unknown');
    expect(res.detail).toMatch(/certutil check failed/);
  });

  it('linux -> unknown with advice', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    const res = await isCertTrusted('/tmp/cert.pem');
    expect(res.trusted).toBe('unknown');
    expect(res.detail).toMatch(/Linux has no single trust store/);
    expect(mockExecFile).not.toHaveBeenCalled();
  });
});

describe('tryTrustCert', () => {
  const origPlatform = process.platform;
  let origIsTTY: boolean | undefined;
  beforeEach(() => {
    mockExecFile.mockReset();
    mockSpawn.mockReset();
    origIsTTY = process.stdin.isTTY;
  });
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: origIsTTY, configurable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: origIsTTY, configurable: true });
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.TF_BUILD;
    vi.restoreAllMocks();
  });

  it('darwin success verifies via isCertTrusted -> trusted true', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    // first execFile (add-trusted-cert) succeeds
    mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, cb: (e: null | Error, out?: string) => void) => {
      if (args.includes('add-trusted-cert')) cb(null, '');
      else if (args.includes('verify-cert')) cb(null, '');
      else cb(null, '');
    });
    const res = await tryTrustCert('/tmp/cert.pem');
    expect(res.trusted).toBe(true);
    expect(res.detail).toMatch(/trusted via security/);
  });

  it('darwin sudo path via spawn when needsSudo and TTY', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    delete process.env.CI;
    // first exec fails with permission error -> triggers sudo branch
    let call = 0;
    mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, cb: (e: unknown, out?: string) => void) => {
      call++;
      if (call === 1) {
        // add-trusted-cert fails with permission
        cb(new Error('SecTrustSettingsSetTrustSettings: not authorized (100013)'));
      } else if (args.includes('verify-cert')) {
        // verify after sudo succeeds
        cb(null, '');
      } else {
        cb(new Error('unexpected'));
      }
    });
    mockSpawn.mockImplementation(() => {
      return {
        on: (ev: string, fn: (code: number) => void) => {
          if (ev === 'close') setTimeout(() => fn(0), 0);
          if (ev === 'error') {}
          return { on: () => {} };
        },
      } as unknown as ReturnType<typeof import('node:child_process').spawn>;
    });
    const res = await tryTrustCert('/tmp/cert.pem');
    expect(mockSpawn).toHaveBeenCalledWith('sudo', expect.arrayContaining(['security', 'add-trusted-cert']), expect.objectContaining({ stdio: 'inherit' }));
    expect(res.trusted).toBe(true);
    expect(res.detail).toMatch(/sudo security/);
  });

  it('darwin sudo required returns false when not TTY', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (e: unknown) => void) => {
      cb(new Error('permission denied: write permissions'));
    });
    const res = await tryTrustCert('/tmp/cert.pem');
    expect(res.trusted).toBe(false);
    expect(res.detail).toMatch(/sudo required/);
  });

  it('win32 tryTrustCert success', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, cb: (e: unknown, out?: string) => void) => {
      if (args.includes('-addstore')) cb(null, '');
      else cb(null, 'Cert is trusted');
    });
    const res = await tryTrustCert('C:\\cert.pem');
    expect(res.trusted).toBe(true);
    expect(res.detail).toMatch(/certutil/);
  });

  it('linux tryTrustCert', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    // success path
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (e: null) => void) => cb(null));
    const resOk = await tryTrustCert('/tmp/cert.pem');
    expect(resOk.trusted).toBe(true);
    expect(resOk.detail).toMatch(/NSS DB/);

    // failure path
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (e: unknown) => void) => cb(new Error('nss fail')));
    const resFail = await tryTrustCert('/tmp/cert.pem');
    expect(resFail.trusted).toBe(false);
    expect(resFail.detail).toMatch(/Linux has no single trust store/);
  });
});

describe('formatTrustInstructions', () => {
  const origPlatform = process.platform;
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
  });
  it('darwin returns security command', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    const s = formatTrustInstructions('/tmp/certs');
    expect(s).toContain('sudo security add-trusted-cert');
    expect(s).toContain(path.join('/tmp/certs', 'cert.pem'));
  });
  it('win32 returns certutil command', () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    const s = formatTrustInstructions('C:\\certs');
    expect(s).toContain('certutil -addstore');
    expect(s).toContain(path.join('C:\\certs', 'cert.pem'));
  });
  it('linux returns import advice', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    const s = formatTrustInstructions('/tmp/certs');
    expect(s).toContain('import');
    expect(s).toContain(path.join('/tmp/certs', 'cert.pem'));
    expect(s).toMatch(/browser\/OS trust store/);
  });
});
