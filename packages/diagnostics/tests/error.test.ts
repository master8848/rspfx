import { describe, expect, it } from 'vitest';
import { RspfxError } from '../src/index.js';

describe('RspfxError', () => {
  it('exposes code, message, name and cause', () => {
    const cause = new Error('root cause');
    const error = new RspfxError('E_BUILD_FAILED', 'build failed', cause);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RspfxError);
    expect(error.code).toBe('E_BUILD_FAILED');
    expect(error.message).toBe('build failed');
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('RspfxError');
    expect(error.stack).toContain('RspfxError: build failed');
  });

  it('omits cause when not provided', () => {
    const error = new RspfxError('E_MISSING_CAUSE', 'boom');
    expect(error.code).toBe('E_MISSING_CAUSE');
    expect(error.cause).toBeUndefined();
  });
});
