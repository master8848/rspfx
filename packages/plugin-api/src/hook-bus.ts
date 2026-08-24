import type { Logger } from '@mbsks/rspfx-diagnostics';
import { AggregateRspfxError, RspfxError, RspfxErrorCode } from '@mbsks/rspfx-diagnostics';
import type {
  AfterGenerate,
  AfterPackage,
  AfterStats,
  BeforeCompile,
  BeforeGenerate,
  BeforePackage,
  BeforeStart,
  AfterStart,
  CompileContext,
  ComponentManifest,
  HookPhase,
  HookResult,
  OnHookError,
  RspfxExtension
} from './types.js';
import type { ZipPath } from '@mbsks/rspfx-core';

export function sortedPlugins(plugins: readonly RspfxExtension[]): readonly RspfxExtension[] {
  return [...plugins].sort((a, b) => {
    const pa = a.priority ?? 100;
    const pb = b.priority ?? 100;
    if (pa !== pb) return pa - pb;
    return 0;
  });
}

export function composeHooks<T>(...hooks: Array<(ctx: T) => HookResult<T> | void | Promise<HookResult<T> | void>>): (ctx: T) => Promise<HookResult<T>> {
  return async (ctx: T): Promise<HookResult<T>> => {
    let current = ctx;
    for (const h of hooks) {
      const res = await h(current);
      if (res !== undefined && typeof res === 'object' && 'ok' in (res as Record<string, unknown>)) {
        const r = res as HookResult<T>;
        if (!r.ok) return r;
        current = (r as { ok: true; value: T }).value ?? current;
      }
    }
    return { ok: true, value: current } as HookResult<T>;
  };
}

export interface HookBus {
  readonly plugins: readonly RspfxExtension[];
  readonly onError: OnHookError | undefined;
  emitBeforeCompile(ctx: CompileContext): Promise<HookResult<CompileContext>>;
  emitAfterStats(stats: import('./types.js').Stats): Promise<void>;
  emitAfterCompile(stats: import('./types.js').Stats): Promise<void>;
  emitBeforeGenerate(ctx: { readonly production: boolean; readonly webParts: readonly import('./types.js').WebPartEntry[] }): Promise<HookResult<typeof ctx>>;
  emitAfterGenerate(ctx: { readonly manifests: readonly ComponentManifest[]; readonly releaseDir: string }): Promise<void>;
  emitBeforeStart(ctx: { readonly mode: 'local' | 'sharepoint'; readonly port?: number }): Promise<HookResult<typeof ctx>>;
  emitAfterStart(ctx: { readonly url: string }): Promise<void>;
  emitBeforePackage(ctx: { readonly manifests: readonly ComponentManifest[]; readonly files: ReadonlyMap<ZipPath, Uint8Array> }): Promise<HookResult<ReadonlyMap<ZipPath, Uint8Array>>>;
  emitAfterPackage(ctx: { readonly sppkgPath: ZipPath }): Promise<void>;
}

function toRspfxError(e: unknown, phase: HookPhase, pluginName: string): RspfxError {
  if (e instanceof RspfxError) return e;
  if (e instanceof AggregateRspfxError) {
    // Wrap aggregate as single? For hook throw, return first error or wrap
    return new RspfxError(RspfxErrorCode.HOOK_FAILED, `${phase}:${pluginName} failed: ${e.message}`, e as unknown as Error);
  }
  const msg = e instanceof Error ? e.message : String(e);
  const cause = e instanceof Error ? e : undefined;
  return new RspfxError(RspfxErrorCode.HOOK_FAILED, `${phase}:${pluginName} failed: ${msg}`, cause);
}

