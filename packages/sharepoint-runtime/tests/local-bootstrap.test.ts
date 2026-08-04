// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WebPartContextLike } from '@mbsks/rspfx-core';
import { resolveLocale } from '../src/locales.js';
import type { LocalMountSeams } from '../src/local-bootstrap.js';

const fakeWebPartContext = (async (): Promise<WebPartContextLike> => ({} as unknown as WebPartContextLike));

// boot() runs at import; give it a host element so it stays quiet.
document.body.innerHTML = '<div id="__rspfx_host"></div>';

interface FakeScript {
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
}

/**
 * Simulates script loading: `document.createElement('script')` returns a fake,
 * and appending it to <head> executes the registered body (which may call
 * window.define) and then fires load/error.
 */
function installScriptLoader(
  bodies: Record<string, () => void>,
  failures: string[] = []
): { loaded: string[] } {
  const loaded: string[] = [];
  const realCreateElement = document.createElement.bind(document);
  const realAppendChild = document.head.appendChild.bind(document.head);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'script') {
      return realCreateElement(tag);
    }
    const fake: FakeScript = { src: '', onload: null, onerror: null };
    return fake as unknown as HTMLScriptElement;
  });
  vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
    const script = node as unknown as FakeScript;
    if (typeof script.onload !== 'function') {
      return realAppendChild(node);
    }
    loaded.push(script.src);
    bodies[script.src]?.();
    if (failures.includes(script.src)) {
      script.onerror?.();
    } else {
      script.onload();
    }
    return node;
  });
  return { loaded };
}

function mountCard(id: string): { root: HTMLElement; status: HTMLElement } {
  const card = document.createElement('article');
  card.id = `rspfx-wp-${id}`;
  const header = document.createElement('header');
  const status = document.createElement('span');
  status.className = 'rspfx-wp-status';
  header.appendChild(status);
  card.appendChild(header);
  const root = document.createElement('div');
  root.className = 'rspfx-wp-root';
  card.appendChild(root);
  document.body.appendChild(card);
  return { root, status };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '<div id="__rspfx_host"></div>';
});

