import type { FrameworkId, FrameworkPreset, RspfxExtension, BeforeCompile, BeforePackage, CompileContext, HookPhase } from './types.js';
import type { RspfxConfig } from '@mbsks/rspfx-core';

export interface HookBus {
  readonly beforeCompile: BeforeCompile[];
  readonly beforePackage: BeforePackage[];
  compose(): { beforeCompile: BeforeCompile; beforePackage: BeforePackage };
}

export interface RspfxInstance {
  use(plugin: RspfxExtension): this;
  presetFor(framework: FrameworkId): FrameworkPreset | undefined;
  readonly plugins: readonly RspfxExtension[];
  readonly hooks: HookBus;
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

function createHookBus(map: Map<string, RspfxExtension>): HookBus {
  return {
    get beforeCompile(): BeforeCompile[] {
      return [...map.values()]
        .map((p) => p.compilerHooks?.beforeCompile)
        .filter((h): h is BeforeCompile => !!h);
    },
    get beforePackage(): BeforePackage[] {
      return [...map.values()]
        .map((p) => p.packageHooks?.beforePackage)
        .filter((h): h is BeforePackage => !!h);
    },
    compose() {
      const bcs = this.beforeCompile;
      const bps = this.beforePackage;
      return {
        beforeCompile: ((ctx: CompileContext) => {
          let current = ctx;
          for (const h of bcs) {
            const res = h(current);
            if (res && typeof res === 'object' && 'ok' in (res as Record<string, unknown>)) {
              const r = res as { ok: boolean; value?: CompileContext; error?: unknown };
              if (!r.ok) return r as unknown as ReturnType<BeforeCompile>;
              if (r.value) current = r.value;
            }
          }
          if (current !== ctx) return { ok: true, value: current } as ReturnType<BeforeCompile>;
          return undefined;
        }) as BeforeCompile,
        beforePackage: ((ctx: { readonly manifests: readonly import('./types.js').ComponentManifest[]; files: Map<string, Uint8Array> }) => {
          let current = ctx.files;
          for (const h of bps) {
            const res = h({ manifests: ctx.manifests, files: current });
            if (res instanceof Map) {
              current = res;
            } else if (res && typeof res === 'object' && 'ok' in (res as Record<string, unknown>)) {
              const r = res as { ok: boolean; value?: Map<string, Uint8Array>; error?: unknown };
              if (!r.ok) return r as unknown as ReturnType<BeforePackage>;
              if (r.value) current = r.value;
            }
          }
          if (current !== ctx.files) return current;
          return undefined;
        }) as BeforePackage
      };
    }
  };
}

export function createRSPFX(opts?: { plugins?: RspfxExtension[] }): RspfxInstance {
  const map = new Map<string, RspfxExtension>();
  for (const p of opts?.plugins ?? []) {
    map.set(p.name, p);
  }
  const hooks = createHookBus(map);
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
    hooks,
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
