import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

export interface ManifestServerOptions {
  port: number;
  hostname: string;
  https: boolean;
  projectRoot: string;
  certsDir: string;
  manifestsJs: () => Promise<string>;
  extraStatic?: { path: string; urlPrefix: string }[];
}

export interface ManifestServerHandle {
  port: number;
  url: string;
  close(): Promise<void>;
}

const CORS_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'HEAD, GET, OPTIONS',
  'Access-Control-Allow-Private-Network': 'true'
});

const NOT_FOUND_BODY = JSON.stringify({ error: 'not found' });
const FORBIDDEN_BODY = JSON.stringify({ error: 'forbidden' });

const TRUST_NOTES = [
  'RSPFX development certificate (self-signed, 825 days)',
  '',
  'key.pem / cert.pem are used by the local HTTPS dev server for localhost and 127.0.0.1.',
  '',
  'To make browsers and SharePoint trust this certificate, import cert.pem into the',
  'trusted root store of your OS or browser, then restart the browser:',
  '',
  '  macOS:    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain cert.pem',
  '  Windows:  certutil -addstore -user Root cert.pem',
  '  Linux:    import cert.pem into the browser or system trust store',
  ''
].join('\n');

interface SelfsignedAltName {
  type: number;
  value?: string;
  ip?: string;
}

interface SelfsignedExtension {
  name: string;
  cA?: boolean;
  serverAuth?: boolean;
  altNames?: SelfsignedAltName[];
}

interface SelfsignedOptions {
  keySize: number;
  days: number;
  algorithm: string;
  extensions: SelfsignedExtension[];
}

interface SelfsignedPems {
  private: string;
  public: string;
  cert: string;
  fingerprint: string;
}

const require = createRequire(import.meta.url);

const selfsigned = require('selfsigned') as {
  generate(attrs: { name: string; value: string }[], options: SelfsignedOptions): SelfsignedPems;
};

export async function ensureCertificates(certsDir: string): Promise<{ key: string; cert: string }> {
  const keyPath = path.join(certsDir, 'key.pem');
  const certPath = path.join(certsDir, 'cert.pem');
  try {
    const [key, cert] = await Promise.all([readFile(keyPath, 'utf8'), readFile(certPath, 'utf8')]);
    return { key, cert };
  } catch {
    // fall through to generation
  }
  await mkdir(certsDir, { recursive: true });
  const pems = selfsigned.generate(
    [{ name: 'commonName', value: 'localhost' }],
    {
      keySize: 2048,
      days: 825,
      algorithm: 'sha256',
      extensions: [
        { name: 'extKeyUsage', serverAuth: true },
        {
          name: 'subjectAltName',
          altNames: [
            { type: 2, value: 'localhost' },
            { type: 7, ip: '127.0.0.1' }
          ]
        }
      ]
    }
  );
  await Promise.all([
    writeFile(keyPath, pems.private, { mode: 0o600 }),
    writeFile(certPath, pems.cert),
    writeFile(path.join(certsDir, 'cert.pem.trust.txt'), TRUST_NOTES)
  ]);
  console.log(`[rspfx] Generated self-signed dev certificate in ${certsDir}. See cert.pem.trust.txt for trust instructions.`);
  return { key: pems.private, cert: pems.cert };
}

export function mimeTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'text/javascript';
    case '.json':
    case '.map':
      return 'application/json';
    case '.html':
    case '.htm':
      return 'text/html';
    case '.css':
      return 'text/css';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

function setCors(res: ServerResponse): void {
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(name, value);
  }
}

function sendJson(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function resolveWithin(baseDir: string, relPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(relPath);
  } catch {
    throw new Error('invalid percent-encoding');
  }
  if (decoded.split('/').includes('..')) {
    return null;
  }
  const resolved = path.resolve(baseDir, decoded);
  if (resolved !== baseDir && !resolved.startsWith(baseDir + path.sep)) {
    return null;
  }
  return resolved;
}

async function serveStatic(res: ServerResponse, baseDir: string, relPath: string, isHead: boolean): Promise<void> {
  if (relPath === '' || relPath === '/') {
    sendJson(res, 404, NOT_FOUND_BODY);
    return;
  }
  let filePath: string;
  try {
    const resolved = resolveWithin(baseDir, relPath);
    if (resolved === null) {
      sendJson(res, 403, FORBIDDEN_BODY);
      return;
    }
    filePath = resolved;
  } catch {
    sendJson(res, 404, NOT_FOUND_BODY);
    return;
  }
  let content: Buffer;
  try {
    content = await readFile(filePath);
  } catch {
    sendJson(res, 404, NOT_FOUND_BODY);
    return;
  }
  res.writeHead(200, { 'Content-Type': mimeTypeFor(filePath), 'Content-Length': content.length });
  res.end(isHead ? undefined : content);
}

interface StaticRoute {
  prefix: string;
  root: string;
}

function createRequestListener(opts: ManifestServerOptions) {
  const projectRoot = path.resolve(opts.projectRoot);
  const staticRoutes: StaticRoute[] = (opts.extraStatic ?? [])
    .map((entry) => {
      const prefix = entry.urlPrefix.startsWith('/') ? entry.urlPrefix : `/${entry.urlPrefix}`;
      return {
        prefix: prefix.endsWith('/') && prefix !== '/' ? prefix.slice(0, -1) : prefix,
        root: path.resolve(entry.path)
      };
    })
    .sort((a, b) => b.prefix.length - a.prefix.length);

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    setCors(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 404, NOT_FOUND_BODY);
      return;
    }
    const isHead = req.method === 'HEAD';
    const pathname = (req.url ?? '/').split('?')[0] ?? '/';

    if (pathname === '/temp/manifests.js') {
      try {
        const body = await opts.manifestsJs();
        res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' });
        res.end(isHead ? undefined : body);
        return;
      } catch {
        sendJson(res, 500, JSON.stringify({ error: 'internal error' }));
        return;
      }
    }

    if (pathname.startsWith('/node_modules/')) {
      await serveStatic(res, projectRoot, pathname.slice(1), isHead);
      return;
    }
    if (pathname.startsWith('/dist/')) {
      await serveStatic(res, projectRoot, pathname.slice(1), isHead);
      return;
    }

    for (const route of staticRoutes) {
      if (pathname.startsWith(route.prefix === '/' ? '/' : `${route.prefix}/`)) {
        const rel = route.prefix === '/' ? pathname.slice(1) : pathname.slice(route.prefix.length + 1);
        await serveStatic(res, route.root, rel, isHead);
        return;
      }
    }

    sendJson(res, 404, NOT_FOUND_BODY);
  };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close((err) => (err ? reject(err) : resolve()));
    server.closeAllConnections();
  });
}

export async function startManifestServer(opts: ManifestServerOptions): Promise<ManifestServerHandle> {
  const tls = opts.https ? await ensureCertificates(opts.certsDir) : undefined;
  const requestListener = createRequestListener(opts);
  const server = tls
    ? createHttpsServer({ key: tls.key, cert: tls.cert }, requestListener)
    : createHttpServer(requestListener);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port, opts.hostname, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : opts.port;
  const scheme = opts.https ? 'https' : 'http';
  return {
    port,
    url: `${scheme}://${opts.hostname}:${port}`,
    close: () => closeServer(server)
  };
}
