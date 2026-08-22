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
 * Watches the dependency scope and fires `onChange` when the fingerprint
 * changes (an sp package was installed/removed/upgraded, or config.json
 * edited).
 *
 * Prefers `@parcel/watcher` (native, O(1) events, no polling) when the
 * optional peer is installed; otherwise falls back to polling every
 * `intervalMs` (default 1000 ms). Polling costs one readdir + a few lstats
 * per tick — negligible vs a rebuild — and avoids `fs.watch` platform
 * quirks. See docs/building-packages.md#sizing--performance for the tradeoff.
 */
export function watchDependencyScope(
  projectRoot: string,
  onChange: (fingerprint: string) => void,
  intervalMs = 1000
): DependencyScopeWatcher {
  let fingerprint = fingerprintDependencyScope(projectRoot);
  let stopped = false;

  // Try native watcher; fall back to polling on failure (optional peer).
  let nativeSub: { unsubscribe(): Promise<void> | void } | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;

  const check = (): void => {
    if (stopped) {
      return;
    }
    const current = fingerprintDependencyScope(projectRoot);
    if (current !== fingerprint) {
      fingerprint = current;
      onChange(current);
    }
  };

  const startPolling = (): void => {
    timer = setInterval(check, intervalMs);
    timer.unref();
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const watcher = eval('require')('@parcel/watcher') as {
      subscribe(dir: string, cb: (err: Error | null, events: { type: string }[]) => void): Promise<{ unsubscribe(): Promise<void> }>;
    };
    if (watcher && typeof watcher.subscribe === 'function') {
      const watchDirs = [
        path.join(projectRoot, 'node_modules', '@microsoft'),
        path.join(projectRoot, 'config')
      ].filter((dir) => {
        try {
          return fs.statSync(dir).isDirectory();
        } catch {
          return false;
        }
      });
      void Promise.all(
        watchDirs.map((dir) =>
          watcher.subscribe(dir, () => {
            check();
          }).then((sub) => {
            if (stopped) {
              void sub.unsubscribe();
            } else {
              nativeSub = sub;
            }
          }).catch(() => {
            // Fall back to polling if subscribe fails for this dir.
            if (!timer && !nativeSub) {
              startPolling();
            }
          })
        )
      ).catch(() => {
        if (!timer) {
          startPolling();
        }
      });
      // Also start polling as a safety net until watcher confirms; cleared once native succeeds.
      // If watcher loads, polling is replaced by events; if it fails, polling remains.
      timer = setInterval(check, intervalMs);
      timer.unref();
      // Give watcher a moment to establish; if it succeeds we cancel polling.
      setTimeout(() => {
        if (nativeSub && timer) {
          clearInterval(timer);
          timer = undefined;
        }
      }, 1500).unref?.();
    } else {
      startPolling();
    }
  } catch {
    startPolling();
  }

  return {
    stop(): void {
      stopped = true;
      if (timer) {
        clearInterval(timer);
      }
      if (nativeSub) {
        void nativeSub.unsubscribe();
      }
    }
  };
}
