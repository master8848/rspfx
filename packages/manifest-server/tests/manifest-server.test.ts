import { describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { request } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureCertificates, mimeTypeFor, startManifestServer } from '../src/index.js';

const fixturesRoot = fileURLToPath(new URL('./fixtures/proj', import.meta.url));

function rawGet(port: number, urlPath: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: 'localhost', port, path: urlPath, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('startManifestServer (http)', () => {
  it('serves manifests.js, node_modules, dist, extraStatic, 404s, CORS and OPTIONS', async () => {
    const server = await startManifestServer({
      port: 0,
      hostname: 'localhost',
      https: false,
      projectRoot: fixturesRoot,
      certsDir: path.join(os.tmpdir(), 'rspfx-test-certs-http'),
      manifestsJs: async () => 'window.__t=1;',
      extraStatic: [
        { path: fixturesRoot, urlPrefix: '/' },
        { path: path.join(fixturesRoot, 'dist'), urlPrefix: '/assets' }
      ]
    });
    try {
      expect(server.port).toBeGreaterThan(0);
      expect(server.url).toBe(`http://localhost:${server.port}`);

      const manifests = await fetch(`${server.url}/temp/manifests.js`);
      expect(manifests.status).toBe(200);
      expect(await manifests.text()).toBe('window.__t=1;');
      expect(manifests.headers.get('cache-control')).toBe('no-store');
      expect(manifests.headers.get('access-control-allow-origin')).toBe('*');
      expect(manifests.headers.get('access-control-allow-methods')).toBe('HEAD, GET, OPTIONS');
      expect(manifests.headers.get('access-control-allow-private-network')).toBe('true');

      const nm = await fetch(`${server.url}/node_modules/@microsoft/sp-core-library/dist/sp-core-library.js`);
      expect(nm.status).toBe(200);
      expect(nm.headers.get('content-type')).toBe('text/javascript');
      expect(await nm.text()).toContain('window.fixtureSpCore');

      const traversal = await rawGet(server.port, '/node_modules/../secret');
      expect(traversal.status).toBe(403);
      expect(traversal.body).not.toContain('fixtureSpCore');

      const traversalEncoded = await rawGet(server.port, '/node_modules/%2e%2e/secret');
      expect(traversalEncoded.status).toBe(403);

      const traversalDist = await rawGet(server.port, '/dist/../package.json');
      expect(traversalDist.status).toBe(403);

      const normalized = await fetch(`${server.url}/node_modules/../secret`);
      expect([403, 404]).toContain(normalized.status);

      const missing = await fetch(`${server.url}/missing`);
      expect(missing.status).toBe(404);
      expect(await missing.json()).toEqual({ error: 'not found' });
      expect(missing.headers.get('access-control-allow-origin')).toBe('*');

      const dist = await fetch(`${server.url}/dist/webpart.js`);
      expect(dist.status).toBe(200);
      expect(await dist.text()).toContain('window.fixtureWebpart');

      const extra = await fetch(`${server.url}/assets/webpart.js`);
      expect(extra.status).toBe(200);
      expect(await extra.text()).toContain('window.fixtureWebpart');

      const staticRoot = await fetch(`${server.url}/package.json`);
      expect(staticRoot.status).toBe(200);
      expect(staticRoot.headers.get('content-type')).toBe('application/json');

      const options = await fetch(`${server.url}/temp/manifests.js`, { method: 'OPTIONS' });
      expect(options.status).toBe(204);
      expect(options.headers.get('access-control-allow-methods')).toBe('HEAD, GET, OPTIONS');
      expect(options.headers.get('access-control-allow-private-network')).toBe('true');
    } finally {
      await server.close();
    }
  });
});

describe('startManifestServer (https)', () => {
  it('serves over https with generated certs', async () => {
    const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    try {
      const certsDir = await mkdtemp(path.join(os.tmpdir(), 'rspfx-test-certs-'));
      const server = await startManifestServer({
        port: 0,
        hostname: 'localhost',
        https: true,
        projectRoot: fixturesRoot,
        certsDir,
        manifestsJs: async () => 'window.__t=1;'
      });
      try {
        expect(server.url.startsWith('https://')).toBe(true);
        const res = await fetch(`${server.url}/temp/manifests.js`);
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('window.__t=1;');
        const nm = await fetch(`${server.url}/dist/webpart.js`);
        expect(nm.status).toBe(200);
      } finally {
        await server.close();
        await rm(certsDir, { recursive: true, force: true });
      }
    } finally {
      if (prev === undefined) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
      }
    }
  });
});

describe('ensureCertificates', () => {
  it('generates key/cert PEMs, writes trust note, caches on second call', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'rspfx-test-certs-'));
    try {
      const first = await ensureCertificates(dir);
      expect(first.key).toContain('BEGIN RSA PRIVATE KEY');
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
});

describe('mimeTypeFor', () => {
  it('maps common dev-server extensions', () => {
    expect(mimeTypeFor('bundle.js')).toBe('text/javascript');
    expect(mimeTypeFor('manifest.json')).toBe('application/json');
    expect(mimeTypeFor('bundle.js.map')).toBe('application/json');
    expect(mimeTypeFor('index.html')).toBe('text/html');
  });
});
