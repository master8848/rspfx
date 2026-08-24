import { describe, expect, it, beforeEach } from 'vitest';
import { AggregateRspfxError, RspfxError, RspfxErrorCode } from '@mbsks/rspfx-diagnostics';
import { createHookBus, composeHooks, sortedPlugins } from '../src/hook-bus.js';
import type { RspfxExtension } from '../src/types.js';
import type { CompileContext } from '../src/types.js';

function ctx(projectRoot = '/tmp'): CompileContext {
  return {
    projectRoot,
    config: { name: 'test', framework: 'vanilla', spfxVersion: '1.23', dev: {}, build: {} } as never,
    entries: [],
    externals: [],
    localizedAliases: {},
    fastRefresh: false,
    production: false
  };
}

describe('sortedPlugins', () => {
  it('sorts by priority lower first, stable for equal priority', () => {
    const a: RspfxExtension = { name: 'a', priority: 100 };
    const b: RspfxExtension = { name: 'b', priority: 10 };
    const c: RspfxExtension = { name: 'c', priority: 100 };
    const sorted = sortedPlugins([a, b, c]);
    expect(sorted.map((p) => p.name)).toEqual(['b', 'a', 'c']);
  });
});

describe('composeHooks', () => {
  it('composes sequentially', async () => {
    const calls: string[] = [];
    const h1 = (c: CompileContext) => {
      calls.push('h1');
      return { ok: true, value: { ...c, fastRefresh: true } } as never;
    };
    const h2 = (c: CompileContext) => {
      calls.push('h2');
      expect(c.fastRefresh).toBe(true);
      return undefined;
    };
    const composed = composeHooks(h1, h2);
    const result = await composed(ctx());
    expect(result.ok).toBe(true);
    expect(calls).toEqual(['h1', 'h2']);
  });

  it('propagates Err', async () => {
    const err = new RspfxError(RspfxErrorCode.HOOK_FAILED, 'hook failed');
    const h1 = () => ({ ok: false, error: err } as never);
    const h2 = () => {
      throw new Error('should not be called');
    };
    const composed = composeHooks(h1, h2 as never);
    const result = await composed(ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(err);
  });
});

describe('HookBus', () => {
  it('priority 10 before 100', async () => {
    const order: string[] = [];
    const plugins: RspfxExtension[] = [
      { name: 'second', priority: 100, compilerHooks: { beforeCompile: () => { order.push('second'); } } },
      { name: 'first', priority: 10, compilerHooks: { beforeCompile: () => { order.push('first'); } } }
    ];
    const bus = createHookBus(plugins);
    const result = await bus.emitBeforeCompile(ctx());
    expect(result.ok).toBe(true);
    expect(order).toEqual(['first', 'second']);
  });

  it("onError 'throw' aborts and returns single Err", async () => {
    const err = new RspfxError(RspfxErrorCode.HOOK_FAILED, 'fail');
    const plugins: RspfxExtension[] = [
      { name: 'a', compilerHooks: { beforeCompile: () => ({ ok: false, error: err } as never) } },
      { name: 'b', compilerHooks: { beforeCompile: () => { throw new Error('should not run'); } } }
    ];
    const bus = createHookBus(plugins);
    const result = await bus.emitBeforeCompile(ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(err);
  });

  it("onError 'continue' aggregates 2 errors into AggregateRspfxError", async () => {
    const err1 = new RspfxError(RspfxErrorCode.HOOK_FAILED, 'fail1');
    const err2 = new RspfxError(RspfxErrorCode.HOOK_FAILED, 'fail2');
    const plugins: RspfxExtension[] = [
      { name: 'a', onError: () => 'continue', compilerHooks: { beforeCompile: () => ({ ok: false, error: err1 } as never) } },
      { name: 'b', onError: () => 'continue', compilerHooks: { beforeCompile: () => ({ ok: false, error: err2 } as never) } }
    ];
    const bus = createHookBus(plugins);
    const result = await bus.emitBeforeCompile(ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(AggregateRspfxError);
      const agg = result.error as AggregateRspfxError;
      expect(agg.errors).toHaveLength(2);
      expect(agg.errors[0]).toBe(err1);
      expect(agg.errors[1]).toBe(err2);
    }
  });

  it('global onError continue aggregates thrown and Result errors', async () => {
    const err1 = new RspfxError(RspfxErrorCode.HOOK_FAILED, 'throwing');
    const err2 = new RspfxError(RspfxErrorCode.HOOK_FAILED, 'result');
    const plugins: RspfxExtension[] = [
      { name: 'a', compilerHooks: { beforeCompile: () => { throw err1; } } },
      { name: 'b', compilerHooks: { beforeCompile: () => ({ ok: false, error: err2 } as never) } }
    ];
    const bus = createHookBus(plugins, { onError: () => 'continue' });
    const result = await bus.emitBeforeCompile(ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(AggregateRspfxError);
      expect((result.error as AggregateRspfxError).errors).toHaveLength(2);
    }
  });

  it('async hook awaited', async () => {
    const plugins: RspfxExtension[] = [
      {
        name: 'async',
        compilerHooks: {
          beforeCompile: async (c) => {
            await new Promise((r) => setTimeout(r, 10));
            return { ok: true, value: { ...c, production: true } } as never;
          }
        }
      }
    ];
    const bus = createHookBus(plugins);
    const result = await bus.emitBeforeCompile(ctx());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.production).toBe(true);
  });

  it('HookResult propagation via beforePackage Map', async () => {
    const plugins: RspfxExtension[] = [
      {
        name: 'adder',
        packageHooks: {
          beforePackage: ({ files }) => {
            const next = new Map(files);
            next.set('ClientSideAssets/extra.txt' as never, new Uint8Array([1, 2, 3]));
            return next;
          }
        }
      }
    ];
    const bus = createHookBus(plugins);
    const files = new Map([['a.js' as never, new Uint8Array([1])]]);
    const result = await bus.emitBeforePackage({ manifests: [], files });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.has('ClientSideAssets/extra.txt' as never)).toBe(true);
  });

  it('beforePackage returning Err aborts', async () => {
    const err = new RspfxError(RspfxErrorCode.PACKAGE_VALIDATION, 'validation failed');
    const plugins: RspfxExtension[] = [
      { name: 'fail', packageHooks: { beforePackage: () => ({ ok: false, error: err } as never) } }
    ];
    const bus = createHookBus(plugins);
    const result = await bus.emitBeforePackage({ manifests: [], files: new Map() });
    expect(result.ok).toBe(false);
  });

  it('emitBeforePackage aggregates Map mutations sequentially', async () => {
    const plugins: RspfxExtension[] = [
      { name: 'a', priority: 10, packageHooks: { beforePackage: ({ files }) => { const m = new Map(files); m.set('a.txt' as never, new Uint8Array([1])); return m; } } },
      { name: 'b', priority: 20, packageHooks: { beforePackage: ({ files }) => { const m = new Map(files); m.set('b.txt' as never, new Uint8Array([2])); return m; } } }
    ];
    const bus = createHookBus(plugins);
    const result = await bus.emitBeforePackage({ manifests: [], files: new Map() });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.has('a.txt' as never)).toBe(true);
      expect(result.value.has('b.txt' as never)).toBe(true);
    }
  });
});
