import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import { resolveConfig, RSPFX_PLUGIN_MARKER, type RspfxConfig } from '@mbsks/rspfx-core';
import type { RspfxBundlerPluginLike } from '@mbsks/rspfx-core';
import { RspfxError } from '@mbsks/rspfx-diagnostics';

export type BundlerId = 'rspack' | 'vite';

export interface LoadedProject {
  config: RspfxConfig;
  bundler: BundlerId;
  configFile: string;
}

const CONFIG_CANDIDATES: readonly { bundler: BundlerId; file: string }[] = [
  { bundler: 'rspack', file: 'rspack.config.ts' },
  { bundler: 'rspack', file: 'rspack.config.js' },
  { bundler: 'vite', file: 'vite.config.ts' },
  { bundler: 'vite', file: 'vite.config.js' }
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
      `No rspack.config.ts / vite.config.ts found in ${projectRoot}. Run "rspfx new" to scaffold a project.`
    );
  }
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  const mod = await jiti.import(path.resolve(projectRoot, found.file));
  const rawDefault = (mod as { default?: unknown }).default ?? mod;
  const bundlerConfig = typeof rawDefault === 'function' ? rawDefault({}) : rawDefault;
  const plugin = findRspfxPlugin(bundlerConfig);
  if (!plugin) {
    throw new RspfxError(
      'PLUGIN_NOT_FOUND',
      `No rspfx plugin found in ${found.file}. Add it to the plugins array, e.g. ` +
        `new RspfxPlugin({ name: 'my-app', framework: 'react' }) (rspack) or rspfxVite({ ... }) (vite).`
    );
  }
  return { config: resolveConfig(plugin.options), bundler: found.bundler, configFile: found.file };
}
