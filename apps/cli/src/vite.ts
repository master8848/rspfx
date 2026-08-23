import type { ChildProcess } from 'node:child_process';
import { resolveViteBin, runBundlerBuild, spawnBundlerDev } from './bundler-bin.js';

export { resolveViteBin };

export function runViteBuild(projectRoot: string): void {
  runBundlerBuild(projectRoot, resolveViteBin(projectRoot), 'VITE_BUILD_FAILED', 'vite');
}

export function spawnViteDev(projectRoot: string, opts: { fastRefresh?: boolean } = {}): ChildProcess {
  return spawnBundlerDev(projectRoot, resolveViteBin(projectRoot), [], opts);
}
