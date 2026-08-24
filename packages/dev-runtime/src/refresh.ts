import type { FrameworkId } from '@mbsks/rspfx-core';
import type { DevStore } from './store.js';

export interface RefreshRuntimeOptions {
  store?: DevStore;
  onPreserve?: () => void;
  onRestore?: () => void;
  onAckHmr?: (framework: FrameworkId) => void;
}

export interface RefreshRuntime {
  dispose(): void;
  preserveState(): void;
  restoreState(): void;
  ackHmr(): void;
  readonly preserved: boolean;
  readonly disposed: boolean;
  readonly epoch: number;
}

export function createRefreshRuntime(
  framework: FrameworkId,
  options: RefreshRuntimeOptions = {}
): RefreshRuntime {
  let preserved = false;
  let disposed = false;
  let epoch = 0;
  let unsubscribe: (() => void) | undefined;

  if (options.store) {
    // subscribe to tick changes if needed — track epoch preservation
    // store may trigger tick increments; we don't auto preserve here,
    // but we keep subscription to allow future ack logic.
    unsubscribe = options.store.subscribe(() => {
      // no-op: placeholder to keep store linkage; prevents uncaptured ticks
      // actual suppress logic is handled by serve.ts via refreshRuntime.preserved guard
    });
  }

  const isPreservableFramework = framework !== 'vanilla';

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      preserved = false;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = undefined;
      }
    },
    preserveState(): void {
      if (disposed) return;
      preserved = true;
      options.onPreserve?.();
      // framework-specific branching placeholder
      switch (framework) {
        case 'solid':
          // solid signal preservation no dispose
          break;
        case 'svelte':
          // svelte $set preservation
          break;
        case 'react':
        case 'preact':
        case 'vue':
          // react-refresh ack path
          break;
        default:
          break;
      }
    },
    restoreState(): void {
      if (disposed) return;
      preserved = false;
      epoch += 1;
      options.onRestore?.();
    },
    ackHmr(): void {
      if (disposed) return;
      preserved = false;
      options.onAckHmr?.(framework);
    },
    get preserved(): boolean {
      return preserved;
    },
    get disposed(): boolean {
      return disposed;
    },
    get epoch(): number {
      return epoch;
    }
  };
}
