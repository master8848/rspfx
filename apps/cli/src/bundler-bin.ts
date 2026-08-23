import path from 'node:path';
import fs from 'node:fs';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { RspfxError } from '@mbsks/rspfx-diagnostics';

function resolveBin(projectRoot: string, packageName: string, errorCode: string, errorMessage: string): string {
  const tryResolve = (requireFn: NodeRequire): string | undefined => {
    try {
      const pkgJsonPath = requireFn.resolve(`${packageName}/package.json`);
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as {
        bin?: string | Record<string, string>;
      };
      const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin ? Object.values(pkg.bin)[0] : undefined;
      if (typeof bin !== 'string') {
        throw new Error(`${packageName} package has no bin entry: ${pkgJsonPath}`);
      }
      return path.join(path.dirname(pkgJsonPath), bin);
    } catch {
      return undefined;
    }
  };
  try {
    const requireFromProject = createRequire(pathToFileURL(path.join(projectRoot, 'package.json')).href);
    const resolved = tryResolve(requireFromProject);
    if (resolved) return resolved;
  } catch {
    // fall through to repo fallback
  }
  // Fallback to the CLI's own installation (covers temp fixtures without local vite/rsbuild)
  try {
    const requireFromCli = createRequire(import.meta.url);
    const resolved = tryResolve(requireFromCli);
    if (resolved) return resolved;
  } catch {
    // fall through
  }
  throw new RspfxError(errorCode, errorMessage);
}

export function resolveViteBin(projectRoot: string): string {
  return resolveBin(
    projectRoot,
    'vite',
    'VITE_NOT_FOUND',
    'Vite is not installed in this project. Add "vite" to devDependencies (rspfx dev/build drive the project-local Vite).'
  );
}

export function resolveRsbuildBin(projectRoot: string): string {
  return resolveBin(
    projectRoot,
    '@rsbuild/core',
    'RSBUILD_NOT_FOUND',
    'Rsbuild is not installed in this project. Add "@rsbuild/core" to devDependencies (rspfx dev/build drive the project-local Rsbuild).'
  );
}

export function runBundlerBuild(projectRoot: string, bin: string, buildFailedCode: string, label: string): void {
  const result = spawnSync(process.execPath, [bin, 'build'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  if (result.status !== 0) {
    throw new RspfxError(buildFailedCode, `${label} build failed (exit ${result.status ?? 'signal'})`);
  }
}

export function spawnBundlerDev(
  projectRoot: string,
  bin: string,
  args: string[],
  opts: { fastRefresh?: boolean; openBrowser?: boolean } = {}
): ChildProcess {
  return spawn(process.execPath, [bin, ...args], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      ...(opts.fastRefresh ? { RSPFX_FAST_REFRESH: '1' } : {}),
      ...(opts.openBrowser !== undefined ? { RSPFX_OPEN_BROWSER: opts.openBrowser ? '1' : '0' } : {})
    }
  });
}
