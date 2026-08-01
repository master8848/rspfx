import type { FrameworkId } from '@mbsks/rspfx-core';

export interface RefreshRuntime {
  dispose(): void;
  preserveState(): void;
  restoreState(): void;
}

const noop = (): void => undefined;

export function createRefreshRuntime(_framework: FrameworkId): RefreshRuntime {
  return {
    dispose: noop,
    preserveState: noop,
    restoreState: noop
  };
}
