import path from 'node:path';
import fs from 'node:fs';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { RspfxError } from '@mbsks/rspfx-diagnostics';
import { VITE_ENV } from '@mbsks/rspfx-plugin';

export function resolveViteBin(projectRoot: string): string {
  try {
    const requireFromProject = createRequire(pathToFileURL(path.join(projectRoot, 'package.json')).href);
    const pkgJsonPath = requireFromProject.resolve('vite/package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as {
      bin?: string | Record<string, string>;
    };
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin ? Object.values(pkg.bin)[0] : undefined;
    if (typeof bin !== 'string') {
      throw new Error(`vite package has no bin entry: ${pkgJsonPath}`);
    }
    return path.join(path.dirname(pkgJsonPath), bin);
  } catch (error) {
    throw new RspfxError(
      'VITE_NOT_FOUND',
      'Vite is not installed in this project. Add "vite" to devDependencies (rspfx dev/build drive the project-local Vite).',
      error
    );
  }
}

export function runViteBuild(
  projectRoot: string,
  opts: { entry: string; amdId: string }
): void {
  const bin = resolveViteBin(projectRoot);
  const result = spawnSync(process.execPath, [bin, 'build'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      [VITE_ENV.entry]: opts.entry,
      [VITE_ENV.amdId]: opts.amdId,
      [VITE_ENV.mode]: 'production',
      NODE_ENV: 'production'
    }
  });
  if (result.status !== 0) {
    throw new RspfxError(
      'VITE_BUILD_FAILED',
      `vite build failed for entry "${opts.entry}" (exit ${result.status ?? 'signal'})`
    );
  }
}

export function spawnViteDev(projectRoot: string): ChildProcess {
  const bin = resolveViteBin(projectRoot);
  return spawn(process.execPath, [bin], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      [VITE_ENV.mode]: 'development',
      NODE_ENV: 'development'
    }
  });
}
