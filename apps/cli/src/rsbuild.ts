import path from 'node:path';
import fs from 'node:fs';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { RspfxError } from '@mbsks/rspfx-diagnostics';

export function resolveRsbuildBin(projectRoot: string): string {
  try {
    const requireFromProject = createRequire(pathToFileURL(path.join(projectRoot, 'package.json')).href);
    const pkgJsonPath = requireFromProject.resolve('@rsbuild/core/package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as {
      bin?: string | Record<string, string>;
    };
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin ? Object.values(pkg.bin)[0] : undefined;
    if (typeof bin !== 'string') {
      throw new Error(`@rsbuild/core package has no bin entry: ${pkgJsonPath}`);
    }
    return path.join(path.dirname(pkgJsonPath), bin);
  } catch (error) {
    throw new RspfxError(
      'RSBUILD_NOT_FOUND',
      'Rsbuild is not installed in this project. Add "@rsbuild/core" to devDependencies (rspfx dev/build drive the project-local Rsbuild).',
      error
    );
  }
}

export function runRsbuildBuild(projectRoot: string): void {
  const bin = resolveRsbuildBin(projectRoot);
  const result = spawnSync(process.execPath, [bin, 'build'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
  if (result.status !== 0) {
    throw new RspfxError(
      'RSBUILD_BUILD_FAILED',
      `rsbuild build failed (exit ${result.status ?? 'signal'})`
    );
  }
}

export function spawnRsbuildDev(projectRoot: string): ChildProcess {
  const bin = resolveRsbuildBin(projectRoot);
  return spawn(process.execPath, [bin, 'dev'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });
}
