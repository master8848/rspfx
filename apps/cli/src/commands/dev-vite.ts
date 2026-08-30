import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { RspfxConfig } from '@mbsks/rspfx-core';
import { getSpfxVersions, registerSpfxVersion, SPFX_DEFAULT_TARGET } from '@mbsks/rspfx-core';
import { buildWorkbenchUrl, readProject, resolveServeMode, resolveServeSettings } from '@mbsks/rspfx-dev-runtime';
import type { ServeMode } from '@mbsks/rspfx-dev-runtime';
import { createLogger, RspfxError, RspfxErrorCode } from '@mbsks/rspfx-diagnostics';
import { formatTrustInstructions, getCertStatus, isCertTrusted } from '@mbsks/rspfx-manifest-server';
import { findConfigFile, loadConfig } from '../config.js';
import { detectOfficialProject, loadOfficialConfig } from '../hybrid.js';
import { spawnViteDev } from '../vite.js';
import { version as cliVersion } from '../version.js';

const logger = createLogger('rspfx');

export interface DevViteOptions {
  port?: number;
  browser?: boolean;
  refresh?: boolean;
  tenant?: string;
  mode?: 'local' | 'sharepoint';
  tsconfig?: string;
  dryRun?: boolean;
  force?: boolean;
}

export interface DevViteHandle {
  url: string;
  port: number;
  workbenchUrl: string | undefined;
  close(): Promise<void>;
}

function findTsconfigFile(projectRoot: string, explicit?: string): string | undefined {
  if (explicit) {
    const resolved = path.isAbsolute(explicit) ? explicit : path.join(projectRoot, explicit);
    if (fs.existsSync(resolved)) return resolved;
    return resolved;
  }
  const candidates = ['tsconfig.json', 'tsconfig.build.json', 'tsconfig.app.json'];
  try {
    const all = fs.readdirSync(projectRoot).filter((f) => f.startsWith('tsconfig') && f.endsWith('.json'));
    for (const f of all) if (!candidates.includes(f)) candidates.push(f);
  } catch {}
  for (const file of candidates) {
    const full = path.join(projectRoot, file);
    if (fs.existsSync(full)) return full;
  }
  return undefined;
}

function detectSpfxVersion(cwd: string, config?: RspfxConfig): { spfxVersion: string; source: string } {
  if (config?.spfxVersion) return { spfxVersion: config.spfxVersion, source: 'config' };
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const raw = pkg.dependencies?.['@microsoft/sp-core-library'] ?? pkg.devDependencies?.['@microsoft/sp-core-library'];
    if (raw) {
      const m = /(\d+\.\d+)/.exec(raw);
      if (m?.[1] && getSpfxVersions().some((v) => v.target === m[1])) return { spfxVersion: m[1], source: `package.json (${raw})` };
    }
  } catch {}
  return { spfxVersion: SPFX_DEFAULT_TARGET, source: `default (${SPFX_DEFAULT_TARGET})` };
}

