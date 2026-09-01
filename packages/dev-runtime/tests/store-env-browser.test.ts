import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { mockSpawn } = vi.hoisted(() => ({
  mockSpawn: vi.fn(() => ({ on: vi.fn(), unref: vi.fn() }) as unknown as ReturnType<typeof import('node:child_process').spawn>),
}));
vi.mock('node:child_process', async () => {
  const actual = (await vi.importActual('node:child_process')) as Record<string, unknown>;
  return { ...actual, spawn: mockSpawn };
});

// --- Store ---
import { createStore, type DevStoreSnapshot } from '../src/store.js';
import { expandEnvVars, expandObject, loadDotEnv } from '../src/env.js';
import { openBrowser } from '../src/browser.js';

function makeSnapshot(overrides: Partial<DevStoreSnapshot> = {}): DevStoreSnapshot {
  return {
    mode: 'sharepoint',
    origin: 'https://localhost:4321',
    tick: 0,
    status: 'idle',
    fastRefresh: false,
    ...overrides,
  };
}

// store tests
describe('store', () => {
  it('set patch Object.is diff — changed true notifies, changed false no notify', () => {
    const store = createStore(makeSnapshot({ tick: 1 }));
    const fn = vi.fn();
    store.subscribe(fn);
    fn.mockClear(); // clear immediate call

    // same value (Object.is) → no notify
    store.set({ tick: 1 });
    expect(fn).not.toHaveBeenCalled();

    // different tick → notify
    store.set({ tick: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ tick: 2 }));

    // NaN vs NaN Object.is true → no notify
    const s2 = createStore(makeSnapshot({ tick: NaN as unknown as number }));
    const fn2 = vi.fn();
    s2.subscribe(fn2);
    fn2.mockClear();
    s2.set({ tick: NaN as unknown as number });
    expect(fn2).not.toHaveBeenCalled();

    // -0 vs 0 Object.is false → should notify
    const s3 = createStore(makeSnapshot({ tick: 0 }));
    const fn3 = vi.fn();
    s3.subscribe(fn3);
    fn3.mockClear();
    s3.set({ tick: -0 });
    expect(fn3).toHaveBeenCalledTimes(1);
  });

  it('set patch with multiple keys — only changed keys trigger', () => {
    const store = createStore(makeSnapshot({ tick: 1, status: 'idle' }));
    const fn = vi.fn();
    store.subscribe(fn);
    fn.mockClear();
    store.set({ tick: 1, status: 'idle' });
    expect(fn).not.toHaveBeenCalled();
    store.set({ tick: 1, status: 'running' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(store.get().status).toBe('running');
  });

  it('pendingSnapshot reentrancy — listener calls set during notify', () => {
    const store = createStore(makeSnapshot({ tick: 0 }));
    const calls: number[] = [];
    const listener = vi.fn((s: DevStoreSnapshot) => {
      calls.push(s.tick);
      if (s.tick === 1) {
        // reentrant set during notify
        store.set({ tick: 2 });
      }
    });
    store.subscribe(listener);
    // immediate call with tick 0
    expect(calls).toEqual([0]);
    listener.mockClear();
    calls.length = 0;
    // trigger notify with tick 1 → should queue pending and notify again with tick 2
    store.set({ tick: 1 });
    // after set, listener should have been called for 1 and then for 2 (pending)
    expect(calls).toEqual([1, 2]);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.get().tick).toBe(2);
  });

  it('pending reentrancy with multiple listeners — second notify delivers latest pendingSnapshot', () => {
    const store = createStore(makeSnapshot({ tick: 0 }));
    const order: string[] = [];
    store.subscribe((s) => {
      order.push(`a:${s.tick}`);
      if (s.tick === 1) store.set({ tick: 2 });
    });
    store.subscribe((s) => {
      order.push(`b:${s.tick}`);
    });
    order.length = 0; // clear initial calls (2 listeners * 1 immediate)
    store.set({ tick: 1 });
    // first notify: a:1, b:1, then pending notify: a:2, b:2
    expect(order).toEqual(['a:1', 'b:1', 'a:2', 'b:2']);
  });

  it('notify try/catch per listener — one throws, others still called', () => {
    const store = createStore(makeSnapshot({ tick: 0 }));
    const good = vi.fn();
    const bad = vi.fn(() => {
      throw new Error('listener boom');
    });
    store.subscribe(bad);
    store.subscribe(good);
    bad.mockClear();
    good.mockClear();
    // set should not throw despite bad listener
    expect(() => store.set({ tick: 1 })).not.toThrow();
    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
  });

  it('subscribe immediate call and unsubscribe idempotent', () => {
    const store = createStore(makeSnapshot({ tick: 5 }));
    const fn = vi.fn();
    const unsub = store.subscribe(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ tick: 5 }));
    fn.mockClear();
    store.set({ tick: 6 });
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    fn.mockClear();
    store.set({ tick: 7 });
    expect(fn).not.toHaveBeenCalled();
    // idempotent
    expect(() => unsub()).not.toThrow();
    expect(() => unsub()).not.toThrow();
    // after unsub, no more calls
    fn.mockClear();
    store.set({ tick: 8 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('subscribe immediate call throws is caught', () => {
    const store = createStore(makeSnapshot({ tick: 0 }));
    const bad = vi.fn(() => {
      throw new Error('subscribe boom');
    });
    expect(() => store.subscribe(bad)).not.toThrow();
    expect(bad).toHaveBeenCalledTimes(1);
    // store still functional
    const good = vi.fn();
    const unsub = store.subscribe(good);
    good.mockClear();
    expect(() => store.set({ tick: 1 })).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('update(fn) delegates to set', () => {
    const store = createStore(makeSnapshot({ tick: 10 }));
    const fn = vi.fn();
    store.subscribe(fn);
    fn.mockClear();
    store.update((s) => ({ tick: s.tick + 1 }));
    expect(store.get().tick).toBe(11);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ tick: 11 }));
    // update returning same value -> no notify
    fn.mockClear();
    store.update(() => ({ tick: 11 }));
    expect(fn).not.toHaveBeenCalled();
    // update with status change
    store.update(() => ({ status: 'running' }));
    expect(store.get().status).toBe('running');
  });

  it('get returns current snapshot', () => {
    const store = createStore(makeSnapshot({ tick: 42, status: 'running' }));
    expect(store.get().tick).toBe(42);
    store.set({ tick: 100 });
    expect(store.get().tick).toBe(100);
  });
});

// env tests
describe('env — expandEnvVars', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('${VAR} expands when set, empty when unset', () => {
    process.env.TEST_VAR_A = 'hello';
    delete process.env.MISSING_VAR;
    expect(expandEnvVars('${TEST_VAR_A}')).toBe('hello');
    expect(expandEnvVars('${MISSING_VAR}')).toBe('');
    expect(expandEnvVars('prefix-${TEST_VAR_A}-suffix')).toBe('prefix-hello-suffix');
  });

  it('${VAR:-default} expands to default when unset or empty, otherwise value', () => {
    process.env.SET_VAR = 'real';
    process.env.EMPTY_VAR = '';
    delete process.env.UNSET_VAR;
    // unset => default
    expect(expandEnvVars('${UNSET_VAR:-fallback}')).toBe('fallback');
    // empty => default (code treats empty as missing for ${} form)
    expect(expandEnvVars('${EMPTY_VAR:-fallback}')).toBe('fallback');
    // set => value
    expect(expandEnvVars('${SET_VAR:-fallback}')).toBe('real');
    // empty default value
    expect(expandEnvVars('${UNSET_VAR:-}')).toBe('');
  });

  it('${VAR:default} (colon without dash) also falls back when empty', () => {
    process.env.EMPTY2 = '';
    delete process.env.UNSET2;
    process.env.SET2 = 'val';
    expect(expandEnvVars('${UNSET2:fb}')).toBe('fb');
    expect(expandEnvVars('${EMPTY2:fb}')).toBe('fb');
    expect(expandEnvVars('${SET2:fb}')).toBe('val');
  });

  it('${VAR-default} without colon does NOT expand and stays literal', () => {
    delete process.env.DASH_VAR;
    process.env.DASH_VAR = 'x';
    // Without colon, regex does not match, so literal preserved
    expect(expandEnvVars('${DASH_VAR-default}')).toBe('${DASH_VAR-default}');
    delete process.env.DASH_VAR;
    expect(expandEnvVars('${MISSING-default}')).toBe('${MISSING-default}');
  });

  it('$VAR expands, empty var returns empty string, unset returns empty', () => {
    process.env.SIMPLE = 'simpleVal';
    process.env.EMPTY_SIMPLE = '';
    delete process.env.MISSING_SIMPLE;
    expect(expandEnvVars('$SIMPLE')).toBe('simpleVal');
    expect(expandEnvVars('$MISSING_SIMPLE')).toBe('');
    // $VAR with empty env returns empty string (since undefined check, empty is still defined)
    // actually code: if envVal !== undefined return envVal (which is ""), so should be ""
    expect(expandEnvVars('$EMPTY_SIMPLE')).toBe('');
    expect(expandEnvVars('a $SIMPLE b')).toBe('a simpleVal b');
    // $VAR with empty string vs ${} difference: $EMPTY is "" not fallback
    expect(expandEnvVars('$EMPTY_SIMPLE')).toBe('');
  });

  it('non-string input returns input unchanged', () => {
    expect(expandEnvVars(123 as unknown as string)).toBe(123 as unknown as string);
    expect(expandEnvVars(null as unknown as string)).toBe(null as unknown as string);
    expect(expandEnvVars(undefined as unknown as string)).toBe(undefined as unknown as string);
    // number object
    const num = 0 as unknown as string;
    expect(expandEnvVars(num)).toBe(num);
  });

  it('mixed ${} and $VAR in same string', () => {
    process.env.MIX_A = 'A';
    process.env.MIX_B = 'B';
    delete process.env.MIX_MISSING;
    expect(expandEnvVars('${MIX_A}-$MIX_B-${MIX_MISSING:-def}')).toBe('A-B-def');
  });
});

