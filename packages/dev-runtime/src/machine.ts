import type { RspfxError } from '@mbsks/rspfx-diagnostics';
import type { DevStore, DevStoreSnapshot, DevStatus } from './store.js';

export type DevEvent =
  | { type: 'START'; port?: number }
  | { type: 'DEPENDENCY_CHANGED'; fingerprint: string }
  | { type: 'BUILD_DONE'; stats?: unknown }
  | { type: 'ERROR'; error: RspfxError }
  | { type: 'CLOSE' };

export interface DevState {
  value: DevStatus;
  context: DevStoreSnapshot;
}

export interface DevMachine {
  getState(): DevState;
  send(ev: DevEvent): void;
  subscribe(l: (s: DevState) => void): () => void;
  dispose(): void;
}

interface MachineOpts {
  startOnce: (port?: number) => Promise<{ port: number; close(): Promise<void> }>;
  fingerprintOf: () => string;
  logger?: { info(msg: string): void; error(msg: string): void; success(msg: string): void };
}

export function createDevMachine(store: DevStore, opts: MachineOpts): DevMachine {
  const listeners = new Set<(s: DevState) => void>();
  let pendingFingerprint: string | undefined;
  let restarting = false;
  let closing = false;
  let watcherStarted = false;

  const getState = (): DevState => ({
    value: store.get().status,
    context: store.get()
  });

  const notify = (): void => {
    const state = getState();
    for (const l of [...listeners]) {
      try {
        l(state);
      } catch {}
    }
  };

  // Subscribe to store changes to propagate state
  const unsubStore = store.subscribe(() => {
    notify();
  });

  const drainRestarts = async (): Promise<void> => {
    if (restarting || closing) return;
    while (pendingFingerprint !== undefined) {
      restarting = true;
      const fingerprint = pendingFingerprint;
      pendingFingerprint = undefined;
      store.set({ status: 'restarting', fingerprint });
      const currentOrigin = store.get().origin;
      // extract port from origin
      let port: number | undefined;
      try {
        port = Number(new URL(currentOrigin).port);
      } catch {
        port = undefined;
      }
      opts.logger?.info('Dependency scope changed — restarting dev server with updated externals.');
      try {
        // We delegate close/start to the store's holder via startOnce;
        // The caller (serve.ts) keeps server reference; here we just call startOnce.
        // To allow proper close, we expect serve.ts to have closed previous server before calling drain?
        // Instead, machine manages restart: close previous via external? For testability, just call startOnce.
        const next = await opts.startOnce(port);
        if (closing) {
          await next.close();
          store.set({ status: 'closed' });
          restarting = false;
          return;
        }
        // update origin after restart
        try {
          const originUrl = new URL(store.get().origin);
          originUrl.port = String(next.port);
          store.set({ origin: originUrl.toString(), status: 'running' });
        } catch {
          store.set({ status: 'running' });
        }
        opts.logger?.success(`Dev server restarted at ${store.get().origin}.`);
        const current = opts.fingerprintOf();
        if (current !== fingerprint) {
          pendingFingerprint = current;
        }
      } catch (error) {
        opts.logger?.error(
          `Failed to restart dev server: ${error instanceof Error ? error.message : String(error)}. It will retry on the next dependency change.`
        );
      } finally {
        restarting = false;
      }
    }
  };

  const send = (ev: DevEvent): void => {
    switch (ev.type) {
      case 'START': {
        if (closing) return;
        store.set({ status: 'starting' });
        // async start
        void opts
          .startOnce(ev.port)
          .then((result) => {
            if (closing) {
              void result.close();
              return;
            }
            try {
              const originUrl = new URL(store.get().origin);
              originUrl.port = String(result.port);
              store.set({ origin: originUrl.toString(), status: 'running' });
            } catch {
              store.set({ status: 'running' });
            }
          })
          .catch((error: unknown) => {
            const err = error instanceof Error ? error : new Error(String(error));
            store.set({ status: 'idle', error: err as unknown as RspfxError });
            opts.logger?.error(`Failed to start dev server: ${err.message}`);
          });
        break;
      }
      case 'DEPENDENCY_CHANGED': {
        if (closing) return;
        pendingFingerprint = ev.fingerprint;
        store.set({ fingerprint: ev.fingerprint });
        void drainRestarts();
        break;
      }
      case 'BUILD_DONE': {
        store.update((s) => ({ tick: s.tick + 1 }));
        break;
      }
      case 'ERROR': {
        store.set({ error: ev.error, status: 'idle' });
        break;
      }
      case 'CLOSE': {
        closing = true;
        store.set({ status: 'closed' });
        break;
      }
      default: {
        const _exhaustive: never = ev as never;
        void _exhaustive;
      }
    }
  };

  return {
    getState,
    send,
    subscribe(l: (s: DevState) => void): () => void {
      listeners.add(l);
      try {
        l(getState());
      } catch {}
      let unsubscribed = false;
      return () => {
        if (unsubscribed) return;
        unsubscribed = true;
        listeners.delete(l);
      };
    },
    dispose(): void {
      closing = true;
      unsubStore();
      listeners.clear();
    }
  };
}
