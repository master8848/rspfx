import fs from 'node:fs';
import path from 'node:path';
import { createLogger, RspfxError } from '@mbsks/rspfx-diagnostics';
import { loadConfig } from '../config.js';

const logger = createLogger('rspfx');

const STATIC_TARGETS = ['temp', '.rspfx', 'node_modules/.cache', 'sharepoint/solution'] as const;

export async function runClean(cwd: string): Promise<string[]> {
  if (!fs.existsSync(path.join(cwd, 'package.json'))) {
    throw new RspfxError(
      'CLEAN_NOT_A_PROJECT',
      `No package.json found in ${cwd}. Run "rspfx clean" inside an RSPFX project.`
    );
  }

  let outDir = 'dist';
  let releaseDir = 'release';
  try {
    const { config } = await loadConfig(cwd);
    outDir = config.build.outDir ?? 'dist';
    releaseDir = config.build.releaseDir ?? 'release';
  } catch {
    // Missing or broken bundler config — fall back to default output dirs.
  }

  const projectRoot = path.resolve(cwd);
  const removed: string[] = [];
  for (const target of [...new Set([outDir, releaseDir, ...STATIC_TARGETS])]) {
    const absolute = path.resolve(projectRoot, target);
    if (absolute !== projectRoot && !absolute.startsWith(projectRoot + path.sep)) {
      logger.warn(`skipping ${target}/ — outside the project root`);
      continue;
    }
    if (fs.existsSync(absolute)) {
      fs.rmSync(absolute, { recursive: true, force: true });
      removed.push(path.relative(projectRoot, absolute));
      logger.info(`removed ${path.relative(projectRoot, absolute)}/`);
    }
  }
  if (removed.length === 0) {
    logger.info('nothing to clean');
  }
  return removed;
}
