import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../src/index.js';

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
});