export function createHookBus(plugins: readonly RspfxExtension[], opts?: { logger?: Logger; onError?: OnHookError }): HookBus {
  const sorted = sortedPlugins(plugins);
  const globalOnError = opts?.onError;

  async function runHook<T>(
    phase: HookPhase,
    plugin: RspfxExtension,
    fn: () => unknown,
    currentOnError: OnHookError | undefined
  ): Promise<{ ok: true; value?: T } | { ok: false; error: RspfxError } | { ok: true; value?: undefined; continue: true } | undefined> {
    try {
      const res = await fn();
      if (res !== undefined && typeof res === 'object' && 'ok' in (res as Record<string, unknown>)) {
        const r = res as HookResult<T>;
        if (!r.ok) {
          const err = (r as { error: RspfxError }).error;
          const decision = plugin.onError?.(err as RspfxError, phase, plugin.name) ?? currentOnError?.(err as RspfxError, phase, plugin.name) ?? globalOnError?.(err as RspfxError, phase, plugin.name) ?? 'throw';
          if (decision === 'throw') {
            return { ok: false, error: err as RspfxError };
          }
          // continue -> accumulate
          return { ok: true, value: undefined, continue: true } as unknown as { ok: true; value?: T };
        }
        // ok true
        const value = (r as { value: T }).value;
        return { ok: true, value };
      }
      if (res instanceof Map) {
        return { ok: true, value: res as unknown as T };
      }
      // void or direct value? For beforePackage Map direct return already handled; for others ignore
      return undefined;
    } catch (e) {
      const err = toRspfxError(e, phase, plugin.name);
      const decision = plugin.onError?.(err, phase, plugin.name) ?? currentOnError?.(err, phase, plugin.name) ?? globalOnError?.(err, phase, plugin.name) ?? 'throw';
      if (decision === 'throw') {
        return { ok: false, error: err };
      }
      // Need to accumulate this err in outer caller; signal via special return that includes error to accumulate
      // We'll return a marker that outer loop should push err and continue
      // Use a custom symbol via error property?
      // Instead we handle accumulation in caller: if we return {ok:true, continue:true, error: err}
      return { ok: true, value: undefined, continue: true, error: err } as unknown as { ok: true; value?: T };
    }
  }

  return {
    get plugins() {
      return plugins;
    },
    get onError() {
      return globalOnError;
    },

    async emitBeforeCompile(ctx): Promise<HookResult<CompileContext>> {
      let cur = ctx;
      const errors: RspfxError[] = [];
      for (const p of sorted) {
        const hook = p.compilerHooks?.beforeCompile as BeforeCompile | undefined;
        if (!hook) continue;
        opts?.logger?.trace?.(`hook:emitBeforeCompile`, { plugin: p.name });
        const start = performance.now();
        const outcome = await (async () => {
          try {
            const res = await hook(cur);
            if (res !== undefined && typeof res === 'object' && 'ok' in (res as Record<string, unknown>)) {
              const r = res as HookResult<CompileContext>;
              if (!r.ok) {
                const err = (r as { error: RspfxError }).error as RspfxError;
                const decision = p.onError?.(err, 'beforeCompile', p.name) ?? globalOnError?.(err, 'beforeCompile', p.name) ?? 'throw';
                if (decision === 'throw') return { kind: 'abort', error: err } as const;
                errors.push(err);
                return { kind: 'continue' } as const;
              }
              const v = (r as { value: CompileContext }).value;
              if (v !== undefined) cur = v;
              return { kind: 'ok' } as const;
            }
            if (res !== undefined && typeof res === 'object' && !(res as Record<string, unknown>).ok) {
              // direct CompileContext object? not expected
            }
            return { kind: 'ok' } as const;
          } catch (e) {
            const err = toRspfxError(e, 'beforeCompile', p.name);
            const decision = p.onError?.(err, 'beforeCompile', p.name) ?? globalOnError?.(err, 'beforeCompile', p.name) ?? 'throw';
            if (decision === 'throw') return { kind: 'abort', error: err } as const;
            errors.push(err);
            return { kind: 'continue' } as const;
          }
        })();
        const durationMs = performance.now() - start;
        if (opts?.logger?.isLevelEnabled?.('trace')) {
          opts.logger.trace(`hook:beforeCompile`, { plugin: p.name, durationMs });
        }
        void durationMs;
        if (outcome && (outcome as { kind: string }).kind === 'abort') {
          const err = (outcome as { kind: 'abort'; error: RspfxError }).error;
          if (errors.length > 0) {
            // If we already accumulated errors and this one aborts, include it
            return { ok: false, error: new AggregateRspfxError([...errors, err]) } as HookResult<CompileContext>;
          }
          return { ok: false, error: err } as HookResult<CompileContext>;
        }
      }
      if (errors.length > 0) {
        return { ok: false, error: new AggregateRspfxError(errors) } as HookResult<CompileContext>;
      }
      return { ok: true, value: cur } as HookResult<CompileContext>;
    },

    async emitAfterStats(stats): Promise<void> {
      for (const p of sorted) {
        const hook = (p.compilerHooks?.afterStats ?? p.compilerHooks?.afterCompile) as AfterStats | undefined;
        if (!hook) continue;
        try {
          await hook(stats);
        } catch (e) {
          const err = toRspfxError(e, 'afterStats', p.name);
          const decision = p.onError?.(err, 'afterStats', p.name) ?? globalOnError?.(err, 'afterStats', p.name) ?? 'throw';
          if (decision === 'throw') throw err;
          opts?.logger?.warn?.(`hook:afterStats continue after error`, { plugin: p.name, error: err.message });
        }
      }
    },

    async emitAfterCompile(stats): Promise<void> {
      return this.emitAfterStats(stats);
    },

    async emitBeforeGenerate(ctx): Promise<HookResult<typeof ctx>> {
      let cur = ctx;
      const errors: RspfxError[] = [];
      for (const p of sorted) {
        const hook = p.releaseHooks?.beforeGenerate as BeforeGenerate | undefined;
        if (!hook) continue;
        try {
          const res = await hook(cur);
          if (res !== undefined && typeof res === 'object' && 'ok' in (res as Record<string, unknown>)) {
            const r = res as HookResult<typeof ctx>;
            if (!r.ok) {
              const err = (r as { error: RspfxError }).error as RspfxError;
              const decision = p.onError?.(err, 'beforeGenerate', p.name) ?? globalOnError?.(err, 'beforeGenerate', p.name) ?? 'throw';
              if (decision === 'throw') return { ok: false, error: err } as HookResult<typeof ctx>;
              errors.push(err);
              continue;
            }
            cur = (r as { value: typeof ctx }).value ?? cur;
          }
        } catch (e) {
          const err = toRspfxError(e, 'beforeGenerate', p.name);
          const decision = p.onError?.(err, 'beforeGenerate', p.name) ?? globalOnError?.(err, 'beforeGenerate', p.name) ?? 'throw';
          if (decision === 'throw') return { ok: false, error: err } as HookResult<typeof ctx>;
          errors.push(err);
        }
      }
      if (errors.length > 0) return { ok: false, error: new AggregateRspfxError(errors) } as HookResult<typeof ctx>;
      return { ok: true, value: cur } as HookResult<typeof ctx>;
    },

    async emitAfterGenerate(ctx): Promise<void> {
      for (const p of sorted) {
        const hook = p.releaseHooks?.afterGenerate as AfterGenerate | undefined;
        if (!hook) continue;
        try {
          await hook(ctx);
        } catch (e) {
          const err = toRspfxError(e, 'afterGenerate', p.name);
          const decision = p.onError?.(err, 'afterGenerate', p.name) ?? globalOnError?.(err, 'afterGenerate', p.name) ?? 'throw';
          if (decision === 'throw') throw err;
        }
      }
    },

    async emitBeforeStart(ctx): Promise<HookResult<typeof ctx>> {
      let cur = ctx;
      const errors: RspfxError[] = [];
      for (const p of sorted) {
        const hook = p.devHooks?.beforeStart as BeforeStart | undefined;
        if (!hook) continue;
        try {
          const res = await hook(cur);
          if (res !== undefined && typeof res === 'object' && 'ok' in (res as Record<string, unknown>)) {
            const r = res as HookResult<typeof ctx>;
            if (!r.ok) {
              const err = (r as { error: RspfxError }).error as RspfxError;
              const decision = p.onError?.(err, 'beforeStart', p.name) ?? globalOnError?.(err, 'beforeStart', p.name) ?? 'throw';
              if (decision === 'throw') return { ok: false, error: err } as HookResult<typeof ctx>;
              errors.push(err);
              continue;
            }
            cur = (r as { value: typeof ctx }).value ?? cur;
          }
        } catch (e) {
          const err = toRspfxError(e, 'beforeStart', p.name);
          const decision = p.onError?.(err, 'beforeStart', p.name) ?? globalOnError?.(err, 'beforeStart', p.name) ?? 'throw';
          if (decision === 'throw') return { ok: false, error: err } as HookResult<typeof ctx>;
          errors.push(err);
        }
      }
      if (errors.length > 0) return { ok: false, error: new AggregateRspfxError(errors) } as HookResult<typeof ctx>;
      return { ok: true, value: cur } as HookResult<typeof ctx>;
    },

    async emitAfterStart(ctx): Promise<void> {
      for (const p of sorted) {
        const hook = p.devHooks?.afterStart as AfterStart | undefined;
        if (!hook) continue;
        try {
          await hook(ctx);
        } catch (e) {
          const err = toRspfxError(e, 'afterStart', p.name);
          const decision = p.onError?.(err, 'afterStart', p.name) ?? globalOnError?.(err, 'afterStart', p.name) ?? 'throw';
          if (decision === 'throw') throw err;
        }
      }
    },

    async emitBeforePackage(ctx): Promise<HookResult<ReadonlyMap<ZipPath, Uint8Array>>> {
      let cur: ReadonlyMap<ZipPath, Uint8Array> = ctx.files;
      const manifests = ctx.manifests;
      const errors: RspfxError[] = [];
      for (const p of sorted) {
        const hook = p.packageHooks?.beforePackage as BeforePackage | undefined;
        if (!hook) continue;
        try {
          const res = await hook({ manifests, files: cur });
          if (res instanceof Map) {
            cur = res as ReadonlyMap<ZipPath, Uint8Array>;
            continue;
          }
          if (res !== undefined && typeof res === 'object' && 'ok' in (res as Record<string, unknown>)) {
            const r = res as HookResult<ReadonlyMap<ZipPath, Uint8Array>>;
            if (!r.ok) {
              const err = (r as { error: RspfxError }).error as RspfxError;
              const decision = p.onError?.(err, 'beforePackage', p.name) ?? globalOnError?.(err, 'beforePackage', p.name) ?? 'throw';
              if (decision === 'throw') return { ok: false, error: err } as HookResult<ReadonlyMap<ZipPath, Uint8Array>>;
              errors.push(err);
              continue;
            }
            cur = (r as { value: ReadonlyMap<ZipPath, Uint8Array> }).value ?? cur;
          }
          // void -> keep cur
        } catch (e) {
          const err = toRspfxError(e, 'beforePackage', p.name);
          const decision = p.onError?.(err, 'beforePackage', p.name) ?? globalOnError?.(err, 'beforePackage', p.name) ?? 'throw';
          if (decision === 'throw') return { ok: false, error: err } as HookResult<ReadonlyMap<ZipPath, Uint8Array>>;
          errors.push(err);
        }
      }
      if (errors.length > 0) return { ok: false, error: new AggregateRspfxError(errors) } as HookResult<ReadonlyMap<ZipPath, Uint8Array>>;
      return { ok: true, value: cur } as HookResult<ReadonlyMap<ZipPath, Uint8Array>>;
    },

    async emitAfterPackage(ctx): Promise<void> {
      for (const p of sorted) {
        const hook = p.packageHooks?.afterPackage as AfterPackage | undefined;
        if (!hook) continue;
        try {
          await hook(ctx);
        } catch (e) {
          const err = toRspfxError(e, 'afterPackage', p.name);
          const decision = p.onError?.(err, 'afterPackage', p.name) ?? globalOnError?.(err, 'afterPackage', p.name) ?? 'throw';
          if (decision === 'throw') throw err;
        }
      }
    }
  };
}
