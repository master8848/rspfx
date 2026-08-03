import fs from 'node:fs';
import path from 'node:path';

const MISSING = '<missing>';

export interface DependencyScopeWatcher {
  stop(): void;
}

/**
 * Cheap snapshot of everything that determines the bundle's `externals` set
 * (and thus the compiled dependency scope) for a running dev server:
 * the `node_modules/@microsoft` entries (name + symlink mtime) and
 * `config/config.json` (project `externals`/`localizedResources`).
 *
 * Computing the snapshot is a single readdir plus a handful of lstats — no
 * JSON parsing, no recursion — so polling it every second is negligible
 * compared to a single rebuild. A mismatch means the running compiler's
 * externals are stale and a restart is required.
 */
export function fingerprintDependencyScope(projectRoot: string): string {
  const parts: string[] = [];
  const microsoftDir = path.join(projectRoot, 'node_modules', '@microsoft');
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(microsoftDir, { withFileTypes: true });
  } catch {
    parts.push(`@microsoft@${MISSING}`);
    entries = [];
  }
  for (const entry of entries) {
    if ((!entry.isDirectory() && !entry.isSymbolicLink()) || entry.name.startsWith('.')) {
      continue;
    }
    try {
      parts.push(`${entry.name}@${fs.lstatSync(path.join(microsoftDir, entry.name)).mtimeMs.toFixed(3)}`);
    } catch {
      parts.push(`${entry.name}@${MISSING}`);
    }
  }
  try {
    const configStat = fs.statSync(path.join(projectRoot, 'config', 'config.json'));
    parts.push(`config.json@${configStat.mtimeMs.toFixed(3)}`);
  } catch {
    parts.push(`config.json@${MISSING}`);
  }
  return parts.sort().join('|');
}

/**
 * Polls the dependency scope and fires `onChange` when the fingerprint
 * changes (an sp package was installed/removed/upgraded, or config.json
 * edited). Polling instead of fs.watch keeps this reliable across platforms
 * and silent otherwise; each poll costs one readdir + a few lstats.
 */
export function watchDependencyScope(
  projectRoot: string,
  onChange: (fingerprint: string) => void,
  intervalMs = 1000
): DependencyScopeWatcher {
  let fingerprint = fingerprintDependencyScope(projectRoot);
  let stopped = false;
  const timer = setInterval(() => {
    if (stopped) {
      return;
    }
    const current = fingerprintDependencyScope(projectRoot);
    if (current !== fingerprint) {
      fingerprint = current;
      onChange(current);
    }
  }, intervalMs);
  timer.unref();

  return {
    stop(): void {
      stopped = true;
      clearInterval(timer);
    }
  };
}
