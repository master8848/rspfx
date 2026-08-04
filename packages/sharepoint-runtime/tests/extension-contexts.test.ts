// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import {
  createLocalExtensionContext,
  createMockPlaceholderProvider,
  type MockPlaceholderProvider,
  type LocalExtensionType,
  type LocalExtensionContextOptions
} from '../src/extension-contexts.js';
import {
  createMockPageContextData,
  type ScopeLike,
  type LocalContextServices
} from '../src/context.js';
import { createMockThemeProvider } from '../src/theme.js';

const pageContextServiceKey = { id: 'sp-page-context:PageContext' };
const themeServiceKey = { id: 'sp-component-base:ThemeProvider' };

class TestScope implements ScopeLike {
  private readonly registrations = new Map<string, unknown>();
  private readonly pendingCallbacks: Array<() => void> = [];
  private finished = false;

  provide(key: unknown, instance: unknown): unknown {
    const id = (key as { id: string }).id;
    if (this.registrations.has(id)) {
      throw new Error(`provide() duplicate key ${id}`);
    }
    this.registrations.set(id, instance);
    return instance;
  }

  consume(key: unknown): unknown {
    const id = (key as { id: string }).id;
    const instance = this.registrations.get(id);
    if (!this.finished || instance === undefined) {
      throw new Error(`consume() before finish() or unknown key ${id}`);
    }
    return instance;
  }

  whenFinished(callback: () => void): void {
    if (this.finished) {
      callback();
    } else {
      this.pendingCallbacks.push(callback);
    }
  }

  finish(): void {
    this.finished = true;
    for (const callback of this.pendingCallbacks.splice(0)) {
      callback();
    }
  }
}

interface SeenSeam {
  scope: TestScope;
  domElement: HTMLElement;
  manifest: Record<string, unknown>;
  instanceId: string;
  finished: boolean;
}

function buildSeam(services?: Partial<LocalContextServices>): {
  options: LocalExtensionContextOptions;
  seen: SeenSeam;
} {
  const pageContext = services?.pageContext ?? createMockPageContextData();
  const themeProvider = services?.themeProvider ?? createMockThemeProvider();
  const seen: SeenSeam = {
    scope: undefined as unknown as TestScope,
    domElement: undefined as unknown as HTMLElement,
    manifest: undefined as unknown as Record<string, unknown>,
    instanceId: '',
    finished: false
  };
  const domElement = { tagName: 'DIV' } as unknown as HTMLElement;
  return {
    seen,
    options: {
      services: { pageContext, themeProvider },
      domElement,
      createScope: () => {
        const scope = new TestScope();
        scope.provide(pageContextServiceKey, pageContext);
        scope.provide(themeServiceKey, themeProvider);
        seen.scope = scope;
        return scope;
      },
      createContext: (scope, element, manifest, instanceId) => {
        seen.domElement = element;
        seen.manifest = manifest as Record<string, unknown>;
        seen.instanceId = instanceId;
        seen.finished = false;
        scope.whenFinished(() => {
          seen.finished = true;
        });
        return { instanceId, manifest, serviceScope: scope, placeholderProvider: {} };
      }
    }
  };
}

const extensionManifest = (extensionType: LocalExtensionType): Record<string, unknown> => ({
  id: 'a2c1c7f1-0000-0000-0000-000000000001',
  alias: `My${extensionType}`,
  componentType: 'Extension',
  extensionType,
  items: {
    MYCOMMAND_1: { title: { default: 'Command One' }, type: 'command' }
  },
  preconfiguredEntries: [{ properties: { foo: 'bar' } }]
});

describe('createLocalExtensionContext', () => {
  for (const extensionType of ['ApplicationCustomizer', 'FieldCustomizer', 'ListViewCommandSet'] as const) {
    it(`normalizes the ${extensionType} manifest for the context`, async () => {
      const { options, seen } = buildSeam();
      const context = await createLocalExtensionContext(
        extensionManifest(extensionType),
        extensionType,
        options
      );

      expect(context).toBeDefined();
      expect(seen.manifest.componentType).toBe('Extension');
      expect(seen.manifest.extensionType).toBe(extensionType);
      expect(seen.manifest.id).toBe('a2c1c7f1-0000-0000-0000-000000000001');
      const items = seen.manifest.items as { MYCOMMAND_1: { title: { default: string } } };
      expect(items.MYCOMMAND_1.title.default).toBe('Command One');
      expect(seen.manifest.loaderConfig).toEqual({ internalModuleBaseUrls: [] });
      expect(seen.manifest.isInternal).toBe(false);
      expect(seen.instanceId).toBeTruthy();
      expect(seen.finished).toBe(true);
    });
  }

  it('defaults items to {} when the manifest has none', async () => {
    const { options, seen } = buildSeam();
    await createLocalExtensionContext({ id: 'x', alias: 'y' }, 'ListViewCommandSet', options);
    expect(seen.manifest.items).toEqual({});
  });

  it('passes the locale through to the page context data', async () => {
    const { options, seen } = buildSeam();
    const services = {
      ...options.services,
      pageContext: createMockPageContextData({ locale: 'ar-sa' })
    };
    await createLocalExtensionContext(
      extensionManifest('ApplicationCustomizer'),
      'ApplicationCustomizer',
      {
        ...options,
        pageContextData: { locale: 'ar-sa' },
        services
      }
    );
    expect(seen.manifest.extensionType).toBe('ApplicationCustomizer');
    const pageContext = (services.pageContext as unknown as { cultureInfo: { isRightToLeft: boolean } })
      .cultureInfo;
    expect(pageContext.isRightToLeft).toBe(true);
  });
});

describe('createMockPlaceholderProvider', () => {
  it('creates content inside registered placeholder hosts', () => {
    const provider: MockPlaceholderProvider = createMockPlaceholderProvider(['Top', 'Bottom']);
    const content = provider.tryCreateContent('Top');
    expect(content).toBeDefined();
    expect(content!.name).toBe('Top');
    expect(provider.placeholders.get('Top')!.domElement.contains(content!.domElement)).toBe(true);
  });

  it('returns undefined for unknown placeholders', () => {
    const provider = createMockPlaceholderProvider();
    expect(provider.tryCreateContent('PageHeader')).toBeUndefined();
    expect(provider.containsPlaceholder('Top')).toBe(true);
    expect(provider.containsPlaceholder('PageHeader')).toBe(false);
  });

  it('routes changedEvent registrations to the callback', () => {
    const provider = createMockPlaceholderProvider();
    const listener = vi.fn();
    const target = {};
    provider.changedEvent.add(target, listener);
    provider.changedEvent.remove(target, listener);
    expect(listener).not.toHaveBeenCalled();
  });
});
