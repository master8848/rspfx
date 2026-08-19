import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import { resolveConfig, RSPFX_PLUGIN_MARKER, RSPFX_PLUGIN_OPTIONS, type RspfxConfig } from '@mbsks/rspfx-core';
import type { RspfxBundlerPluginLike } from '@mbsks/rspfx-core';
import { RspfxError } from '@mbsks/rspfx-diagnostics';

export type BundlerId = 'rspack' | 'vite' | 'rsbuild';

export interface LoadedProject {
  config: RspfxConfig;
  bundler: BundlerId;
  configFile: string;
}

const CONFIG_CANDIDATES: readonly { bundler: BundlerId; file: string }[] = [
  { bundler: 'rspack', file: 'rspack.config.ts' },
  { bundler: 'rspack', file: 'rspack.config.js' },
  { bundler: 'vite', file: 'vite.config.ts' },
  { bundler: 'vite', file: 'vite.config.js' },
  { bundler: 'rsbuild', file: 'rsbuild.config.ts' },
  { bundler: 'rsbuild', file: 'rsbuild.config.js' }
];

export function findConfigFile(projectRoot: string): { bundler: BundlerId; file: string } | undefined {
  for (const candidate of CONFIG_CANDIDATES) {
    if (fs.existsSync(path.join(projectRoot, candidate.file))) {
      return candidate;
    }
  }
  return undefined;
}

export function findRspfxPlugin(bundlerConfig: unknown): RspfxBundlerPluginLike | undefined {
  if (!bundlerConfig || typeof bundlerConfig !== 'object') {
    return undefined;
  }
  const plugins = (bundlerConfig as { plugins?: unknown[] }).plugins;
  if (!Array.isArray(plugins)) {
    return undefined;
  }
  for (const plugin of plugins) {
    if (
      plugin !== null &&
      typeof plugin === 'object' &&
      (plugin as Record<symbol, unknown>)[RSPFX_PLUGIN_MARKER] === true
    ) {
      return plugin as unknown as RspfxBundlerPluginLike;
    }
  }
  return undefined;
}

export async function loadConfig(projectRoot: string): Promise<LoadedProject> {
  const found = findConfigFile(projectRoot);
  if (!found) {
    throw new RspfxError(
      'CONFIG_NOT_FOUND',
      `No rspack.config.ts / vite.config.ts / rsbuild.config.ts found in ${projectRoot}. Run "rspfx new" to scaffold a project.`
    );
  }
  // SECURITY: jiti executes the project's config file as JavaScript (rspack.config.ts /
  // vite.config.ts / rsbuild.config.ts). This is intentional and analogous to Vite/Rspack
  // loading user config — the file is user-owned code. We do not sandbox it, but we
  // document the risk: only run `rspfx` in trusted checkouts, review config changes,
  // and prefer `--frozen` / locked installs in CI. `fsCache: false` avoids stale
  // transpiled artifacts on disk.
  const jiti = createJiti(import.meta.url, { interopDefault: true, fsCache: false });
  const mod = await jiti.import(path.resolve(projectRoot, found.file));
  const rawDefault = (mod as { default?: unknown }).default ?? mod;
  const bundlerConfig = typeof rawDefault === 'function' ? rawDefault({}) : rawDefault;
  const plugin = findRspfxPlugin(bundlerConfig);
  if (!plugin) {
    throw new RspfxError(
      'PLUGIN_NOT_FOUND',
      `No rspfx plugin found in ${found.file}. Add it to the plugins array, e.g. ` +
        `new RspfxPlugin({ name: 'my-app', framework: 'react' }) (rspack), rspfxVite({ ... }) (vite) or rspfxRsbuild({ ... }) (rsbuild).`
    );
  }
  return { config: resolveConfig(plugin[RSPFX_PLUGIN_OPTIONS]), bundler: found.bundler, configFile: found.file };
}
