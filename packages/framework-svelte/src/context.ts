import { getContext, setContext } from 'svelte';

export const RSPFX_CONTEXT_KEY = 'rspfx:context' as const;

export function setSpfxContext(ctx: unknown): void {
  setContext(RSPFX_CONTEXT_KEY, ctx);
}

export function getSpfxContext<T = unknown>(): T {
  return getContext<T>(RSPFX_CONTEXT_KEY);
}
