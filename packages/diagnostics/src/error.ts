export { RspfxErrorCode } from './codes.js';

export class RspfxError extends Error {
  readonly code: string;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'RspfxError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