function synthesizeConfigFromPackageJson(cwd: string): RspfxConfig {
  let pkg: { name?: string; version?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  } catch {}
  const name = (pkg.name ?? path.basename(cwd)).replace(/^@[^/]+\//, '');
  let spfxVersion = SPFX_DEFAULT_TARGET;
  let raw: string | undefined;
  try {
    raw = pkg.dependencies?.['@microsoft/sp-core-library'] ?? pkg.devDependencies?.['@microsoft/sp-core-library'];
    if (raw) {
      const m = /(\d+\.\d+)/.exec(raw);
      const candidate = m?.[1] ?? '';
      if (candidate) {
        if (getSpfxVersions().some((v) => v.target === candidate)) {
          spfxVersion = candidate;
        } else if (/^1\.\d+$/.test(candidate)) {
          // Support older yo-generated versions (e.g. 1.11) for dev-only by registering dynamically
          try {
            registerSpfxVersion({ target: candidate, npmVersion: `${candidate}.0`, toolchain: 'gulp', status: 'ga' });
            spfxVersion = candidate;
            logger.warn(`Registered legacy SPFx target ${candidate} for dev:vite (dev-only, no build/package)`);
          } catch {}
        }
      }
    }
  } catch {}
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  let framework: RspfxConfig['framework'] = 'vanilla';
  if (deps.react) framework = 'react';
  else if (deps.vue) framework = 'vue';
  else if (deps.svelte) framework = 'svelte';
  else if (deps.preact) framework = 'preact';
  else if (deps['solid-js']) framework = 'solid';
  return { name, ...(pkg.version ? { version: pkg.version } : {}), framework: framework as RspfxConfig['framework'], spfxVersion: spfxVersion as RspfxConfig['spfxVersion'], dev: {}, build: {} };
}

function ensureViteConfigFile(cwd: string, config: RspfxConfig, tsconfigFile: string | undefined): string | undefined {
  const found = findConfigFile(cwd);
  if (found) {
    logger.info(`Found existing ${found.file} — leaving as-is (use --force to overwrite)`);
    return undefined;
  }
  const name = config.name ?? path.basename(cwd).replace(/^@[^/]+\//, '');
  const framework = (config.framework as string) ?? 'vanilla';
  const spfxVersion = (config.spfxVersion as string) ?? SPFX_DEFAULT_TARGET;
  const safeName = String(name).replace(/'/g, "\\'");
  const safeFramework = String(framework).replace(/'/g, "\\'");
  const safeSpfxVersion = String(spfxVersion).replace(/'/g, "\\'");
  let tsconfigExtra = '';
  if (tsconfigFile) {
    const rel = path.relative(cwd, tsconfigFile);
    if (rel !== 'tsconfig.json') {
      tsconfigExtra = `, build: { tsconfigPath: '${rel.replace(/'/g, "\\'")}' }`;
    }
  }
  // Use dev-only plugin — lean, vite-first, no @rspack/core
  const tsconfigLine = tsconfigExtra ? `\n  // tsconfig: ${path.relative(cwd, tsconfigFile!)} linked via build.tsconfigPath` : '';
  const content =
    `import { defineConfig } from 'vite';\n` +
    `import { rspfxViteDev } from '@mbsks/rspfx-plugin-dev/vite';\n` +
    `${tsconfigLine}\n` +
    `export default defineConfig({\n` +
    `  plugins: [rspfxViteDev({ name: '${safeName}', framework: '${safeFramework}' as const, spfxVersion: '${safeSpfxVersion}'${tsconfigExtra} })],\n` +
    `});\n`;
  const target = path.join(cwd, 'vite.config.ts');
  fs.writeFileSync(target, content);
  logger.success(`Generated ${path.relative(cwd, target)} using @mbsks/rspfx-plugin-dev (dev-only)`);
  if (tsconfigExtra) logger.info(`Linked custom tsconfig: ${path.relative(cwd, tsconfigFile!)} → build.tsconfigPath`);
  else logger.info('Using default tsconfig.json (yoeman generator default) — no extra config needed');
  return target;
}

function ensurePackageJsonDevPlugin(cwd: string, dryRun?: boolean): boolean {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    logger.warn('No package.json found — skipping dev plugin install');
    return false;
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
    name?: string;
    version?: string;
    type?: string;
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  let changed = false;
  // Ensure type: module for Vite ESM (avoid configLoader native warning)
  if (pkg.type !== 'module') {
    if (!dryRun) {
      pkg.type = 'module';
      changed = true;
    }
    logger.info('Set package.json type to "module" for Vite ESM config (avoids native loader warning)');
  }
  pkg.devDependencies = pkg.devDependencies ?? {};
  const wantDevPlugin = `^${cliVersion}`;
  const wantVite = '^8.0.0';
  if (!pkg.devDependencies['@mbsks/rspfx-plugin-dev']) {
    if (!dryRun) pkg.devDependencies['@mbsks/rspfx-plugin-dev'] = wantDevPlugin;
    changed = true;
    logger.info(`Add @mbsks/rspfx-plugin-dev ${wantDevPlugin} to devDependencies (dev-only, lean)`);
  } else {
    logger.info(`Found existing @mbsks/rspfx-plugin-dev ${pkg.devDependencies['@mbsks/rspfx-plugin-dev']}`);
  }
  if (!pkg.devDependencies.vite && !pkg.dependencies?.vite) {
    if (!dryRun) pkg.devDependencies.vite = wantVite;
    changed = true;
    logger.info(`Add vite ${wantVite} to devDependencies`);
  }
  pkg.scripts = pkg.scripts ?? {};
  if (!pkg.scripts['dev:vite']) {
    if (!dryRun) pkg.scripts['dev:vite'] = 'vite';
    changed = true;
    logger.info('Add package.json script "dev:vite": "vite"');
  }
  if (changed && !dryRun) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    logger.success('Updated package.json — run your package manager install (bun install / npm install)');
  } else if (dryRun && changed) {
    logger.info('[dry-run] Would update package.json');
  }
  return changed;
}

export async function runDevVite(cwd: string, opts: DevViteOptions = {}): Promise<DevViteHandle> {
  // 1. Node / Vite compatibility check
  const nodeMajor = Number(process.versions.node.split('.')[0] ?? '0');
  if (nodeMajor < 20) {
    logger.warn(`Node ${process.versions.node} is below RSPFx required >=20 (Vite 8 requires >=20.19). See docs/compatibility.md. Use nvm use 20 or volta pin node@20.`);
  } else {
    logger.success(`Node ${process.versions.node} OK`);
  }
  // Load config to detect spfxVersion/framework before generation
  let config: RspfxConfig;
  let isOfficial = false;
  try {
    const loaded = await loadConfig(cwd);
    config = loaded.config;
    logger.info(`Loaded rspfx config: ${loaded.configFile} (${loaded.bundler})`);
  } catch (error) {
    const official =
      error instanceof RspfxError && (error as unknown as { code: string }).code === RspfxErrorCode.CONFIG_NOT_FOUND
        ? detectOfficialProject(cwd)
        : undefined;
    if (official) {
      try {
        config = loadOfficialConfig(cwd);
        isOfficial = true;
        logger.warn(`Official SPFx project detected (${official.toolchainMarker}) — dev:vite will scaffold dev-only vite config; keep production on gulp/heft.`);
      } catch (e) {
        // Official detection but sp-core not installed or old version unsupported (e.g. 1.11) — synthesize leniently
        logger.warn(`Official project load failed: ${(e as Error).message} — synthesizing dev config leniently`);
        config = synthesizeConfigFromPackageJson(cwd);
        isOfficial = true;
      }
    } else if (error instanceof RspfxError && (error as unknown as { code: string }).code === RspfxErrorCode.CONFIG_NOT_FOUND) {
      // No bundler config yet and no official marker (e.g. fresh yo project with only package.json) — synthesize
      logger.info('No bundler config found — synthesizing from package.json for dev:vite setup');
      config = synthesizeConfigFromPackageJson(cwd);
    } else {
      throw error;
    }
  }
  const spfxInfo = detectSpfxVersion(cwd, config);
  logger.info(`SPFx version: ${spfxInfo.spfxVersion} (source: ${spfxInfo.source}) — supported 1.20–1.24 full, 1.14–1.19 dev-only`);

  // 2. Handle --dryRun early for setup steps
  if (opts.dryRun) {
    const tsconfigFile = findTsconfigFile(cwd, opts.tsconfig ?? (config.build as unknown as { tsconfigPath?: string })?.tsconfigPath ?? (config as unknown as { tsconfigPath?: string })?.tsconfigPath);
    if (tsconfigFile) logger.info(`[dry-run] Would use tsconfig: ${path.relative(cwd, tsconfigFile)}`);
    else logger.info('[dry-run] No tsconfig found — would use defaults');
    const found = findConfigFile(cwd);
    if (!found) logger.info('[dry-run] Would generate vite.config.ts with @mbsks/rspfx-plugin-dev');
    else logger.info(`[dry-run] Found existing ${found.file} — would leave as-is`);
    ensurePackageJsonDevPlugin(cwd, true);
    logger.info('[dry-run] No files written, not spawning vite');
    const project = readProject(cwd, config.paths, config.version, config);
    const settings = resolveServeSettings({ port: opts.port, tenantDomain: opts.tenant, config }, project.serveJson);
    return { url: settings.origin, port: settings.port, workbenchUrl: undefined, close: async () => {} };
  }

  // 3. Setup steps: package.json + vite config + tsconfig linking
  ensurePackageJsonDevPlugin(cwd, false);
  const tsconfigFile = findTsconfigFile(cwd, opts.tsconfig ?? (config.build as unknown as { tsconfigPath?: string })?.tsconfigPath ?? (config as unknown as { tsconfigPath?: string })?.tsconfigPath);
  if (tsconfigFile) {
    if (fs.existsSync(tsconfigFile)) {
      const rel = path.relative(cwd, tsconfigFile);
      if (rel === 'tsconfig.json') logger.info(`Using tsconfig: ${rel} (default — yoeman generator)`);
      else logger.info(`Using tsconfig: ${rel} (custom — linked via build.tsconfigPath)`);
    } else {
      logger.info(`Using tsconfig: ${tsconfigFile} (not found on disk, Vite will use fallback)`);
    }
  } else {
    logger.info('No tsconfig found — Vite will use defaults; create tsconfig.json or set build.tsconfigPath');
  }
  const force = opts.force ?? false;
  if (force && findConfigFile(cwd)) {
    const f = findConfigFile(cwd)!;
    const p = path.join(cwd, f.file);
    fs.rmSync(p, { force: true });
    logger.warn(`--force removed existing ${f.file}`);
  }
  const generated = ensureViteConfigFile(cwd, config, tsconfigFile);
  if (generated && isOfficial) {
    logger.info('Official project — dev:vite scaffolded dev-only config; run "vite" or "npm run dev:vite" for dev, keep gulp/heft for build/package.');
  }

  // 4. Spawn vite dev server (if vite installed, otherwise just scaffold)
  const hasVite = (() => {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')) as { devDependencies?: Record<string, string>; dependencies?: Record<string, string> };
      return Boolean(pkg.devDependencies?.vite ?? pkg.dependencies?.vite);
    } catch { return false; }
  })();
  if (!hasVite) {
    logger.warn('vite not installed — run bun install / npm install after dev:vite setup, then run "vite"');
    const project = readProject(cwd, config.paths, config.version, config);
    const settings = resolveServeSettings({ port: opts.port, tenantDomain: opts.tenant, config }, project.serveJson);
    return { url: settings.origin, port: settings.port, workbenchUrl: undefined, close: async () => {} };
  }

  const project = readProject(cwd, config.paths, config.version, config);
  const settings = resolveServeSettings({ port: opts.port, tenantDomain: opts.tenant, config }, project.serveJson);
  const serveMode: ServeMode = resolveServeMode({ mode: opts.mode, config }, settings.tenantDomain);
  const fastRefresh = opts.refresh ?? config.dev.fastRefresh ?? false;

  logger.info(`Manifest server running at ${settings.origin}/temp/manifests.js`);

  if (serveMode === 'sharepoint' && settings.https) {
    try {
      const certsDir = path.join(os.homedir(), '.rspfx', 'certs');
      const status = await getCertStatus(certsDir, settings.hostname).catch(() => undefined);
      if (status && (!status.exists || !status.valid)) {
        logger.warn(
          `Dev cert missing or expiring in ${certsDir} — ${status.detail ?? 'needs generation'}. ` +
            `Run rspfx doctor --fix and ${formatTrustInstructions(certsDir).toLowerCase()}. ` +
            `Untrusted certs surface as CORS / NET::ERR_CERT_AUTHORITY_INVALID in workbench.`
        );
      } else {
        const certPath = path.join(certsDir, 'cert.pem');
        const trusted = await isCertTrusted(certPath).catch(() => undefined);
        if (trusted?.trusted === false) {
          logger.warn(
            `Dev cert at ${certPath} is not trusted — ${trusted.detail}. ` +
              `${formatTrustInstructions(certsDir)} — then restart browser. Run rspfx doctor.`
          );
        } else if (trusted?.trusted === 'unknown') {
          logger.info(
            `Dev cert trust unknown — ${trusted.detail}. If workbench shows CORS errors, ${formatTrustInstructions(certsDir).toLowerCase()}. Run rspfx doctor.`
          );
        }
      }
    } catch {}
  }

  const child = spawnViteDev(cwd, { fastRefresh, openBrowser: opts.browser });

  const workbenchUrl = buildWorkbenchUrl(settings, config);
  if (workbenchUrl) {
    printBox(['Open this URL in the SharePoint workbench (debug manifests):', '', workbenchUrl]);
  }

  let closing = false;
  const shutdown = async (): Promise<void> => {
    if (closing) return;
    closing = true;
    child.kill();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  return {
    url: settings.origin,
    port: settings.port,
    workbenchUrl,
    close: async () => {
      child.kill();
    }
  };
}

function printBox(lines: string[]): void {
  const width = Math.min(Math.max(...lines.map((line) => line.length)) + 4, 100);
  const border = `┌${'─'.repeat(width - 2)}┐`;
  const bottom = `└${'─'.repeat(width - 2)}┘`;
  process.stdout.write(`\n${border}\n`);
  for (const line of lines) {
    const content = line.length > width - 4 ? `${line.slice(0, width - 4)}…` : line;
    process.stdout.write(`│ ${content.padEnd(width - 4)} │\n`);
  }
  process.stdout.write(`${bottom}\n\n`);
}
