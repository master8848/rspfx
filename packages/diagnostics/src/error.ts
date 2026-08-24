export { RspfxErrorCode } from './codes.js';
import type { RspfxErrorCode } from './codes.js';

export class RspfxError extends Error {
  readonly code: RspfxErrorCode;
  declare cause?: RspfxError | Error;

  constructor(code: RspfxErrorCode, message: string, cause?: RspfxError | Error);
  /** @deprecated use RspfxErrorCode constant */
  constructor(code: string, message: string, cause?: unknown);
  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'RspfxError';
    this.code = code as RspfxErrorCode;
    if (cause !== undefined) {
      (this as { cause?: RspfxError | Error }).cause = cause as RspfxError | Error;
    }
  }
}

export function isRspfxError(e: unknown): e is RspfxError {
  return e instanceof RspfxError;
}
