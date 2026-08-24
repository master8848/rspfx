import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createLogger, RspfxError, RspfxErrorCode } from '@mbsks/rspfx-diagnostics';
import { SPFX_DEFAULT_TARGET, tryResolveConfig } from '@mbsks/rspfx-core';
import { ensureProjectConfigs, readProject } from '@mbsks/rspfx-dev-runtime';
import { ensureCertificates } from '@mbsks/rspfx-manifest-server';
import { loadConfig, type LoadedProject } from '../config.js';
import { resolveViteBin } from '../vite.js';
import { resolveRsbuildBin } from '../rsbuild.js';
import { version } from '../version.js';

const logger = createLogger('rspfx');

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface DoctorResult {
  ok: boolean;
  checks: DoctorCheck[];
}

export async function runDoctor(cwd: string, opts?: { fix?: boolean }): Promise<DoctorResult> {
  if (opts?.fix) {
    try {
      ensureProjectConfigs(cwd);
      logger.info('✓ ensured project configs');
    } catch {}
    try {
      await ensureCertificates(path.join(os.homedir(), '.rspfx', 'certs'));
      logger.info('✓ ensured certificates');
    } catch {}
  }
  const checks: DoctorCheck[] = [];

  checks.push(checkNodeVersion());
  checks.push({ name: 'rspfx version', ok: true, detail: version });

  const packageJsonPath = path.join(cwd, 'package.json');
  const packageJsonExists = fs.existsSync(packageJsonPath);
  checks.push({ name: 'package.json exists', ok: packageJsonExists });

  let loaded: LoadedProject | undefined;
  try {
    loaded = await loadConfig(cwd);
    checks.push({
      name: 'project config loads (rspack.config.ts / vite.config.ts / rsbuild.config.ts)',
      ok: true,
      detail: `${loaded.config.framework} / SPFx ${loaded.config.spfxVersion} / ${loaded.bundler}`
    });
  } catch (error) {
    let detail = error instanceof Error ? error.message : String(error);
    if (error instanceof RspfxError && (error as unknown as { code: string }).code === RspfxErrorCode.CONFIG_VALIDATION_FAILED) {
      const issues = (error.cause as unknown as { path?: (string|number)[]; message?: string }[] | undefined);
      if (Array.isArray(issues) && issues.length > 0) {
        detail = issues.map((i) => `${(i.path ?? []).join('.')}: ${i.message ?? String(i)} (${RspfxErrorCode.CONFIG_VALIDATION_FAILED})`).join('\n');
      }
    }
    checks.push({
      name: 'project config loads (rspack.config.ts / vite.config.ts / rsbuild.config.ts)',
      ok: false,
      detail
    });
    if (opts?.fix) {
      try {
        ensureProjectConfigs(cwd);
        const retry = await loadConfig(cwd);
        checks[checks.length - 1] = {
          name: 'project config loads (rspack.config.ts / vite.config.ts / rsbuild.config.ts)',
          ok: true,
          detail: `${retry.config.framework} / SPFx ${retry.config.spfxVersion} / ${retry.bundler} (fixed)`
        };
        loaded = retry;
      } catch {}
    }
  }

  const config = loaded?.config;

  if (loaded?.bundler === 'vite') {
    try {
      const bin = resolveViteBin(cwd);
      checks.push({ name: 'vite installed', ok: true, detail: bin });
    } catch (error) {
      checks.push({
        name: 'vite installed',
        ok: false,
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (loaded?.bundler === 'rsbuild') {
    try {
      const bin = resolveRsbuildBin(cwd);
      checks.push({ name: 'rsbuild installed', ok: true, detail: bin });
    } catch (error) {
      checks.push({
        name: 'rsbuild installed',
        ok: false,
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const framework = config?.framework ?? 'vanilla';
  const spfxVersion = config?.spfxVersion ?? SPFX_DEFAULT_TARGET;
  checks.push(checkFrameworkPackage(framework));

  if (packageJsonExists) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    checks.push(checkSpDependencies(packageJson.dependencies ?? {}, spfxVersion));
  } else {
    checks.push({ name: 'sp-* dependency versions', ok: false, detail: 'no package.json to inspect' });
  }

  try {
    readProject(cwd);
    checks.push({ name: 'web part bundles discovered', ok: true });
  } catch (error) {
    checks.push({
      name: 'web part bundles discovered',
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    });
  }

  const devPort = config?.dev.port ?? 4321;
  const portFree = await isPortFree(devPort);
  checks.push({ name: `port ${devPort} free (dev server)`, ok: portFree });

  checks.push(checkDistWritable(cwd, config?.build.outDir ?? 'dist'));
  checks.push(checkCertPermissions());
  checks.push(checkServeJsonSchema(cwd));

  const failed = checks.filter((check) => !check.ok).length;
  const ok = failed === 0;
  for (const check of checks) {
    if (check.ok) {
      logger.info(`✓ ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
    } else {
      logger.error(`✗ ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
    }
  }
  logger.info(`${checks.length - failed}/${checks.length} checks passed`);
  return { ok, checks };
}

function checkNodeVersion(): DoctorCheck {
  const major = Number(process.versions.node.split('.')[0]);
  return { name: 'node >= 20', ok: major >= 20, detail: process.versions.node };
}

function checkFrameworkPackage(framework: string): DoctorCheck {
  const pkgName = `@mbsks/rspfx-framework-${framework}`;
  const resolved = resolveFrameworkPackage(pkgName);
  return {
    name: 'framework package resolvable',
    ok: resolved !== undefined,
    ...(resolved !== undefined ? { detail: resolved } : { detail: `${pkgName} could not be resolved` })
  };
}

function resolveFrameworkPackage(pkgName: string): string | undefined {
  const cliDir = path.dirname(fileURLToPath(import.meta.url));
  const fromCli = findPackageDir(pkgName, cliDir);
  if (fromCli) {
    return fromCli;
  }
  const devRuntimeDir = findPackageDir('@mbsks/rspfx-dev-runtime', cliDir);
  if (!devRuntimeDir) {
    return undefined;
  }
  return findPackageDir(pkgName, devRuntimeDir);
}

function findPackageDir(pkgName: string, fromDir: string): string | undefined {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', pkgName);
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

function checkSpDependencies(dependencies: Record<string, string>, spfxVersion: string): DoctorCheck {
  const spDeps = Object.entries(dependencies).filter(([name]) => name.startsWith('@microsoft/sp-'));
  if (spDeps.length === 0) {
    return { name: 'sp-* dependency versions', ok: true, detail: 'no @microsoft/sp-* dependencies' };
  }
  const prefix = `${spfxVersion}.`;
  const mismatches = spDeps
    .filter(([, depVersion]) => {
      const clean = depVersion.replace(/^[~^]/, '');
      return !clean.startsWith(prefix);
    })
    .map(([name, depVersion]) => `${name}@${depVersion}`);
  return {
    name: 'sp-* dependency versions',
    ok: mismatches.length === 0,
    detail:
      mismatches.length > 0
        ? `expected ${prefix}x: ${mismatches.join(', ')}`
        : `${spDeps.length} sp-* deps match SPFx ${spfxVersion}`
  };
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    const done = (free: boolean): void => {
      socket.destroy();
      resolve(free);
    };
    socket.setTimeout(500);
    socket.once('connect', () => done(false));
    socket.once('timeout', () => done(true));
    socket.once('error', () => done(true));
  });
}

function checkDistWritable(cwd: string, outDir: string): DoctorCheck {
  const distDir = path.join(cwd, outDir);
  const probe = path.join(distDir, `.rspfx-write-probe`);
  try {
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(probe, 'ok');
    fs.rmSync(probe, { force: true });
    return { name: `${outDir} writable`, ok: true };
  } catch (error) {
    return {
      name: `${outDir} writable`,
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

function checkCertPermissions(): DoctorCheck {
  const keyPath = path.join(os.homedir(), '.rspfx', 'certs', 'key.pem');
  if (!fs.existsSync(keyPath)) {
    return { name: 'cert permissions (key.pem 0600)', ok: true, detail: 'not generated yet' };
  }
  try {
    const stat = fs.statSync(keyPath);
    const mode = stat.mode & 0o777;
    const ok = mode === 0o600;
    return {
      name: 'cert permissions (key.pem 0600)',
      ok,
      detail: ok ? `0o${mode.toString(8)}` : `expected 0o600, got 0o${mode.toString(8)}`
    };
  } catch (error) {
    return {
      name: 'cert permissions (key.pem 0600)',
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

function checkServeJsonSchema(cwd: string): DoctorCheck {
  const servePath = path.join(cwd, 'config', 'serve.json');
  if (!fs.existsSync(servePath)) {
    return { name: 'config/serve.json valid JSON', ok: true, detail: 'no serve.json' };
  }
  try {
    const content = fs.readFileSync(servePath, 'utf8');
    JSON.parse(content);
    return { name: 'config/serve.json valid JSON', ok: true };
  } catch (error) {
    return {
      name: 'config/serve.json valid JSON',
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}
