import fs from 'node:fs';
import path from 'node:path';
import { buildPackage, validateSppkg, type BuildPackageResult } from '@mbsks/rspfx-sppkg-builder';
import { createLogger, formatBytes } from '@mbsks/rspfx-diagnostics';
import { getPlugins } from '@mbsks/rspfx-plugin-api';
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
  const { config } = await loadConfig(cwd);
  const releaseDir = config.build.releaseDir ?? 'release';
  invokeBeforePackage(cwd, releaseDir);
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

  for (const plugin of getPlugins()) {
    plugin.packageHooks?.afterPackage?.({ sppkgPath: result.outputPath });
  }

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

function invokeBeforePackage(cwd: string, releaseDir: string): void {
  const manifestsDir = path.join(cwd, releaseDir, 'manifests');
  const assetsDir = path.join(cwd, releaseDir, 'assets');
  const manifests: unknown[] = [];
  if (fs.existsSync(manifestsDir)) {
    for (const file of fs.readdirSync(manifestsDir)) {
      if (!file.endsWith('.manifest.json')) {
        continue;
      }
      manifests.push(JSON.parse(fs.readFileSync(path.join(manifestsDir, file), 'utf8')));
    }
  }
  const files: { path: string; content: Uint8Array }[] = [];
  if (fs.existsSync(assetsDir)) {
    for (const name of fs.readdirSync(assetsDir)) {
      const filePath = path.join(assetsDir, name);
      if (!fs.statSync(filePath).isFile()) {
        continue;
      }
      files.push({ path: name, content: fs.readFileSync(filePath) });
    }
  }
  for (const plugin of getPlugins()) {
    plugin.packageHooks?.beforePackage?.({ manifests, files });
  }
}
