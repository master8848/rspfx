import type { RspfxErrorCode } from './codes.js';

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function map<T, U, E>(r: Result<T, E>, fn: (t: T) => U): Result<U, E> {
  return r.ok ? ok(fn(r.value)) : r;
}

export function andThen<T, U, E>(r: Result<T, E>, fn: (t: T) => Result<U, E>): Result<U, E> {
  return r.ok ? fn(r.value) : r;
}

export function unwrap<T, E>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw r.error;
}

export type Issue = { path: (string | number)[]; message: string; code: RspfxErrorCode };

export type HookResult<T> = Result<T, Error>;
