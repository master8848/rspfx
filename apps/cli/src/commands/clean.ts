import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '@mbsks/rspfx-diagnostics';

const logger = createLogger('rspfx');

const TARGETS = ['dist', 'release', 'temp', '.rspfx', 'node_modules/.cache', 'sharepoint/solution'] as const;

export async function runClean(cwd: string): Promise<string[]> {
  const removed: string[] = [];
  for (const target of TARGETS) {
    const absolute = path.join(cwd, target);
    if (fs.existsSync(absolute)) {
      fs.rmSync(absolute, { recursive: true, force: true });
      removed.push(target);
      logger.info(`removed ${target}/`);
    }
  }
  if (removed.length === 0) {
    logger.info('nothing to clean');
  }
  return removed;
}
