import { describe, expect, it } from 'vitest';
import { RspfxError } from '../src/index.js';

describe('RspfxError', () => {
  it('exposes code, message, name and cause', () => {
    const cause = new Error('root cause');
    const error = new RspfxError('BUILD_FAILED', 'build failed', cause);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RspfxError);
    expect(error.code).toBe('BUILD_FAILED');
    expect(error.message).toBe('build failed');
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('RspfxError');
    expect(error.stack).toContain('RspfxError: build failed');
  });

  it('omits cause when not provided', () => {
    const error = new RspfxError('INVALID_OPTION', 'boom');
    expect(error.code).toBe('INVALID_OPTION');
    expect(error.cause).toBeUndefined();
  });
});
