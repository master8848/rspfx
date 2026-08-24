export { RspfxErrorCode } from './codes.js';
import { RspfxErrorCode } from './codes.js';

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

export class AggregateRspfxError extends Error {
  readonly code = RspfxErrorCode.AGGREGATE as RspfxErrorCode;
  readonly errors: readonly RspfxError[];

  constructor(errors: readonly RspfxError[], message = `${errors.length} hook errors`) {
    super(message);
    this.name = 'AggregateRspfxError';
    this.errors = errors;
  }
}

export function isRspfxError(e: unknown): e is RspfxError | AggregateRspfxError {
  return e instanceof RspfxError || e instanceof AggregateRspfxError || (typeof e === 'object' && e !== null && 'code' in e);
}

export function isAggregateRspfxError(e: unknown): e is AggregateRspfxError {
  return e instanceof AggregateRspfxError;
}

export function flatCauseChain(err: RspfxError): RspfxError[] {
  const chain: RspfxError[] = [];
  let current: RspfxError | Error | undefined = err;
  while (current) {
    if (current instanceof RspfxError) {
      chain.push(current);
      current = current.cause as RspfxError | Error | undefined;
    } else if (current instanceof Error && 'cause' in current && current.cause instanceof Error) {
      const cause = (current as { cause?: unknown }).cause;
      if (cause instanceof RspfxError) {
        chain.push(cause);
        current = (cause as RspfxError).cause as RspfxError | Error | undefined;
      } else if (cause instanceof Error) {
        current = cause;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return chain;
}
