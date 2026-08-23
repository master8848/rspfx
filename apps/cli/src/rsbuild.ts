import type { ChildProcess } from 'node:child_process';
import { resolveRsbuildBin, runBundlerBuild, spawnBundlerDev } from './bundler-bin.js';

export { resolveRsbuildBin };

export function runRsbuildBuild(projectRoot: string): void {
  runBundlerBuild(projectRoot, resolveRsbuildBin(projectRoot), 'RSBUILD_BUILD_FAILED', 'rsbuild');
}

export function spawnRsbuildDev(projectRoot: string, opts: { fastRefresh?: boolean; openBrowser?: boolean } = {}): ChildProcess {
  return spawnBundlerDev(projectRoot, resolveRsbuildBin(projectRoot), ['dev'], opts);
}
