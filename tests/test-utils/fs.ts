import { mkdtemp, rm } from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function makeTmp(prefix = 'rspfx-test-'): Promise<string> {
  return mkdtemp(path.join(tmpdir(), prefix));
}

export function makeTmpSync(prefix = 'rspfx-test-'): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

export async function rmRf(target: string): Promise<void> {
  await rm(target, { recursive: true, force: true });
}

export function rmRfSync(target: string): void {
  rmSync(target, { recursive: true, force: true });
}

export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMsOrOptions?: number | { timeoutMs?: number; intervalMs?: number; message?: string },
  message?: string,
): Promise<void> {
  let timeoutMs = 10000;
  let intervalMs = 100;
  let msg = 'waitFor timed out';

  if (typeof timeoutMsOrOptions === 'number') {
    timeoutMs = timeoutMsOrOptions;
    if (message) msg = message;
  } else if (timeoutMsOrOptions && typeof timeoutMsOrOptions === 'object') {
    if (typeof timeoutMsOrOptions.timeoutMs === 'number') timeoutMs = timeoutMsOrOptions.timeoutMs;
    if (typeof timeoutMsOrOptions.intervalMs === 'number') intervalMs = timeoutMsOrOptions.intervalMs;
    if (typeof timeoutMsOrOptions.message === 'string') msg = timeoutMsOrOptions.message;
  }

  const started = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const done = await predicate();
        if (done) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - started > timeoutMs) {
          clearInterval(timer);
          reject(new Error(msg));
        }
      } catch (err) {
        clearInterval(timer);
        reject(err);
      }
    }, intervalMs);
  });
}
