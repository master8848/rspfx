import type { Logger } from '@mbsks/rspfx-diagnostics';
import type { FrameworkId, FrameworkPreset, RspfxExtension, CompileContext, OnHookError } from './types.js';
import type { RspfxConfig } from '@mbsks/rspfx-core';
import { createRequire } from 'node:module';
import { createHookBus } from './hook-bus.js';
import type { HookBus } from './hook-bus.js';
import { setActivePlugins } from './patch-registry.js';

export type { HookBus } from './hook-bus.js';

export interface RspfxInstance {
  use(plugin: RspfxExtension): this;
  presetFor(framework: FrameworkId): FrameworkPreset | undefined;
  readonly plugins: readonly RspfxExtension[];
  readonly hooks: HookBus;
  readonly hookBus: HookBus;
  createCompileContext(opts: {
    projectRoot: string;
    config: RspfxConfig;
    entries: Array<Record<string, unknown>>;
    externals: string[];
    localizedAliases: Record<string, string>;
    fastRefresh: boolean;
    production: boolean;
  }): CompileContext;
}

export function createRSPFX(opts?: { plugins?: RspfxExtension[]; logger?: Logger; onError?: OnHookError }): RspfxInstance {
  const map = new Map<string, RspfxExtension>();
  for (const p of opts?.plugins ?? []) {
    map.set(p.name, p);
  }
  // Sync to global patch registry so manifest-generator/sppkg-builder (which import plugin-api) can see plugins
  // without needing to thread RspfxInstance through every call. Also installs spfxVersions lazily via core.
  try { setActivePlugins([...map.values()]); } catch {}
  // Also install any spfxVersions contributed by initial plugins
  try {
    const { registerSpfxVersion } = awaitImportCore();
    for (const p of map.values()) {
      for (const v of ((p as unknown as { spfxVersions?: readonly { target: string; npmVersion: string; toolchain: 'gulp' | 'heft'; status: 'ga' | 'preview' }[] }).spfxVersions ?? [])) {
        try { registerSpfxVersion(v as unknown as import('@mbsks/rspfx-core').SpfxVersionInfo); } catch {}
      }
    }
  } catch {}
  const logger = opts?.logger;
  const onError = opts?.onError;

  function awaitImportCore(): { registerSpfxVersion: (info: import('@mbsks/rspfx-core').SpfxVersionInfo) => void } {
    try {
      const req = createRequire(import.meta.url);
      return req('@mbsks/rspfx-core') as { registerSpfxVersion: (info: import('@mbsks/rspfx-core').SpfxVersionInfo) => void };
    } catch {
      return { registerSpfxVersion: () => {} };
    }
  }

  function currentHookBus(): HookBus {
    return createHookBus([...map.values()], { logger, onError });
  }

  return {
    use(plugin: RspfxExtension): RspfxInstance {
      map.set(plugin.name, plugin);
      try { setActivePlugins([...map.values()]); } catch {}
      try {
        const { registerSpfxVersion } = awaitImportCore();
        for (const v of ((plugin as unknown as { spfxVersions?: readonly { target: string; npmVersion: string; toolchain: 'gulp' | 'heft'; status: 'ga' | 'preview' }[] }).spfxVersions ?? [])) {
          try { registerSpfxVersion(v as unknown as import('@mbsks/rspfx-core').SpfxVersionInfo); } catch {}
        }
      } catch {}
      return this;
    },
    presetFor(framework: FrameworkId): FrameworkPreset | undefined {
      for (const p of map.values()) {
        if (p.frameworkPreset?.name === framework) return p.frameworkPreset;
      }
      return undefined;
    },
    get plugins(): readonly RspfxExtension[] {
      return [...map.values()];
    },
    get hooks(): HookBus {
      return currentHookBus();
    },
    get hookBus(): HookBus {
      return currentHookBus();
    },
    createCompileContext(o): CompileContext {
      return {
        projectRoot: o.projectRoot,
        config: o.config,
        entries: o.entries,
        externals: o.externals,
        localizedAliases: o.localizedAliases,
        fastRefresh: o.fastRefresh,
        production: o.production
      };
    }
  };
}
