import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../src/index.js';
import type { LogEntry } from '../src/index.js';

describe('createLogger', () => {
  beforeEach(() => {
    delete process.env.RSPFX_LOG_LEVEL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.RSPFX_LOG_LEVEL;
  });

  it('writes info lines to stdout with a level prefix and color', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    createLogger('cli').info('hello');
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('[cli] info: hello'));
    const line = stdout.mock.calls[0]![0] as string;
    expect(line).toContain('\x1b[');
    expect(line).toContain('\x1b[0m');
    expect(line).toMatch(/\n$/);
  });

  it('writes success lines in green', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    createLogger('cli').success('done');
    const line = stdout.mock.calls[0]![0] as string;
    expect(line).toContain('\x1b[32m');
    expect(line).toContain('[cli] success: done');
    expect(line).toContain('\x1b[0m');
  });

  it('writes errors and warnings to stderr', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = createLogger('cli');
    logger.error('oops');
    logger.warn('careful');
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('[cli] error: oops'));
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('[cli] warn: careful'));
  });

  it('respects RSPFX_LOG_LEVEL and filters lower-priority levels', () => {
    process.env.RSPFX_LOG_LEVEL = 'error';
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = createLogger('cli');
    logger.debug('hidden');
    logger.info('hidden');
    logger.warn('hidden');
    logger.success('hidden');
    logger.error('visible');
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalledWith(expect.stringContaining('hidden'));
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('visible'));
  });

  it('defaults to info when RSPFX_LOG_LEVEL is unset', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = createLogger('cli');
    logger.debug('hidden-by-default');
    expect(stdout).not.toHaveBeenCalled();
    logger.info('shown');
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('[cli] info: shown'));
  });

  it('treats unknown RSPFX_LOG_LEVEL values as info', () => {
    process.env.RSPFX_LOG_LEVEL = 'nonsense';
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    createLogger('cli').success('still-visible');
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('still-visible'));
  });

  it('isLevelEnabled reflects current level', () => {
    const logger = createLogger('test');
    expect(logger.isLevelEnabled('debug')).toBe(false);
    expect(logger.isLevelEnabled('info')).toBe(true);
    expect(logger.isLevelEnabled('error')).toBe(true);
    process.env.RSPFX_LOG_LEVEL = 'debug';
    const debugLogger = createLogger('test2');
    expect(debugLogger.isLevelEnabled('debug')).toBe(true);
    expect(debugLogger.isLevelEnabled('trace')).toBe(false);
    process.env.RSPFX_LOG_LEVEL = 'trace';
    const traceLogger = createLogger('test3');
    expect(traceLogger.isLevelEnabled('trace')).toBe(true);
    delete process.env.RSPFX_LOG_LEVEL;
  });

  it('child merges fields', () => {
    const entries: LogEntry[] = [];
    const logger = createLogger('test', { sinks: [(e) => entries.push(e)] });
    const child = logger.child({ plugin: 'x' });
    child.info('hello', { phase: 'beforeCompile' });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.fields).toEqual({ plugin: 'x', phase: 'beforeCompile' });
    expect(entries[0]!.message).toBe('hello');
  });

  it('child merges with existing fields and call fields', () => {
    const entries: LogEntry[] = [];
    const logger = createLogger('test', { sinks: [(e) => entries.push(e)] });
    const child = logger.child({ plugin: 'x' }).child({ phase: 'beforePackage' });
    child.info('msg', { extra: '1' });
    expect(entries[0]!.fields).toEqual({ plugin: 'x', phase: 'beforePackage', extra: '1' });
  });

  it('RSPFX_LOG_JSON=1 emits JSON with timestamp and fields via sinks', () => {
    const entries: LogEntry[] = [];
    // Use sinks to avoid stdout, but also test json flag via opts
    const jsonLogger = createLogger('json-test', { json: true, sinks: [(e) => entries.push(e)] });
    jsonLogger.info('json-msg', { durationMs: 123, framework: 'react' });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe('info');
    expect(entries[0]!.name).toBe('json-test');
    expect(entries[0]!.message).toBe('json-msg');
    expect(entries[0]!.fields).toEqual({ durationMs: 123, framework: 'react' });
    expect(typeof entries[0]!.timestamp).toBe('string');
    // Also test that json mode via env actually writes JSON to stdout
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    process.env.RSPFX_LOG_JSON = '1';
    const envJsonLogger = createLogger('env-json');
    envJsonLogger.info('env-json-msg', { a: '1' });
    expect(stdout).toHaveBeenCalled();
    const line = stdout.mock.calls[0]![0] as string;
    expect(line.trim().startsWith('{')).toBe(true);
    const parsed = JSON.parse(line.trim()) as { level: string; name: string; message: string; fields: Record<string, unknown>; timestamp: string };
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('env-json-msg');
    expect(parsed.fields).toEqual({ a: '1' });
    expect(typeof parsed.timestamp).toBe('string');
    delete process.env.RSPFX_LOG_JSON;
  });

  it('success rank 2 not filtered at default, debug filtered unless debug', () => {
    const entries: LogEntry[] = [];
    const logger = createLogger('test', { sinks: [(e) => entries.push(e)] });
    logger.success('visible');
    logger.debug('hidden');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe('success');
    entries.length = 0;
    process.env.RSPFX_LOG_LEVEL = 'debug';
    const debugLogger = createLogger('test2', { sinks: [(e) => entries.push(e)] });
    debugLogger.debug('now-visible');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe('debug');
    delete process.env.RSPFX_LOG_LEVEL;
  });

  it('withLevel creates a logger with overridden level', () => {
    const entries: LogEntry[] = [];
    const logger = createLogger('test', { sinks: [(e) => entries.push(e)] });
    const debugLogger = logger.withLevel('debug');
    expect(debugLogger.isLevelEnabled('debug')).toBe(true);
    expect(logger.isLevelEnabled('debug')).toBe(false);
    debugLogger.debug('visible');
    expect(entries).toHaveLength(1);
  });

  it('trace level is gated above debug', () => {
    const entries: LogEntry[] = [];
    const logger = createLogger('test', { sinks: [(e) => entries.push(e)] });
    logger.trace('hidden-trace');
    expect(entries).toHaveLength(0);
    const traceLogger = createLogger('test', { level: 'trace', sinks: [(e) => entries.push(e)] });
    traceLogger.trace('visible-trace');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe('trace');
  });
});
