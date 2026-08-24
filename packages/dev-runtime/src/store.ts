import type { FrameworkId } from '@mbsks/rspfx-core';
import type { RspfxError } from '@mbsks/rspfx-diagnostics';
import type { ServeMode } from './serve.js';

export type DevStatus = 'idle' | 'starting' | 'running' | 'restarting' | 'closed';

export interface DevStoreSnapshot {
  readonly mode: ServeMode;
  readonly origin: string;
  readonly tick: number;
  readonly status: DevStatus;
  readonly error?: RspfxError;
  readonly fingerprint?: string;
  readonly framework?: FrameworkId;
  readonly fastRefresh: boolean;
  readonly devtools?: boolean;
}

export interface DevStore {
  get(): DevStoreSnapshot;
  set(patch: Partial<DevStoreSnapshot>): void;
  update(fn: (s: DevStoreSnapshot) => Partial<DevStoreSnapshot>): void;
  subscribe(listener: (s: DevStoreSnapshot) => void): () => void;
}

export function createStore(initial: DevStoreSnapshot): DevStore {
  let snapshot: DevStoreSnapshot = { ...initial };
  const listeners = new Set<(s: DevStoreSnapshot) => void>();
  let notifying = false;
  let pending = false;
  let pendingSnapshot: DevStoreSnapshot | null = null;

  const notify = (): void => {
    if (notifying) {
      pending = true;
      return;
    }
    notifying = true;
    const current = snapshot;
    for (const l of [...listeners]) {
      try {
        l(current);
      } catch {}
    }
    notifying = false;
    if (pending) {
      pending = false;
      const next = pendingSnapshot;
      pendingSnapshot = null;
      if (next && next !== snapshot) {
        // if batch during notify, re-notify if snapshot changed
        // snapshot already updated, just notify again
        notify();
      }
    }
  };

  const set = (patch: Partial<DevStoreSnapshot>): void => {
    let changed = false;
    const next: DevStoreSnapshot = { ...snapshot } as DevStoreSnapshot;
    for (const [k, v] of Object.entries(patch) as [keyof DevStoreSnapshot, unknown][]) {
      if (!Object.is((snapshot as unknown as Record<string, unknown>)[k as string], v)) {
        (next as unknown as Record<string, unknown>)[k as string] = v;
        changed = true;
      }
    }
    if (!changed) return;
    snapshot = next;
    if (notifying) {
      pendingSnapshot = snapshot;
      pending = true;
      return;
    }
    notify();
  };

  return {
    get(): DevStoreSnapshot {
      return snapshot;
    },
    set,
    update(fn: (s: DevStoreSnapshot) => Partial<DevStoreSnapshot>): void {
      const patch = fn(snapshot);
      set(patch);
    },
    subscribe(listener: (s: DevStoreSnapshot) => void): () => void {
      listeners.add(listener);
      // Svelte-store shape: immediately call with current? spec says subscribe gets initial.
      // We'll not call immediately to match usual Svelte? But spec says "subscribe gets initial" test.
      // Let's call immediately.
      try {
        listener(snapshot);
      } catch {}
      let unsubscribed = false;
      return () => {
        if (unsubscribed) return;
        unsubscribed = true;
        listeners.delete(listener);
      };
    }
  };
}
