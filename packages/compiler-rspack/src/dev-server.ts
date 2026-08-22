import fs from 'node:fs';
import path from 'node:path';
import { rspack, type Compiler, type Configuration } from '@rspack/core';
import { RspackDevServer, type Configuration as DevServerConfiguration } from '@rspack/dev-server';
import type { CompileContext, DevServerOptions, StartDevServerResult } from './types.js';
import { createRspackConfig } from './config.js';

const CONTENT_TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.map': 'application/json',
  '.css': 'text/css',
  '.html': 'text/html',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

function isAllowedOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '::1' ||
      h.endsWith('.sharepoint.com') ||
      h.endsWith('.sharepoint-df.com') ||
      h.endsWith('.sharepoint.cn')
    );
  } catch {
    return false;
  }
}

function corsMiddleware(req: unknown, res: any, next: (err?: unknown) => void): void {
  const origin = (req as { headers?: Record<string, string> }).headers?.origin;
  if (origin) {
    if (isAllowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else {
      // Origin present but not allowlisted — do not set ACAO (fallback to no header, not *).
      res.setHeader('Vary', 'Origin');
    }
  } else {
    // No Origin header (non-browser clients like curl/Node fetch) — keep wildcard for tooling.
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'HEAD, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-RequestDigest, X-HTTP-Method');
  if ((req as { method?: string }).method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  next();
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function hasDotSegment(value: string): boolean {
  return value.split('/').some((segment) => segment.startsWith('.') || segment.includes('\0'));
}

function createStaticMiddleware(
  rootDir: string,
  urlPrefix: string
): (req: unknown, res: any, next: (err?: unknown) => void) => void {
  const root = path.resolve(rootDir);
  return (req, res, next) => {
    const url = (req as { url?: string }).url;
    if (!url?.startsWith(urlPrefix)) {
      next();
      return;
    }
    const rawRelative = url.slice(urlPrefix.length).replace(/^\/+/, '').split('?')[0] ?? '';
    // Iteratively decode to catch double (and triple) encoding:
    // %252e -> %2e -> "." . First decode handles normal %2e, second and
    // subsequent decodes handle %252e, %25252e, etc. Check dot segments
    // after each decode and before path.resolve.
    let effectiveRelative: string | null = safeDecodeURIComponent(rawRelative);
    if (effectiveRelative === null) {
      next();
      return;
    }
    if (hasDotSegment(effectiveRelative)) {
      next();
      return;
    }
    // Second (and deeper) decode pass — loop until stable or decode fails.
    let current = effectiveRelative;
    for (let i = 0; i < 4; i++) {
      const nextDecoded = safeDecodeURIComponent(current);
      if (nextDecoded === null || nextDecoded === current) {
        break;
      }
      if (hasDotSegment(nextDecoded)) {
        next();
        return;
      }
      current = nextDecoded;
      effectiveRelative = current;
    }
    const file = path.resolve(root, effectiveRelative);
    if (file !== root && !file.startsWith(root + path.sep)) {
      next();
      return;
    }
    fs.lstat(file, (err, stat) => {
      if (err || stat.isSymbolicLink() || !stat.isFile()) {
        next();
        return;
      }
      res.setHeader('Content-Type', contentTypeFor(file));
      fs.createReadStream(file).pipe(res);
    });
  };
}

function getActualPort(server: RspackDevServer, requested: number): number {
  const address = server.server?.address();
  if (address && typeof address === 'object') {
    return address.port;
  }
  return requested;
}

function closeCompiler(compiler: Compiler): Promise<void> {
  return new Promise((resolve) => {
    try {
      compiler.close(() => resolve());
    } catch {
      resolve();
    }
  });
}

export async function startDevServer(
  ctx: CompileContext,
  devServerOptions: DevServerOptions
): Promise<StartDevServerResult> {
  const port = devServerOptions.port ?? 4321;
  const hostname = devServerOptions.hostname ?? 'localhost';
  const https = devServerOptions.https ?? false;
  const certs = devServerOptions.certs;

  const devServerConfig: DevServerConfiguration = {
    port,
    host: hostname,
    hot: devServerOptions.hot ?? true,
    allowedHosts: devServerOptions.allowedHosts ?? ['.sharepoint.com', '.sharepoint-df.com', 'localhost', '127.0.0.1', '::1'],
    static: false,
    devMiddleware: {
      publicPath: '/dist',
      writeToDisk: true,
      stats: { all: false, errors: true, warnings: true, assets: false, modules: false }
    },
    ...(https
      ? {
          server: {
            type: 'https' as const,
            options: { key: certs?.key ?? '', cert: certs?.cert ?? '' }
          }
        }
      : {}),
    client: {
      overlay: false,
      ...(port > 0
        ? { webSocketURL: { hostname, port, protocol: https ? 'wss' : 'ws' } }
        : {})
    },
    setupMiddlewares: (middlewares) => {
      middlewares.unshift({
        name: 'rspfx-cors',
        middleware: corsMiddleware
      });
      for (const route of devServerOptions.routes ?? []) {
        middlewares.push({
          name: `rspfx-route-${route.path}`,
          path: route.path,
          middleware: route.handler
        });
      }
      for (const folder of devServerOptions.staticFolders ?? []) {
        middlewares.push({
          name: `rspfx-static-${folder.urlPrefix}`,
          path: folder.urlPrefix,
          middleware: createStaticMiddleware(folder.path, folder.urlPrefix)
        });
      }
      return middlewares;
    }
  };

  const config = (await createRspackConfig({ ...ctx, serveMode: true })) as Configuration;
  const compiler = rspack({ ...config, devServer: devServerConfig });
  const server = new RspackDevServer(devServerConfig, compiler);

  const emitListeners: ((stats: unknown) => void)[] = [];
  compiler.hooks.done.tap('rspfx-on-emit', (stats) => {
    for (const listener of emitListeners) {
      listener(stats);
    }
  });

  await server.start();

  return {
    close: async () => {
      await server.stop();
      await closeCompiler(compiler);
    },
    port: getActualPort(server, port),
    compiler,
    onEmit(cb: (stats: unknown) => void): () => void {
      emitListeners.push(cb);
      return () => {
        const index = emitListeners.indexOf(cb);
        if (index !== -1) {
          emitListeners.splice(index, 1);
        }
      };
    }
  };
}
