import fs from 'node:fs';
import * as fspEsm from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isAllowedOrigin } from '@mbsks/rspfx-core';
import { createLogger } from '@mbsks/rspfx-diagnostics';
import { ensureCertificates, formatTrustInstructions, isCertTrusted, tryTrustCert } from '@mbsks/rspfx-manifest-server';
import { POSTCSS_CONFIG_FILES, tryResolve as buildTryResolve, hasPostcssConfig as buildHasPostcssConfig } from '@mbsks/rspfx-build-core';

const logger = createLogger('rspfx');

// ---------------------------------------------------------------------------
// tsconfig helpers
// ---------------------------------------------------------------------------
export function resolveTsconfigRaw(root: string, explicit?: string): Record<string, unknown> | undefined {
  if (explicit) {
    const explicitPath = path.isAbsolute(explicit) ? explicit : path.join(root, explicit);
    if (fs.existsSync(explicitPath)) {
      try {
        const raw = fs.readFileSync(explicitPath, 'utf8');
        const parsed = JSON.parse(raw) as { extends?: string | string[] };
        const ext = parsed.extends;
        const extendsStr = Array.isArray(ext) ? ext.join(' ') : typeof ext === 'string' ? ext : '';
        if (extendsStr.includes('rush-stack-compiler') || extendsStr.includes('rush-stack')) {
          const basePaths = [
            path.join(root, 'node_modules/@microsoft/rush-stack-compiler-4.1/includes/base.json'),
            path.join(root, 'node_modules/@microsoft/rush-stack-compiler-3.9/includes/base.json'),
            path.join(root, 'node_modules/@microsoft/rush-stack-compiler-4.7/includes/base.json'),
          ];
          const hasBase = basePaths.some((p) => fs.existsSync(p));
          if (!hasBase) {
            try {
              const stubPath = path.join(root, 'node_modules/@microsoft/rush-stack-compiler-4.1/includes/base.json');
              if (!fs.existsSync(stubPath)) {
                fs.mkdirSync(path.dirname(stubPath), { recursive: true });
                fs.writeFileSync(
                  stubPath,
                  JSON.stringify(
                    {
                      compilerOptions: {
                        target: 'es2017',
                        module: 'esnext',
                        jsx: 'react',
                        esModuleInterop: true,
                        allowSyntheticDefaultImports: true,
                        moduleResolution: 'node',
                        strict: true,
                      },
                    },
                    null,
                    2,
                  ),
                );
              }
            } catch {}
            return { compilerOptions: { jsx: 'react', esModuleInterop: true, allowSyntheticDefaultImports: true, moduleResolution: 'node' } };
          }
        }
      } catch {}
      return undefined;
    }
  }
  const candidates = ['tsconfig.json', 'tsconfig.build.json', 'tsconfig.app.json'];
  try {
    const all = fs.readdirSync(root).filter((f) => f.startsWith('tsconfig') && f.endsWith('.json'));
    for (const f of all) if (!candidates.includes(f)) candidates.push(f);
  } catch {}
  for (const file of candidates) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    try {
      const raw = fs.readFileSync(full, 'utf8');
      const parsed = JSON.parse(raw) as { extends?: string | string[] };
      const ext = parsed.extends;
      const extendsStr = Array.isArray(ext) ? ext.join(' ') : typeof ext === 'string' ? ext : '';
      if (extendsStr.includes('rush-stack-compiler') || extendsStr.includes('rush-stack')) {
        const basePaths = [
          path.join(root, 'node_modules/@microsoft/rush-stack-compiler-4.1/includes/base.json'),
          path.join(root, 'node_modules/@microsoft/rush-stack-compiler-3.9/includes/base.json'),
          path.join(root, 'node_modules/@microsoft/rush-stack-compiler-4.7/includes/base.json'),
        ];
        const hasBase = basePaths.some((p) => fs.existsSync(p));
        if (!hasBase) {
          try {
            const stubPath = path.join(root, 'node_modules/@microsoft/rush-stack-compiler-4.1/includes/base.json');
            if (!fs.existsSync(stubPath)) {
              fs.mkdirSync(path.dirname(stubPath), { recursive: true });
              fs.writeFileSync(
                stubPath,
                JSON.stringify(
                  {
                    compilerOptions: {
                      target: 'es2017',
                      module: 'esnext',
                      jsx: 'react',
                      esModuleInterop: true,
                      allowSyntheticDefaultImports: true,
                      moduleResolution: 'node',
                      strict: true,
                    },
                  },
                  null,
                  2,
                ),
              );
              logger.warn(`Created stub ${path.relative(root, stubPath)} to satisfy tsconfig extends — run "rspfx migrate" to rewrite tsconfig to plain config.`);
            }
          } catch {}
          logger.warn(
            `tsconfig ${file} extends "${extendsStr}" but base not found — Vite will use fallback compilerOptions (jsx: react, esModuleInterop). Run "rspfx migrate" to rewrite tsconfig to plain config, or install @microsoft/rush-stack-compiler.`,
          );
          return { compilerOptions: { jsx: 'react', esModuleInterop: true, allowSyntheticDefaultImports: true, moduleResolution: 'node' } };
        }
      }
    } catch {}
    break;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Node / Vite config checks
// ---------------------------------------------------------------------------
export function checkNodeVersion(): void {
  const major = Number(process.versions.node.split('.')[0] ?? '0');
  if (major < 20) {
    logger.warn(
      `Node ${process.versions.node} is below RSPFx required >=20 (and Vite 8 requires >=20.19). Upgrade to Node 20+ or 22 LTS — see docs/compatibility.md. Vite may fail with syntax or ESM errors on Node 14.`,
    );
  }
  const viteNote = 'Vite 8 (Rolldown) requires Node >=20.19 (ideally 22+). RSPFx supports Vite 5/7 on Node 20+, but Node 14 is unsupported.';
  if (major < 18) logger.warn(viteNote);
}

export function checkViteConfigEsm(root: string): void {
  try {
    const pkgPath = path.join(root, 'package.json');
    const pkg = fs.existsSync(pkgPath) ? (JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { type?: string }) : {};
    const isEsmPkg = pkg.type === 'module';
    const candidates = ['vite.config.ts', 'vite.config.js'];
    for (const file of candidates) {
      const full = path.join(root, file);
      if (!fs.existsSync(full)) continue;
      const content = fs.readFileSync(full, 'utf8').slice(0, 2000);
      const hasEsm = /\bimport\s+.*from\b|\bexport\s+default\b/.test(content);
      if (hasEsm && !isEsmPkg) {
        logger.warn(
          `Vite config ${file} uses ESM syntax but package.json type is not "module" — Vite 8 with configLoader: 'native' will warn "ESM syntax in a file loaded as CommonJS". Rename to ${file.replace(/\.ts$|\.js$/, '.mjs')} or vite.config.mts, or add "type": "module" to package.json, or set VITE_CONFIG_NATIVE_IGNORE_WARNING=true. RSPFx CLI uses jiti so "rspfx dev" is unaffected, but direct "vite" may warn.`,
        );
      }
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Origin helper
// ---------------------------------------------------------------------------
export interface ServeLike {
  scheme: string;
  hostname: string;
  origin: string;
}

export interface DevServerLike {
  httpServer?: { address?(): unknown; once?(event: 'listening', listener: () => void): unknown };
}

export function updateOriginWithActualPort(settings: ServeLike, devServer: DevServerLike): string {
  try {
    const address = (devServer.httpServer as { address(): unknown } | undefined)?.address();
    if (address && typeof address === 'object' && 'port' in address) {
      return `${settings.scheme}://${settings.hostname}:${(address as { port: number }).port}`;
    }
  } catch {
    // fall back to configured origin
  }
  return settings.origin;
}

// ---------------------------------------------------------------------------
// Static / path safety helpers
// ---------------------------------------------------------------------------
export const VITE_BASE_EXTENSIONS = ['.mjs', '.js', '.mts', '.jsx', '.ts', '.tsx', '.json'] as const;

const CONTENT_TYPES: Record<string, string> = {
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
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
  '.woff2': 'font/woff2',
};

export function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

export function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function hasDotSegment(value: string): boolean {
  return value.split('/').some((segment) => segment.startsWith('.') || segment.includes('\0'));
}

/** Hop loop: repeatedly decode up to `limit` times, aborting on dot segments or errors. */
export function safeDecodeWithHops(value: string, limit = 4): string | null {
  let current = value;
  const first = safeDecodeURIComponent(current);
  if (first === null) return null;
  if (hasDotSegment(first)) return null;
  current = first;
  for (let i = 0; i < limit; i++) {
    const next = safeDecodeURIComponent(current);
    if (next === null || next === current) break;
    if (hasDotSegment(next)) return null;
    current = next;
  }
  return current;
}

export function createCorsMiddleware(): (req: unknown, res: unknown, next: () => void) => void {
  return (req, res, next) => corsMiddleware(req, res, next);
}

export function corsMiddleware(req: unknown, res: unknown, next: () => void): void {
  const headers = (req as { headers?: Record<string, string | string[] | undefined> }).headers ?? {};
  const originEntry = Object.entries(headers).find(([k]) => k.toLowerCase() === 'origin')?.[1];
  const origin = Array.isArray(originEntry) ? originEntry[0] : (originEntry as string | undefined);
  const response = res as { setHeader(name: string, value: string): void; end(body?: string): void; statusCode?: number };
  if (origin) {
    if (isAllowedOrigin(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
    } else {
      response.setHeader('Vary', 'Origin');
    }
  } else {
    response.setHeader('Access-Control-Allow-Origin', '*');
  }
  response.setHeader('Access-Control-Allow-Methods', 'HEAD, GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Private-Network', 'true');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-RequestDigest, X-HTTP-Method');
  if ((req as { method?: string }).method === 'OPTIONS') {
    response.statusCode = 204;
    response.end();
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Sass / Tailwind detection
// ---------------------------------------------------------------------------
export { POSTCSS_CONFIG_FILES };
const TAILWIND_CONFIG_FILES = [
  'tailwind.config.js',
  'tailwind.config.cjs',
  'tailwind.config.mjs',
  'tailwind.config.ts',
  'tailwind.config.cts',
  'tailwind.config.mts',
];

export function tryResolveFromRoot(name: string, root: string): string | undefined {
  const result = buildTryResolve(name, root);
  if (result) return result;
  logger.debug(`tryResolveFromRoot ${name} not found via build-core`);
  return undefined;
}

export function isSassInstalled(root: string): boolean {
  if (tryResolveFromRoot('sass', root)) return true;
  try {
    if (fs.existsSync(path.join(root, 'node_modules', 'sass'))) return true;
  } catch (e) {
    logger.debug(`isSassInstalled existsSync failed: ${String(e)}`);
  }
  return false;
}

const scssCache = new Map<string, { mtimeMs: number; result: boolean }>();

function getDirMtimeMs(dir: string): number {
  try {
    return fs.statSync(dir).mtimeMs;
  } catch {
    return 0;
  }
}

export function hasScssFiles(root: string): boolean {
  const cacheKey = root;
  const mtimeMs = getDirMtimeMs(root);
  const cached = scssCache.get(cacheKey);
  if (cached && cached.mtimeMs === mtimeMs) return cached.result;

  const ignoreDirs = new Set(['node_modules', 'dist', 'release', 'temp', '.git', '.rspfx', 'lib', '.vite']);
  const stack: string[] = [];
  const srcDir = path.join(root, 'src');
  let result = false;
  if (fs.existsSync(srcDir)) stack.push(srcDir);
  else stack.push(root);
  let scanned = 0;
  while (stack.length > 0 && scanned < 5000) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      logger.debug(`hasScssFiles readdir ${dir} failed: ${String(e)}`);
      continue;
    }
    for (const entry of entries) {
      scanned++;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (ignoreDirs.has(entry.name)) continue;
        if (entry.name.startsWith('.')) continue;
        stack.push(full);
      } else if (entry.isFile() && (entry.name.endsWith('.scss') || entry.name.endsWith('.sass'))) {
        result = true;
        break;
      }
      if (scanned >= 5000) break;
    }
    if (result) break;
  }
  scssCache.set(cacheKey, { mtimeMs, result });
  return result;
}

export function hasPostcssConfig(root: string): boolean {
  return buildHasPostcssConfig(root);
}

export function hasTailwindConfig(root: string): boolean {
  for (const f of TAILWIND_CONFIG_FILES) if (fs.existsSync(path.join(root, f))) return true;
  return false;
}

export function getTailwindVersion(root: string): string | undefined {
  const candidates = [
    path.join(root, 'node_modules', 'tailwindcss', 'package.json'),
    tryResolveFromRoot('tailwindcss/package.json', root),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try {
      if (!p || !fs.existsSync(p)) continue;
      const pkg = JSON.parse(fs.readFileSync(p, 'utf8')) as { version?: string };
      if (typeof pkg.version === 'string') return pkg.version;
    } catch {}
  }
  return undefined;
}

export function detectSassAndWarn(root: string): boolean {
  const sassInstalled = isSassInstalled(root);
  if (!sassInstalled) {
    try {
      if (hasScssFiles(root)) {
        logger.warn('SCSS files detected but "sass" is not installed — install sass: bun add -D sass (or pnpm add -D sass / npm i -D sass)');
      }
    } catch {}
  }
  return sassInstalled;
}

export function detectTailwindAndWarn(root: string): { hasTailwind: boolean; hasPostcss: boolean; major?: number } {
  const hasTailwind = hasTailwindConfig(root);
  const hasPostcss = hasPostcssConfig(root);
  if (!hasTailwind) return { hasTailwind, hasPostcss };
  const version = getTailwindVersion(root);
  const major = version ? Number(version.split('.')[0]) : undefined;
  const isV4 = major !== undefined && major >= 4;

  if (!version) {
    logger.warn('tailwind config found but tailwindcss not installed — install tailwindcss: bun add -D tailwindcss @tailwindcss/postcss postcss');
    return { hasTailwind, hasPostcss, major };
  }

  if (!hasPostcss) {
    if (isV4) {
      const hasVitePlugin = !!tryResolveFromRoot('@tailwindcss/vite', root);
      const hasPostcssPlugin = !!tryResolveFromRoot('@tailwindcss/postcss', root);
      if (!hasVitePlugin && !hasPostcssPlugin) {
        logger.warn(
          'Tailwind v4 detected (tailwind.config.* found) but no postcss.config.* and neither @tailwindcss/vite nor @tailwindcss/postcss is installed — install one: bun add -D tailwindcss @tailwindcss/postcss postcss (postcss mode) or bun add -D @tailwindcss/vite (vite plugin mode). For Vite, v4 prefers postcss.config.mjs with { plugins: { "@tailwindcss/postcss": {} } } or the @tailwindcss/vite plugin.',
        );
      } else if (hasVitePlugin) {
        logger.info('Tailwind v4 detected with @tailwindcss/vite available — vite will auto-configure via plugin if present. For postcss mode, ensure postcss.config.mjs contains "@tailwindcss/postcss".');
      } else {
        logger.warn(
          'Tailwind v4 detected but postcss.config.* is missing — create postcss.config.mjs with: export default { plugins: { "@tailwindcss/postcss": {} } } and ensure @import "tailwindcss" in your CSS.',
        );
      }
    } else {
      logger.warn('Tailwind config found (v3) but postcss.config.* is missing — create postcss.config.js with tailwindcss plugin, or install: bun add -D tailwindcss postcss autoprefixer');
    }
  } else {
    if (isV4) {
      try {
        for (const f of POSTCSS_CONFIG_FILES) {
          const full = path.join(root, f);
          if (!fs.existsSync(full)) continue;
          const content = fs.readFileSync(full, 'utf8');
          if (!content.includes('@tailwindcss/postcss') && !content.includes('@tailwindcss/vite') && !content.includes('tailwindcss')) {
            logger.warn(`Tailwind v4 detected but ${f} does not reference "@tailwindcss/postcss" — ensure it contains: export default { plugins: { "@tailwindcss/postcss": {} } }`);
          }
          break;
        }
      } catch {}
    }
  }
  return { hasTailwind, hasPostcss, major };
}

export function tryLoadTailwindVitePlugin(root: string): unknown | undefined {
  const resolved = tryResolveFromRoot('@tailwindcss/vite', root);
  if (!resolved) return undefined;
  try {
    const req = createRequire(path.join(root, 'package.json'));
    const mod = req(resolved) as { default?: unknown } | unknown;
    const plugin = mod && typeof mod === 'object' && 'default' in (mod as Record<string, unknown>) ? (mod as { default: unknown }).default : mod;
    return plugin;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Cert helpers — consolidate duplicated ensure + auto-trust flow
// ---------------------------------------------------------------------------
export { formatTrustInstructions, ensureCertificates, isCertTrusted, tryTrustCert };

export async function ensureAndTrustCerts(opts: {
  hostname: string;
  autoTrust?: boolean | 'prompt';
  certsDir?: string;
}): Promise<{ key: string; cert: string }> {
  const certsDir = opts.certsDir ?? path.join(os.homedir(), '.rspfx', 'certs');
  let certs: { key: string; cert: string };
  try {
    certs = await ensureCertificates(certsDir, opts.hostname);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to generate dev certificates: ${msg}. Run 'rspfx doctor --fix' — see ${path.join(certsDir, 'cert.pem.trust.txt')} for manual trust.`);
    throw new Error(`Failed to generate dev certificates: ${msg}. Run 'rspfx doctor --fix' to regenerate and 'rspfx doctor --trust' to trust.`);
  }
  const autoTrust = opts.autoTrust;
  if (autoTrust !== false) {
    try {
      const certPath = path.join(certsDir, 'cert.pem');
      const trusted = await isCertTrusted(certPath);
      if (trusted.trusted === false) {
        const isCI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS || process.env.TF_BUILD);
        const isTTY = Boolean(process.stdin.isTTY || process.stdout.isTTY);
        const shouldAttempt = autoTrust === true || (autoTrust === 'prompt' && !isCI && isTTY);
        if (shouldAttempt) {
          const result = await tryTrustCert(certPath);
          if (result.trusted) logger.success(`Dev cert trusted: ${result.detail}`);
          else logger.warn(`Auto-trust failed: ${result.detail} — ${formatTrustInstructions(certsDir)} — then restart browser`);
        } else {
          logger.warn(`Dev cert not trusted — ${trusted.detail}. ${formatTrustInstructions(certsDir)} — then restart browser. Run rspfx doctor --trust to auto-install.`);
        }
      } else if (trusted.trusted === 'unknown') {
        logger.info(`Dev cert trust unknown: ${trusted.detail} — ${formatTrustInstructions(certsDir)}`);
      }
    } catch (e) {
      logger.warn(`Cert trust check failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return certs;
}

// ---------------------------------------------------------------------------
// FS patch for %20 spaces — scoped to paths containing spaces/%20
// ---------------------------------------------------------------------------
type PatchRecord = { target: unknown; orig: unknown; key: string };
const fsPatchRecords: PatchRecord[] = [];

function shouldPatchForSpaces(rootHint?: string): boolean {
  try {
    if (import.meta.url.includes('%20')) return true;
  } catch {}
  const hint = rootHint ?? process.cwd();
  if (hint.includes('%20') || hint.includes(' ')) return true;
  try {
    if (process.cwd().includes(' ') || process.cwd().includes('%20')) return true;
  } catch {}
  return false;
}

export function patchFsForSpaces(rootHint?: string): void {
  if (!shouldPatchForSpaces(rootHint)) return;
  const patchTarget = (target: unknown, key: string): void => {
    try {
      const mod = target as { readFile: (...args: unknown[]) => Promise<unknown>; _rspfxPatched?: boolean; _rspfxOrig?: unknown };
      if (!mod || typeof mod.readFile !== 'function' || mod._rspfxPatched) return;
      const orig = mod.readFile.bind(mod);
      (mod as unknown as { readFile: unknown }).readFile = (file: unknown, ...args: unknown[]) => {
        if (typeof file === 'string' && file.includes('%')) {
          try {
            const decoded = decodeURIComponent(file);
            if (decoded !== file) file = decoded;
          } catch (e) {
            logger.debug(`patchFsForSpaces decode failed: ${String(e)}`);
          }
        }
        return (orig as (...a: unknown[]) => unknown)(file, ...args);
      };
      mod._rspfxPatched = true;
      (mod as unknown as { _rspfxOrig: unknown })._rspfxOrig = orig;
      fsPatchRecords.push({ target, orig, key });
    } catch (e) {
      logger.debug(`patchFsForSpaces patchTarget ${key} failed: ${String(e)}`);
    }
  };
  patchTarget(fs.promises, 'fs.promises');
  patchTarget(fspEsm as unknown, 'fspEsm');
  try {
    const fsAny = fs as unknown as { readFile: (...a: unknown[]) => unknown; _rspfxPatched?: boolean; _rspfxOrig?: unknown };
    if (fsAny && typeof fsAny.readFile === 'function' && !fsAny._rspfxPatched) {
      const orig = fsAny.readFile.bind(fs);
      fsAny.readFile = (file: unknown, ...args: unknown[]) => {
        if (typeof file === 'string' && file.includes('%')) {
          try {
            const d = decodeURIComponent(file as string);
            if (d !== file) file = d;
          } catch (e) {
            logger.debug(`patchFsForSpaces decode failed: ${String(e)}`);
          }
        }
        return (orig as (...a: unknown[]) => unknown)(file, ...args);
      };
      fsAny._rspfxPatched = true;
      fsAny._rspfxOrig = orig;
      fsPatchRecords.push({ target: fsAny, orig, key: 'fs.readFile' });
    }
  } catch (e) {
    logger.debug(`patchFsForSpaces fs.readFile patch failed: ${String(e)}`);
  }
  try {
    const fspModule = createRequire(import.meta.url)('node:fs/promises') as unknown;
    patchTarget(fspModule, 'node:fs/promises');
    try {
      const fspModule2 = createRequire(import.meta.url)('fs/promises') as unknown;
      patchTarget(fspModule2, 'fs/promises');
    } catch (e) {
      logger.debug(`patchFsForSpaces fs/promises patch failed: ${String(e)}`);
    }
  } catch (e) {
    logger.debug(`patchFsForSpaces require fs/promises failed: ${String(e)}`);
  }
}

export function unpatchFsForSpaces(): void {
  for (const rec of fsPatchRecords.splice(0)) {
    try {
      const mod = rec.target as { readFile: unknown; _rspfxPatched?: boolean; _rspfxOrig?: unknown };
      if (mod._rspfxOrig) {
        mod.readFile = mod._rspfxOrig as unknown as typeof mod.readFile;
        delete mod._rspfxPatched;
        delete mod._rspfxOrig;
      }
    } catch (e) {
      logger.debug(`unpatchFsForSpaces ${rec.key} failed: ${String(e)}`);
    }
  }
}

export function patchViteForSpaces(_viteMod?: unknown, rootHint?: string): void {
  patchFsForSpaces(rootHint);
  if (_viteMod) {
    try {
      const { fileURLToPath } = awaitImportMetaSync();
      void fileURLToPath;
    } catch (e) {
      logger.debug(`patchViteForSpaces fileURLToPath failed: ${String(e)}`);
    }
  }
}

function awaitImportMetaSync(): { fileURLToPath: unknown } {
  return { fileURLToPath: null };
}

if (shouldPatchForSpaces()) {
  patchFsForSpaces();
}