describe('env — expandObject', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('recursion: string, array, object, null', () => {
    process.env.EO_VAR = 'world';
    // string
    expect(expandObject('hello ${EO_VAR}')).toBe('hello world');
    // array
    expect(expandObject(['a', '${EO_VAR}', '$EO_VAR'])).toEqual(['a', 'world', 'world']);
    // object
    expect(expandObject({ key: '${EO_VAR}', nested: { inner: '$EO_VAR' } })).toEqual({
      key: 'world',
      nested: { inner: 'world' },
    });
    // null returns null
    expect(expandObject(null)).toBeNull();
    // undefined returns undefined
    expect(expandObject(undefined)).toBeUndefined();
    // number returns same
    expect(expandObject(42)).toBe(42);
    // boolean returns same
    expect(expandObject(true)).toBe(true);
  });

  it('expandObject deep array/object mixing', () => {
    process.env.DEEP = 'deepVal';
    const input = {
      a: ['${DEEP}', { b: '$DEEP', c: 123, d: null }],
      e: { f: ['x', '${DEEP}'] },
    };
    expect(expandObject(input)).toEqual({
      a: ['deepVal', { b: 'deepVal', c: 123, d: null }],
      e: { f: ['x', 'deepVal'] },
    });
  });

  it('expandObject preserves numbers and booleans inside', () => {
    expect(expandObject({ n: 0, b: false, s: 'hi' } as unknown)).toEqual({ n: 0, b: false, s: 'hi' });
  });
});

