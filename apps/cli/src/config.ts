import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import { tryResolveConfig, RSPFX_PLUGIN_MARKER, RSPFX_PLUGIN_OPTIONS, type RspfxConfig } from '@mbsks/rspfx-core';
import type { Issue, RspfxBundlerPluginLike } from '@mbsks/rspfx-core';
import { createLogger, RspfxError, RspfxErrorCode } from '@mbsks/rspfx-diagnostics';
import type { Logger } from '@mbsks/rspfx-diagnostics';
import { createHookBus, createRSPFX } from '@mbsks/rspfx-plugin-api';
import type { HookBus, RspfxInstance, RspfxExtension } from '@mbsks/rspfx-plugin-api';

export type BundlerId = 'rspack' | 'vite' | 'rsbuild';

export interface LoadedProject {
  readonly config: RspfxConfig;
  readonly bundler: BundlerId;
  readonly configFile: string;
  readonly userModuleRules?: readonly unknown[];
  readonly plugin: RspfxBundlerPluginLike;
  readonly bundlerConfig: unknown;
  readonly rspfx: RspfxInstance;
  readonly logger: Logger;
  readonly hookBus: HookBus;
}

const CONFIG_CANDIDATES: readonly { bundler: BundlerId; file: string }[] = [
  { bundler: 'vite', file: 'vite.config.ts' },
  { bundler: 'vite', file: 'vite.config.js' },
  { bundler: 'vite', file: 'vite.config.mjs' },
  { bundler: 'rsbuild', file: 'rsbuild.config.ts' },
  { bundler: 'rsbuild', file: 'rsbuild.config.js' },
  { bundler: 'rsbuild', file: 'rsbuild.config.mjs' },
  { bundler: 'rspack', file: 'rspack.config.ts' },
  { bundler: 'rspack', file: 'rspack.config.js' },
  { bundler: 'rspack', file: 'rspack.config.mjs' }
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
    if (typeof plugin === 'function') {
      try {
        const res = (plugin as () => unknown)();
        if (res !== null && typeof res === 'object' && (res as Record<symbol, unknown>)[RSPFX_PLUGIN_MARKER] === true) {
          return res as unknown as RspfxBundlerPluginLike;
        }
        if (Array.isArray(res)) {
          for (const inner of res) {
            if (inner !== null && typeof inner === 'object' && (inner as Record<symbol, unknown>)[RSPFX_PLUGIN_MARKER] === true) {
              return inner as unknown as RspfxBundlerPluginLike;
            }
          }
        }
      } catch {}
    }
  }
  return undefined;
}

export function formatIssues(issues: Issue[]): string {
  return issues.map((i) => `${i.path.join('.')}: ${i.message} (${i.code})`).join('\n');
}

export function discoverPlugins(bundlerConfig: unknown): RspfxExtension[] {
  if (!bundlerConfig || typeof bundlerConfig !== 'object') return [];
  const plugins = (bundlerConfig as { plugins?: unknown[] }).plugins;
  if (!Array.isArray(plugins)) return [];
  const found: RspfxExtension[] = [];
  for (const plugin of plugins) {
    if (plugin !== null && typeof plugin === 'object' && RSPFX_PLUGIN_MARKER in (plugin as Record<symbol, unknown>)) {
      // Only collect non-rspfx extensions that are RspfxExtension-like (heuristic: has name)
      const cand = plugin as unknown as RspfxExtension;
      if (typeof cand.name === 'string' && (plugin as Record<symbol, unknown>)[RSPFX_PLUGIN_MARKER] !== true) {
        found.push(cand);
      }
    }
  }
  return found;
}

export async function loadConfig(projectRoot: string, opts?: { jitiCache?: boolean }): Promise<LoadedProject> {
  const found = findConfigFile(projectRoot);
  if (!found) {
    throw new RspfxError(
      RspfxErrorCode.CONFIG_NOT_FOUND,
      `No vite.config.ts / rsbuild.config.ts / rspack.config.ts found in ${projectRoot}. Run "rspfx new" to scaffold a project.`
    );
  }
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    fsCache: opts?.jitiCache ?? true,
    fsCachePath: path.join(projectRoot, 'node_modules/.cache/jiti')
  } as unknown as Parameters<typeof createJiti>[1]);
  const mod = await jiti.import(path.resolve(projectRoot, found.file));
  const rawDefault = (mod as { default?: unknown }).default ?? mod;
  const bundlerConfig = typeof rawDefault === 'function' ? await rawDefault({}) : rawDefault;
  const plugin = findRspfxPlugin(bundlerConfig);
  if (!plugin) {
    throw new RspfxError(
      RspfxErrorCode.PLUGIN_NOT_FOUND,
      `No rspfx plugin found in ${found.file}. Add it to the plugins array, e.g. ` +
        `new RspfxPlugin({ name: 'my-app', framework: 'react' }) (rspack), rspfxVite({ ... }) (vite) or rspfxRsbuild({ ... }) (rsbuild).`
    );
  }
  const parsed = tryResolveConfig(plugin[RSPFX_PLUGIN_OPTIONS]);
  if (!parsed.ok) {
    throw new RspfxError(RspfxErrorCode.CONFIG_VALIDATION_FAILED, formatIssues(parsed.error), parsed.error as unknown as Error);
  }
  const userModuleRules = (bundlerConfig as { module?: { rules?: unknown[] } })?.module?.rules;
  const logger = createLogger('cli');
  const hookBus = createHookBus([], { logger });
  const rspfx = createRSPFX({ plugins: discoverPlugins(bundlerConfig), logger });
  return {
    config: parsed.value,
    bundler: found.bundler,
    configFile: found.file,
    userModuleRules: Array.isArray(userModuleRules) ? (userModuleRules as readonly unknown[]) : undefined,
    plugin,
    bundlerConfig,
    rspfx,
    logger,
    hookBus
  };
}
