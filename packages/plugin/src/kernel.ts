import { createHash } from 'node:crypto';
import type { RspfxConfig } from '@mbsks/rspfx-core';
import type { BundleEntry, CompileContext } from '@mbsks/rspfx-compiler-rspack';
import {
  readProject,
  createCompileContext,
  createManifestRegenerator,
  createReloadController,
  loadFrameworkPreset,
  resolveContributionLoaders,
  type ReadProjectResult
} from '@mbsks/rspfx-dev-runtime';
import type { RefreshRuntime } from '@mbsks/rspfx-dev-runtime';
import type { FrameworkPreset } from '@mbsks/rspfx-plugin-api';
import { amdName, collectExternals, computeUniqueName, writeStatsJson } from './shared.js';

export interface KernelOpts {
  root: string;
  config: RspfxConfig;
  project: ReadProjectResult;
  fastRefresh: boolean;
  mode: 'build' | 'dev';
  originRef?: { value: string };
  logger?: { warn(msg: string): void; info(msg: string): void };
}

export interface Kernel {
  readonly externals: string[];
  amdName(entry: BundleEntry): string;
  uniqueName(): string;
  cacheVersion(): string;
  lazyCompilation(): { entries: false; imports: true } | undefined;
  createCompileContext(opts: {
    production: boolean;
    serveMode: boolean;
    userModuleRules?: unknown[];
  }): CompileContext;
  createManifestRegenerator(opts: {
    origin: () => string;
    refreshRuntime?: RefreshRuntime;
  }): ReturnType<typeof createManifestRegenerator>;
  createReload(): ReturnType<typeof createReloadController>;
  loadPreset(): Promise<{ preset: FrameworkPreset; moduleUrl: string }>;
  resolveContributionLoaders(
    contributions: Record<string, unknown>,
    moduleUrl: string
  ): Record<string, unknown>;
  writeStats(counts: Record<string, number>): void;
}

export function createKernel(opts: KernelOpts): Kernel {
  const externals = collectExternals(opts.root, opts.project.externals, opts.project.localizedResources);

  const cacheVersion = createHash('md5')
    .update(
      JSON.stringify({
        framework: opts.config.framework,
        spfxVersion: opts.config.spfxVersion,
        build: opts.config.build
      })
    )
    .digest('hex')
    .slice(0, 8);

  const uniqueName = (): string => computeUniqueName(opts.project.webParts.entries);

  return {
    externals,
    amdName,
    uniqueName,
    cacheVersion: (): string => cacheVersion,
    lazyCompilation: (): { entries: false; imports: true } | undefined =>
      opts.mode === 'dev' ? { entries: false, imports: true } : undefined,
    createCompileContext(cOpts): CompileContext {
      const ctx = createCompileContext({
        projectRoot: opts.root,
        config: opts.config,
        entries: opts.project.webParts.entries,
        externals,
        localizedAliases: opts.project.localizedAliases,
        localizedResources: opts.project.localizedResources,
        fastRefresh: opts.fastRefresh,
        production: cOpts.production,
        serveMode: cOpts.serveMode,
        build: { ...opts.config.build }
      });
      if (cOpts.userModuleRules) {
        (ctx as unknown as { userModuleRules: unknown[] }).userModuleRules = cOpts.userModuleRules;
      }
      return ctx;
    },
    createManifestRegenerator(rOpts) {
      const entryModuleIds: Record<string, string> = {};
      opts.project.webParts.bundles.forEach((bundle, index) => {
        entryModuleIds[opts.project.webParts.manifestIds[index]!] = bundle.bundleName;
      });
      return createManifestRegenerator({
        projectRoot: opts.root,
        production: opts.mode === 'build',
        origin: rOpts.origin,
        packageVersion: opts.project.webParts.packageVersion,
        entries: opts.project.webParts.entries,
        externals,
        localizedResources: opts.project.localizedResources,
        webpartsDir: opts.config.paths?.webpartsDir,
        extensionsDir: opts.config.paths?.extensionsDir,
        librariesDir: opts.config.paths?.librariesDir,
        entryModuleIds,
        refreshRuntime: rOpts.refreshRuntime,
        bundleUrlSuffix: () => ''
      });
    },
    createReload() {
      return createReloadController();
    },
    async loadPreset(): Promise<{ preset: FrameworkPreset; moduleUrl: string }> {
      const mod = await loadFrameworkPreset(opts.config.framework, opts.root);
      return { preset: mod.preset as unknown as FrameworkPreset, moduleUrl: mod.moduleUrl };
    },
    resolveContributionLoaders(contributions, moduleUrl) {
      return resolveContributionLoaders(contributions, moduleUrl);
    },
    writeStats(counts) {
      writeStatsJson(opts.root, counts);
    }
  };
}

// Re-export for testing convenience
export { readProject };
