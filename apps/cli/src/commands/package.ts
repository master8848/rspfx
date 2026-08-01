import fs from 'node:fs';
import path from 'node:path';
import { buildPackage, validateSppkg, type BuildPackageResult } from '@mbsks/rspfx-sppkg-builder';
import { createLogger, formatBytes } from '@mbsks/rspfx-diagnostics';
import { loadConfig } from '../config.js';
import { runBuild } from './build.js';

const logger = createLogger('rspfx');

export interface PackageOptions {
  build?: boolean;
}

export async function runPackage(cwd: string, opts: PackageOptions = {}): Promise<BuildPackageResult> {
  if (opts.build !== false) {
    await runBuild(cwd, {});
  }
  const config = await loadConfig(cwd);
  const releaseDir = config.build.releaseDir ?? 'release';
  const result = await buildPackage({
    projectRoot: cwd,
    solutionConfigPath: 'config/package-solution.json',
    manifestsDir: path.join(releaseDir, 'manifests'),
    assetsDir: path.join(releaseDir, 'assets'),
    outDir: undefined,
    production: true
  });

  const size = fs.statSync(result.outputPath).size;
  logger.success(`Package created: ${result.outputPath} (${formatBytes(size)})`);

  const validation = await validateSppkg(result.outputPath);
  if (!validation.ok) {
    for (const error of validation.errors) {
      logger.error(`Package validation failed: ${error}`);
    }
  } else {
    logger.info(`Package validation passed (${result.zipEntries.length} entries)`);
  }

  return result;
}
