import type { FrameworkId } from '@mbsks/rspfx-core';

export interface RefreshRuntimeOptions {
  onPreserve?: () => void;
  onRestore?: () => void;
}

export interface RefreshRuntime {
  dispose(): void;
  preserveState(): void;
  restoreState(): void;
  readonly preserved: boolean;
  readonly disposed: boolean;
  readonly epoch: number;
}

export function createRefreshRuntime(
  _framework: FrameworkId,
  options: RefreshRuntimeOptions = {}
): RefreshRuntime {
  let preserved = false;
  let disposed = false;
  let epoch = 0;
  return {
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      preserved = false;
    },
    preserveState(): void {
      if (disposed) {
        return;
      }
      preserved = true;
      options.onPreserve?.();
    },
    restoreState(): void {
      if (disposed) {
        return;
      }
      preserved = false;
      epoch += 1;
      options.onRestore?.();
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