describe('local-bootstrap anonymous define + locale resources', () => {
  it('registers an anonymous locale define under the resource name before the bundle runs', async () => {
    const captured: unknown[] = [];
    installScriptLoader({
      '/dist/TestStrings_fr-fr.js': () => {
        (window as unknown as { define(id: string | undefined, deps: string[], factory: unknown): void }).define(
          undefined,
          [],
          () => ({ hello: 'bonjour' })
        );
      },
      '/dist/testwp.js': () => {
        (window as unknown as { define(id: string | undefined, deps: string[], factory: unknown): void }).define(
          'wp-id_1.0.0',
          ['TestStrings'],
          (strings: unknown) => ({
            default: class FakeWebPart {
              public constructor() {
                captured.push(strings);
              }
              public _internalInitialize(): void {}
              public _internalDeserialize(): void {}
              public render(): void {}
            }
          })
        );
      }
    });

    const { status } = mountCard('wp-id');
    const { mountOne } = await import('../src/local-bootstrap.js');
    await mountOne(
      {
        id: 'wp-id',
        alias: 'FakeWebPart',
        bundleName: 'testwp',
        amdId: 'wp-id_1.0.0',
        localizedResources: ['TestStrings'],
        preconfiguredEntries: [{ properties: {} }]
      },
      resolveLocale('fr-fr'),
      { createWebPartContext: fakeWebPartContext }
    );

    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual({ hello: 'bonjour' });
    expect(status.textContent).toBe('ready');
    expect(status.classList.contains('rspfx-wp-ready')).toBe(true);
  });

  it('falls back to the en-us locale file when the exact locale 404s', async () => {
    const captured: unknown[] = [];
    installScriptLoader(
      {
        '/dist/TestStrings_en-us.js': () => {
          (window as unknown as { define(id: string | undefined, deps: string[], factory: unknown): void }).define(
            undefined,
            [],
            () => ({ hello: 'hello' })
          );
        },
        '/dist/testwp.js': () => {
          (window as unknown as { define(id: string | undefined, deps: string[], factory: unknown): void }).define(
            'wp-id_1.0.0',
            ['TestStrings'],
            (strings: unknown) => ({
              default: class FakeWebPart {
                public constructor() {
                  captured.push(strings);
                }
                public _internalInitialize(): void {}
                public _internalDeserialize(): void {}
                public render(): void {}
              }
            })
          );
        }
      },
      ['/dist/TestStrings_fr-fr.js']
    );

    const { status } = mountCard('wp-id');
    const { mountOne } = await import('../src/local-bootstrap.js');
    await mountOne(
      {
        id: 'wp-id',
        alias: 'FakeWebPart',
        bundleName: 'testwp',
        amdId: 'wp-id_1.0.0',
        localizedResources: ['TestStrings'],
        preconfiguredEntries: [{ properties: {} }]
      },
      resolveLocale('fr-fr'),
      { createWebPartContext: fakeWebPartContext }
    );

    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual({ hello: 'hello' });
    expect(status.textContent).toBe('ready');
  });

  it('defers bundle defines with missing resource deps and loads the locale files', async () => {
    const captured: unknown[] = [];
    installScriptLoader({
      '/dist/DeferStrings_fr-fr.js': () => {
        (window as unknown as { define(id: string | undefined, deps: string[], factory: unknown): void }).define(
          undefined,
          [],
          () => ({ hello: 'bonjour' })
        );
      },
      '/dist/testwp.js': () => {
        // The page payload carries no localizedResources, so the bundle's own
        // dependency list drives locale loading.
        (window as unknown as { define(id: string | undefined, deps: string[], factory: unknown): void }).define(
          'wp-id_1.0.0',
          ['DeferStrings'],
          (strings: unknown) => ({
            default: class FakeWebPart {
              public constructor() {
                captured.push(strings);
              }
              public _internalInitialize(): void {}
              public _internalDeserialize(): void {}
              public render(): void {}
            }
          })
        );
      }
    });

    const { status } = mountCard('wp-id');
    const { mountOne } = await import('../src/local-bootstrap.js');
    await mountOne(
      {
        id: 'wp-id',
        alias: 'FakeWebPart',
        bundleName: 'testwp',
        amdId: 'wp-id_1.0.0',
        preconfiguredEntries: [{ properties: {} }]
      },
      resolveLocale('fr-fr'),
      { createWebPartContext: fakeWebPartContext }
    );

    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual({ hello: 'bonjour' });
    expect(status.textContent).toBe('ready');
  });

  it('provides a no-op stand-in for @msinternal/* deps (bundled sp-* telemetry imports)', async () => {
    const captured: unknown[] = [];
    installScriptLoader({
      '/dist/testwp.js': () => {
        (window as unknown as { define(id: string | undefined, deps: string[], factory: unknown): void }).define(
          'wp-id_1.0.0',
          ['@msinternal/sp-telemetry'],
          (telemetry: unknown) => ({
            default: class FakeWebPart {
              public constructor() {
                captured.push(telemetry);
              }
              public _internalInitialize(): void {}
              public _internalDeserialize(): void {}
              public render(): void {}
            }
          })
        );
      }
    });

    const { status } = mountCard('wp-id');
    const { mountOne } = await import('../src/local-bootstrap.js');
    await mountOne(
      {
        id: 'wp-id',
        alias: 'FakeWebPart',
        bundleName: 'testwp',
        amdId: 'wp-id_1.0.0',
        preconfiguredEntries: [{ properties: {} }]
      },
      resolveLocale('en-us'),
      { createWebPartContext: fakeWebPartContext }
    );

    expect(captured).toHaveLength(1);
    const telemetry = captured[0];
    expect(typeof telemetry).toBe('function');
    // The stand-in survives new/call/property chains without throwing.
    const monitor = new (telemetry as new (name: string) => { writeSuccess(): unknown })('qos');
    expect(typeof (monitor as unknown as { writeSuccess: unknown }).writeSuccess).toBe('function');
    expect(typeof (telemetry as unknown as { SafeHtml: unknown }).SafeHtml).toBe('function');
    expect(status.textContent).toBe('ready');
    expect(status.classList.contains('rspfx-wp-ready')).toBe(true);
  });

  it('reads the locale from the ?locale= query param', async () => {
    const seen: { locale?: string }[] = [];
    window.history.pushState({}, '', '?locale=de-de');
    installScriptLoader({
      '/dist/testwp.js': () => {
        (window as unknown as { define(id: string | undefined, deps: string[], factory: unknown): void }).define(
          'wp-id_1.0.0',
          [],
          () => ({
            default: class FakeWebPart {
              public _internalInitialize(): void {}
              public _internalDeserialize(): void {}
              public render(): void {}
            }
          })
        );
      }
    });
    mountCard('wp-id');
    const { mountOne } = await import('../src/local-bootstrap.js');
    await mountOne(
      { id: 'wp-id', alias: 'FakeWebPart', bundleName: 'testwp', amdId: 'wp-id_1.0.0', preconfiguredEntries: [] },
      undefined,
      {
        createWebPartContext: async (_manifest, _overrides, options) => {
          seen.push({ locale: options?.pageContextData?.locale });
          return {} as unknown as WebPartContextLike;
        }
      }
    );
    expect(seen).toEqual([{ locale: 'de-de' }]);
  });
});

