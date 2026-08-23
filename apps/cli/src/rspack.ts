import type { ChildProcess } from 'node:child_process';
import { resolveRspackBin, runBundlerBuild, spawnBundlerDev } from './bundler-bin.js';

export { resolveRspackBin };

export function runRspackBuild(projectRoot: string): void {
  runBundlerBuild(projectRoot, resolveRspackBin(projectRoot), 'RSPACK_BUILD_FAILED', 'rspack');
}

export function spawnRspackDev(projectRoot: string, opts: { fastRefresh?: boolean; openBrowser?: boolean } = {}): ChildProcess {
  return spawnBundlerDev(projectRoot, resolveRspackBin(projectRoot), ['dev'], opts);
}