describe('env — loadDotEnv', () => {
  const originalEnv = { ...process.env };
  let existsSyncSpy: ReturnType<typeof vi.spyOn>;
  let readFileSyncSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    existsSyncSpy = vi.spyOn(fs, 'existsSync');
    readFileSyncSpy = vi.spyOn(fs, 'readFileSync');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // restore env
    for (const k of Object.keys(process.env)) {
      if (!(k in originalEnv)) delete process.env[k];
    }
    for (const [k, v] of Object.entries(originalEnv)) {
      process.env[k] = v;
    }
  });

  it('missing file no throw (existsSync false)', () => {
    existsSyncSpy.mockReturnValue(false);
    expect(() => loadDotEnv('/fake/project')).not.toThrow();
    expect(readFileSyncSpy).not.toHaveBeenCalled();
  });

  it('parsing trim, # skip, quote stripping, only sets if undefined', () => {
    existsSyncSpy.mockReturnValue(true);
    const content = `
# this is a comment
  KEY1=value1
KEY2 = "value with spaces"
KEY3='single quoted'
  # indented comment
KEY4=  spaced
KEY_NO_EQUALS
EMPTY=

`;
    readFileSyncSpy.mockReturnValue(content);
    // pre-set KEY1 to test only sets if undefined
    process.env.KEY1 = 'existing';
    delete process.env.KEY2;
    delete process.env.KEY3;
    delete process.env.KEY4;
    delete process.env.EMPTY;

    loadDotEnv('/fake/project');

    expect(process.env.KEY1).toBe('existing'); // not overwritten
    expect(process.env.KEY2).toBe('value with spaces'); // quotes stripped
    expect(process.env.KEY3).toBe('single quoted');
    expect(process.env.KEY4).toBe('spaced');
    expect(process.env.EMPTY).toBe(''); // empty value preserved
    // KEY_NO_EQUALS should be ignored (no =)
    expect(process.env.KEY_NO_EQUALS).toBeUndefined();
  });

  it('only sets if process.env undefined, does not overwrite existing', () => {
    existsSyncSpy.mockReturnValue(true);
    readFileSyncSpy.mockReturnValue('OVERWRITE=fromFile');
    process.env.OVERWRITE = 'original';
    loadDotEnv('/proj');
    expect(process.env.OVERWRITE).toBe('original');
    delete process.env.OVERWRITE;
    loadDotEnv('/proj');
    expect(process.env.OVERWRITE).toBe('fromFile');
  });

  it('readFileSync throws — not throw, debug logged', () => {
    existsSyncSpy.mockReturnValue(true);
    readFileSyncSpy.mockImplementation(() => {
      throw new Error('read fail');
    });
    expect(() => loadDotEnv('/proj')).not.toThrow();
  });

  it('handles value with = inside and trims key/value', () => {
    existsSyncSpy.mockReturnValue(true);
    readFileSyncSpy.mockReturnValue('URL=https://example.com?a=b&c=d');
    delete process.env.URL;
    loadDotEnv('/proj');
    expect(process.env.URL).toBe('https://example.com?a=b&c=d');
  });

  it('uses path.join to build env path', () => {
    existsSyncSpy.mockReturnValue(false);
    loadDotEnv('/my/project');
    expect(existsSyncSpy).toHaveBeenCalledWith(path.join('/my/project', '.env'));
  });
});

