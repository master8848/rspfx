import { EnvironmentType } from '@mbsks/rspfx-core';
import type { WebPartContextLike } from '@mbsks/rspfx-core';
import { RspfxError } from '@mbsks/rspfx-diagnostics';

export const PLAYGROUND_SERVICE_KEY = '__rspfx_playground__';

export function createMockWebPartContext(
  manifest: unknown,
  overrides?: Record<string, unknown>
): WebPartContextLike {
  const instanceId = crypto.randomUUID();
  const preconfiguredEntries = (
    manifest as { preconfiguredEntries?: { properties?: Record<string, unknown> }[] } | undefined
  )?.preconfiguredEntries;
  const context: WebPartContextLike = {
    instanceId,
    webPartTag: `MockWebPart.${instanceId}`,
    domElement: document.createElement('div'),
    properties: preconfiguredEntries?.[0]?.properties ?? {},
    environment: { type: EnvironmentType.Local },
    pageContext: {
      web: { title: 'Local Workbench', absoluteUrl: 'http://localhost:3000' },
      site: { absoluteUrl: 'http://localhost:3000' }
    },
    propertyPane: {},
    themeProvider: undefined
  };
  return overrides ? { ...context, ...overrides } : context;
}

export function createPlaygroundLoader(
  mountComponent: (root: HTMLElement) => void,
  unmountComponent?: (root: HTMLElement) => void
): { mount(root: HTMLElement): void; unmount(): void } {
  let mountedRoot: HTMLElement | undefined;
  return {
    mount(root: HTMLElement): void {
      mountedRoot = root;
      mountComponent(root);
    },
    unmount(): void {
      if (unmountComponent && mountedRoot) {
        unmountComponent(mountedRoot);
      }
    }
  };
}
