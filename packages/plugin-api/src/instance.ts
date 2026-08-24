import type { Logger } from '@mbsks/rspfx-diagnostics';
import type { FrameworkId, FrameworkPreset, RspfxExtension, CompileContext, OnHookError } from './types.js';
import type { RspfxConfig } from '@mbsks/rspfx-core';
import { createHookBus } from './hook-bus.js';
import type { HookBus } from './hook-bus.js';

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
  const logger = opts?.logger;
  const onError = opts?.onError;

  function currentHookBus(): HookBus {
    return createHookBus([...map.values()], { logger, onError });
  }

  return {
    use(plugin: RspfxExtension): RspfxInstance {
      map.set(plugin.name, plugin);
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
