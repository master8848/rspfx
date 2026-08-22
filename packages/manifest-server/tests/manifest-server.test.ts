import { describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ensureCertificates } from '../src/index.js';

describe('ensureCertificates', () => {
  it('generates key/cert PEMs, writes trust note, caches on second call', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'rspfx-test-certs-'));
    try {
      const first = await ensureCertificates(dir);
      expect(first.key).toMatch(/BEGIN .*PRIVATE KEY/);
      expect(first.cert).toContain('BEGIN CERTIFICATE');
      const files = await readdir(dir);
      expect(files).toContain('key.pem');
      expect(files).toContain('cert.pem');
      expect(files).toContain('cert.pem.trust.txt');
      const second = await ensureCertificates(dir);
      expect(second).toEqual(first);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('writes key.pem with 0600 permissions', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'rspfx-test-certs-'));
    try {
      await ensureCertificates(dir);
      const mode = (await stat(path.join(dir, 'key.pem'))).mode & 0o777;
      expect(mode).toBe(0o600);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns the same cert for a given subject on repeated calls', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'rspfx-test-certs-'));
    try {
      const first = await ensureCertificates(dir);
      const second = await ensureCertificates(dir);
      expect(second.cert).toBe(first.cert);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
