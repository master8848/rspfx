import fs from 'node:fs';
import path from 'node:path';

const canResolveCache = new Map<string, boolean>();

export function canResolveFromProject(projectRoot: string, specifier: string): boolean {
  const key = `${projectRoot}:${specifier}`;
  const cached = canResolveCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const packageName = specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0]!;
  let dir = projectRoot;
  for (;;) {
    if (fs.existsSync(path.join(dir, 'node_modules', packageName))) {
      canResolveCache.set(key, true);
      return true;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      canResolveCache.set(key, false);
      return false;
    }
    dir = parent;
  }
}

export function clearCanResolveCache(): void {
  canResolveCache.clear();
}