describe('local-bootstrap extension dispatch', () => {
  it('mounts an ApplicationCustomizer with placeholder hosts and the _init lifecycle', async () => {
    const initCalls: unknown[] = [];
    const renderCalls: unknown[] = [];
    const seen: { type: unknown; options: unknown }[] = [];
    const context = { fakeContext: true };
    installScriptLoader({
      '/dist/acbundle.js': () => {
        (window as unknown as { define(id: string | undefined, deps: string[], factory: unknown): void }).define(
          'ac-id_1.0.0',
          [],
          () => ({
            default: class FakeApplicationCustomizer {
              public _init(context: unknown, propsJson: string, sequence: number): Promise<void> {
                initCalls.push({ context, propsJson, sequence });
                return Promise.resolve();
              }
              public onRender(): void {
                renderCalls.push('render');
              }
            }
          })
        );
      }
    });
    const { root, status } = mountCard('ac-id');
    const { mountOne } = await import('../src/local-bootstrap.js');
    const seams: LocalMountSeams = {
      createExtensionContext: async (manifest, type, options) => {
        seen.push({ type, options });
        return context;
      }
    };
    await mountOne(
      {
        id: 'ac-id',
        alias: 'MyAppCustomizer',
        bundleName: 'acbundle',
        amdId: 'ac-id_1.0.0',
        componentType: 'Extension',
        extensionType: 'ApplicationCustomizer',
        preconfiguredEntries: [{ properties: { message: 'hi' } }]
      },
      resolveLocale('fr-fr'),
      seams
    );

    expect(seen).toHaveLength(1);
    expect(seen[0]!.type).toBe('ApplicationCustomizer');
    const options = seen[0]!.options as { pageContextData: { locale: string }; placeholderHosts: { name: string }[] };
    expect(options.pageContextData.locale).toBe('fr-fr');
    expect(options.placeholderHosts.map((host) => host.name)).toEqual(['Top', 'Bottom']);
    expect(initCalls).toEqual([
      { context, propsJson: JSON.stringify({ message: 'hi' }), sequence: 65535 }
    ]);
    expect(renderCalls).toEqual(['render']);
    expect(root.querySelectorAll('.rspfx-ac-placeholder')).toHaveLength(2);
    expect(status.textContent).toBe('ready');
  });

  it('mounts a FieldCustomizer and calls onRenderCell per sample row', async () => {
    const cells: Array<Record<string, unknown>> = [];
    installScriptLoader({
      '/dist/fcbundle.js': () => {
        (window as unknown as { define(id: string | undefined, deps: string[], factory: unknown): void }).define(
          'fc-id_1.0.0',
          [],
          () => ({
            default: class FakeFieldCustomizer {
              public _init(): Promise<void> {
                return Promise.resolve();
              }
              public onRenderCell(event: Record<string, unknown>): void {
                cells.push(event);
              }
            }
          })
        );
      }
    });
    const { root, status } = mountCard('fc-id');
    const { mountOne } = await import('../src/local-bootstrap.js');
    const seen: { type: unknown; options: unknown }[] = [];
    await mountOne(
      {
        id: 'fc-id',
        alias: 'MyFieldCustomizer',
        bundleName: 'fcbundle',
        amdId: 'fc-id_1.0.0',
        componentType: 'Extension',
        extensionType: 'FieldCustomizer',
        preconfiguredEntries: []
      },
      resolveLocale('en-us'),
      {
        createExtensionContext: async (_manifest, type, options) => {
          seen.push({ type, options });
          return {};
        }
      }
    );

    expect(seen[0]!.type).toBe('FieldCustomizer');
    const options = seen[0]!.options as { field: { internalName: string }; listView: { rows: unknown[] } };
    expect(options.field.internalName).toBe('SampleField');
    expect(options.listView.rows).toHaveLength(3);
    expect(cells).toHaveLength(3);
    expect(cells[0]!.cellValue).toBe('Alpha');
    expect((cells[0]!.listItem as { id: number }).id).toBe(1);
    expect((cells[0]!.row as { id: number }).id).toBe(1);
    expect((cells[0]!.domElement as HTMLElement).className).toBe('rspfx-fc-cell');
    expect(root.querySelectorAll('.rspfx-fc-table tbody tr')).toHaveLength(3);
    expect(status.textContent).toBe('ready');
  });

  it('mounts a ListViewCommandSet with buttons wired to onExecute', async () => {
    const executed: Array<Record<string, unknown>> = [];
    const updated: Array<Record<string, unknown>> = [];
    installScriptLoader({
      '/dist/lvcsbundle.js': () => {
        (window as unknown as { define(id: string | undefined, deps: string[], factory: unknown): void }).define(
          'lvcs-id_1.0.0',
          [],
          () => ({
            default: class FakeListViewCommandSet {
              public _init(): Promise<void> {
                return Promise.resolve();
              }
              public tryGetCommand(id: string): { id: string; title: string; visible: boolean; disabled?: boolean } {
                return { id, title: id === 'CMD_1' ? 'Command One' : 'Command Two', visible: true };
              }
              public onListViewUpdated(event: Record<string, unknown>): void {
                updated.push(event);
              }
              public onExecute(event: Record<string, unknown>): void {
                executed.push(event);
              }
            }
          })
        );
      }
    });
    const { root, status } = mountCard('lvcs-id');
    const { mountOne } = await import('../src/local-bootstrap.js');
    await mountOne(
      {
        id: 'lvcs-id',
        alias: 'MyCommandSet',
        bundleName: 'lvcsbundle',
        amdId: 'lvcs-id_1.0.0',
        componentType: 'Extension',
        extensionType: 'ListViewCommandSet',
        items: {
          CMD_1: { title: { default: 'Command One' }, type: 'command' },
          CMD_2: { title: { default: 'Command Two' }, type: 'command' }
        },
        preconfiguredEntries: []
      },
      resolveLocale('en-us'),
      { createExtensionContext: async () => ({}) }
    );

    const buttons = root.querySelectorAll<HTMLButtonElement>('.rspfx-lvcs-button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.textContent).toBe('Command One');
    expect(buttons[1]!.textContent).toBe('Command Two');
    expect(updated).toHaveLength(1);
    expect(updated[0]).toEqual({ selectedRows: [] });
    buttons[1]!.click();
    expect(executed).toHaveLength(1);
    expect(executed[0]).toEqual({ itemId: 'CMD_2', selectedRows: [] });
    expect(root.querySelectorAll('.rspfx-fc-table tbody tr')).toHaveLength(3);
    expect(status.textContent).toBe('ready');
  });

  it('fails with a clear error for unknown extension types', async () => {
    installScriptLoader({
      '/dist/badbundle.js': () => {
        (window as unknown as { define(id: string | undefined, deps: string[], factory: unknown): void }).define(
          'bad-id_1.0.0',
          [],
          () => ({ default: class BadExtension {} })
        );
      }
    });
    const { root, status } = mountCard('bad-id');
    const { mountOne } = await import('../src/local-bootstrap.js');
    await expect(
      mountOne(
        {
          id: 'bad-id',
          alias: 'BadExt',
          bundleName: 'badbundle',
          amdId: 'bad-id_1.0.0',
          componentType: 'Extension',
          extensionType: 'MysteryExtension',
          preconfiguredEntries: []
        },
        resolveLocale('en-us'),
        { createExtensionContext: async () => ({}) }
      )
    ).rejects.toThrow(/unsupported extensionType 'MysteryExtension'/);
    expect(status.textContent).toBe('error');
    expect(root.querySelector('.rspfx-wp-error')?.textContent).toContain('MysteryExtension');
  });

  it('keeps the web part flow working via the seam (class + lifecycle sequence)', async () => {
    const calls: string[] = [];
    const seen: { locale?: string }[] = [];
    installScriptLoader({
      '/dist/wp2.js': () => {
        (window as unknown as { define(id: string | undefined, deps: string[], factory: unknown): void }).define(
          'wp2-id_1.0.0',
          [],
          () => ({
            default: class FakeWebPart {
              public _internalInitialize(): void {
                calls.push('initialize');
              }
              public _internalDeserialize(): void {
                calls.push('deserialize');
              }
              public onInit(): Promise<void> {
                calls.push('onInit');
                return Promise.resolve();
              }
              public render(): void {
                calls.push('render');
              }
            }
          })
        );
      }
    });
    const { status } = mountCard('wp2-id');
    const { mountOne } = await import('../src/local-bootstrap.js');
    await mountOne(
      {
        id: 'wp2-id',
        alias: 'FakeWebPart2',
        bundleName: 'wp2',
        amdId: 'wp2-id_1.0.0',
        preconfiguredEntries: [{ properties: { title: 'X' } }]
      },
      resolveLocale('en-us'),
      {
        createWebPartContext: async (_manifest, _overrides, options) => {
          seen.push({ locale: options?.pageContextData?.locale });
          return {} as unknown as WebPartContextLike;
        }
      }
    );
    expect(calls).toEqual(['initialize', 'deserialize', 'onInit', 'render']);
    expect(seen).toEqual([{ locale: 'en-us' }]);
    expect(status.textContent).toBe('ready');
  });
});
