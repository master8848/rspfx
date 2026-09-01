import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createLogger } from '@mbsks/rspfx-diagnostics';

const MISSING = '<missing>';
const logger = createLogger('rspfx:deps-watch');

export interface DependencyScopeWatcher {
  stop(): Promise<void> | void;
}

export function fingerprintDependencyScope(projectRoot: string, configDir = 'config'): string {
  const parts: string[] = [];
  const microsoftDir = path.join(projectRoot, 'node_modules', '@microsoft');
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(microsoftDir, { withFileTypes: true });
  } catch (e) {
    logger.debug(`fingerprint: readdir ${microsoftDir} failed: ${String(e)}`);
    parts.push(`@microsoft@${MISSING}`);
    entries = [];
  }
  for (const entry of entries) {
    if ((!entry.isDirectory() && !entry.isSymbolicLink()) || entry.name.startsWith('.')) {
      continue;
    }
    try {
      parts.push(`${entry.name}@${fs.lstatSync(path.join(microsoftDir, entry.name)).mtimeMs.toFixed(3)}`);
    } catch (e) {
      logger.debug(`fingerprint: lstat ${entry.name} failed: ${String(e)}`);
      parts.push(`${entry.name}@${MISSING}`);
    }
  }
  try {
    const configStat = fs.statSync(path.join(projectRoot, configDir, 'config.json'));
    parts.push(`config.json@${configStat.mtimeMs.toFixed(3)}`);
  } catch (e) {
    logger.debug(`fingerprint: stat config.json failed: ${String(e)}`);
    parts.push(`config.json@${MISSING}`);
  }
  return parts.sort().join('|');
}

export function watchDependencyScope(
  projectRoot: string,
  onChange: (fingerprint: string) => void,
  intervalMs = 1000,
  configDir = 'config'
): DependencyScopeWatcher {
  let fingerprint = fingerprintDependencyScope(projectRoot, configDir);
  let stopped = false;
  let nativeSub: { unsubscribe(): Promise<void> | void } | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let nativeSubs: { unsubscribe(): Promise<void> | void }[] = [];

  const check = (): void => {
    if (stopped) return;
    try {
      const current = fingerprintDependencyScope(projectRoot, configDir);
      if (current !== fingerprint) {
        fingerprint = current;
        onChange(current);
      }
    } catch (e) {
      logger.debug(`watchDependencyScope check failed: ${String(e)}`);
    }
  };

  const startPolling = (): void => {
    if (timer || stopped) return;
    timer = setInterval(check, intervalMs);
    (timer as unknown as { unref?: () => void }).unref?.();
  };

  let nativeAvailable = false;
  try {
    const req = createRequire(import.meta.url);
    const watcher = req('@parcel/watcher') as {
      subscribe(dir: string, cb: (err: Error | null, events: { type: string }[]) => void): Promise<{ unsubscribe(): Promise<void> }>;
    };
    if (watcher && typeof watcher.subscribe === 'function') {
      const watchDirs = [
        path.join(projectRoot, 'node_modules', '@microsoft'),
        path.join(projectRoot, configDir)
      ].filter((dir) => {
        try {
          return fs.statSync(dir).isDirectory();
        } catch {
          return false;
        }
      });
      if (watchDirs.length === 0) {
        startPolling();
      } else {
        nativeAvailable = true;
        void Promise.all(
          watchDirs.map((dir) =>
            watcher.subscribe(dir, () => {
              check();
            }).then((sub) => {
              if (stopped) {
                void sub.unsubscribe().catch((e) => logger.debug(`watcher unsubscribe after stop failed: ${String(e)}`));
              } else {
                nativeSubs.push(sub);
                nativeSub = sub;
              }
            }).catch((e) => {
              logger.debug(`watcher subscribe failed for ${dir}: ${String(e)}`);
              if (!timer && nativeSubs.length === 0) {
                startPolling();
              }
            })
          )
        ).catch((e) => {
          logger.debug(`watcher subscribe batch failed: ${String(e)}`);
          if (!timer) startPolling();
        });
      }
    } else {
      startPolling();
    }
  } catch (e) {
    logger.debug(`@parcel/watcher not available, falling back to polling: ${String(e)}`);
    startPolling();
  }

  if (nativeAvailable && !timer) {
    const fallbackTimer = setTimeout(() => {
      if (!stopped && nativeSubs.length === 0 && !timer) {
        logger.debug('native watcher did not establish, starting poll fallback');
        startPolling();
      }
    }, 1500);
    (fallbackTimer as unknown as { unref?: () => void }).unref?.();
  }

  return {
    async stop(): Promise<void> {
      stopped = true;
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
      const subs = [...nativeSubs];
      nativeSubs = [];
      nativeSub = undefined;
      for (const sub of subs) {
        try {
          await sub.unsubscribe();
        } catch (e) {
          logger.debug(`watcher unsubscribe failed: ${String(e)}`);
        }
      }
    }
  };
}