// browser tests
describe('browser — openBrowser', () => {
  let originalPlatform: string;

  beforeEach(() => {
    originalPlatform = process.platform;
    mockSpawn.mockClear();
    // default success child
    mockSpawn.mockReturnValue({ on: vi.fn(), unref: vi.fn() } as unknown as ReturnType<typeof import('node:child_process').spawn>);
  });

  afterEach(() => {
    mockSpawn.mockReset();
    mockSpawn.mockReturnValue({ on: vi.fn(), unref: vi.fn() } as unknown as ReturnType<typeof import('node:child_process').spawn>);
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('invalid URL returns without spawn', () => {
    openBrowser('not-a-url');
    expect(mockSpawn).not.toHaveBeenCalled();
    openBrowser('');
    expect(mockSpawn).not.toHaveBeenCalled();
    openBrowser('://bad');
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('javascript: and file: blocked', () => {
    openBrowser('javascript:alert(1)');
    expect(mockSpawn).not.toHaveBeenCalled();
    openBrowser('file:///etc/passwd');
    expect(mockSpawn).not.toHaveBeenCalled();
    openBrowser('ftp://example.com');
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('win32 branching via process.platform mock, spawn detached stdio ignore', () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    const mockChild = { on: vi.fn(), unref: vi.fn() } as unknown as { on: ReturnType<typeof vi.fn>; unref: ReturnType<typeof vi.fn> };
    mockSpawn.mockReturnValue(mockChild as unknown as ReturnType<typeof import('node:child_process').spawn>);
    openBrowser('https://example.com');
    expect(mockSpawn).toHaveBeenCalledWith('rundll32', ['url.dll,FileProtocolHandler', 'https://example.com'], {
      stdio: 'ignore',
      detached: true,
    });
    expect(mockChild.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockChild.unref).toHaveBeenCalled();
  });

  it('darwin branching uses open', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    const mockChild = { on: vi.fn(), unref: vi.fn() } as unknown as { on: ReturnType<typeof vi.fn>; unref: ReturnType<typeof vi.fn> };
    mockSpawn.mockReturnValue(mockChild as unknown as ReturnType<typeof import('node:child_process').spawn>);
    openBrowser('https://example.com/path?q=1');
    expect(mockSpawn).toHaveBeenCalledWith('open', ['https://example.com/path?q=1'], {
      stdio: 'ignore',
      detached: true,
    });
    expect(mockChild.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockChild.unref).toHaveBeenCalled();
  });

  it('linux branching uses xdg-open', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    const mockChild = { on: vi.fn(), unref: vi.fn() } as unknown as { on: ReturnType<typeof vi.fn>; unref: ReturnType<typeof vi.fn> };
    mockSpawn.mockReturnValue(mockChild as unknown as ReturnType<typeof import('node:child_process').spawn>);
    openBrowser('https://example.com');
    expect(mockSpawn).toHaveBeenCalledWith('xdg-open', ['https://example.com'], {
      stdio: 'ignore',
      detached: true,
    });
    expect(mockChild.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockChild.unref).toHaveBeenCalled();
  });

  it('spawn throws not throw (best-effort)', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    mockSpawn.mockImplementation(() => {
      throw new Error('spawn failed');
    });
    expect(() => openBrowser('https://example.com')).not.toThrow();
  });

  it('win32 spawn throws not throw', () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    mockSpawn.mockImplementation(() => {
      throw new Error('win spawn failed');
    });
    expect(() => openBrowser('https://example.com')).not.toThrow();
  });
});
