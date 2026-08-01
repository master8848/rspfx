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
  webpartModule: unknown,
  adapter?: { mount(root: HTMLElement, component: unknown): void; unmount(root: HTMLElement): void }
): { mount(root: HTMLElement): void; unmount(): void } {
  const component = (webpartModule as { default?: unknown } | undefined)?.default ?? webpartModule;
  let mountedRoot: HTMLElement | undefined;
  return {
    mount(root: HTMLElement): void {
      if (!adapter) {
        throw new RspfxError(
          'PLAYGROUND_ADAPTER_REQUIRED',
          'The playground loader needs a framework adapter to mount the web part component.'
        );
      }
      mountedRoot = root;
      adapter.mount(root, component);
    },
    unmount(): void {
      if (adapter && mountedRoot) {
        adapter.unmount(mountedRoot);
      }
    }
  };
}
