import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

export function hashFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return '';
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  } catch {
    return '';
  }
}

export function cachePath(ROOT) {
  return path.join(ROOT, 'node_modules', '.cache', 'rspfx-publish.json');
}

export function readBuildCache(ROOT) {
  try {
    const p = cachePath(ROOT);
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeBuildCache(ROOT, fingerprint) {
  try {
    const p = cachePath(ROOT);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ fingerprint, updatedAt: new Date().toISOString() }, null, 2) + '\n');
  } catch {}
}

export function checkDistExists(set) {
  for (const pkg of set.values()) {
    const dist = path.join(pkg.dir, 'dist');
    if (!fs.existsSync(dist)) return false;
    try {
      const entries = fs.readdirSync(dist);
      if (entries.length === 0) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function getFingerprint(ROOT, set) {
  let head = '';
  try {
    head = execSync('git rev-parse HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {}
  let relevantDirtyHash = '';
  try {
    const dirtyNames = execSync('git diff --name-only', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n').filter(Boolean);
    const cachedNames = execSync('git diff --cached --name-only', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n').filter(Boolean);
    const allDirty = [...dirtyNames, ...cachedNames];
    const allowed = new Set([
      'package.json',
      ...[...set.values()].map((p) => path.relative(ROOT, path.join(p.dir, 'package.json')).replaceAll('\\', '/')),
    ]);
    const relevant = allDirty.filter((f) => !allowed.has(f.replaceAll('\\', '/')));
    relevantDirtyHash = crypto.createHash('sha256').update(relevant.sort().join('|')).digest('hex').slice(0, 8);
  } catch {
    relevantDirtyHash = '';
  }
  const bunLock = hashFile(path.join(ROOT, 'bun.lock'));
  const pnpmLock = hashFile(path.join(ROOT, 'pnpm-lock.yaml'));
  const cargoLock = hashFile(path.join(ROOT, 'Cargo.lock'));
  const hasNodeModules = fs.existsSync(path.join(ROOT, 'node_modules')) ? '1' : '0';
  return crypto.createHash('sha256').update([head, relevantDirtyHash, bunLock, pnpmLock, cargoLock, hasNodeModules].join('|')).digest('hex').slice(0, 16);
}
