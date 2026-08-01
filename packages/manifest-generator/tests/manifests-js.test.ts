// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { generateManifestsJs } from '../src/index.js';
import type { ComponentManifest } from '../src/index.js';

function helloManifest(overrides: Record<string, unknown> = {}): ComponentManifest {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    alias: 'HelloWebPart',
    componentType: 'WebPart',
    version: '1.2.3',
    manifestVersion: 2,
    loaderConfig: {
      internalModuleBaseUrls: [],
      entryModuleId: 'hello',
      scriptResources: {
        hello: { type: 'path', path: 'hello.js' }
      }
    },
    ...overrides
  } as ComponentManifest;
}

interface DebugManifests {
  _metadata: unknown;
  getManifests(): unknown[];
}

function installScriptAndEval(js: string): DebugManifests {
  const script = document.createElement('script');
  script.src = 'https://localhost:4321/temp/manifests.js';
  Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
  let factoryResult: unknown;
  (globalThis as Record<string, unknown>)['define'] = (
    _deps: unknown[],
    factory: () => unknown
  ) => {
    factoryResult = factory();
  };
  (0, eval)(js);
  return factoryResult as DebugManifests;
}

describe('generateManifestsJs', () => {
  it('emits the debug manifests IIFE shape', async () => {
    const js = await generateManifestsJs([helloManifest()]);
    expect(js).toContain('self.debugManifests');
    expect(js).toContain('define([],');
    expect(js).toContain('getManifests');
  });

  it('executes and getManifests returns fresh clones with defaulted base urls', async () => {
    const debugManifests = installScriptAndEval(await generateManifestsJs([helloManifest()]));
    expect(debugManifests._metadata).toBeUndefined();
    const manifests = debugManifests.getManifests() as Array<{
      loaderConfig: { internalModuleBaseUrls: string[] };
    }>;
    expect(manifests).toHaveLength(1);
    expect(manifests[0]!.loaderConfig.internalModuleBaseUrls).toEqual([
      'https://localhost:4321/temp/'
    ]);
    const again = debugManifests.getManifests() as Array<{
      loaderConfig: { internalModuleBaseUrls: string[] };
    }>;
    expect(again).not.toBe(manifests);
    expect(again[0]).not.toBe(manifests[0]);
    expect((window as unknown as Record<string, unknown>).debugManifests).toBe(debugManifests);
    expect((self as unknown as Record<string, unknown>).debugManifests).toBe(debugManifests);
  });

  it('exposes metadata and expands compressed paths', async () => {
    const first = helloManifest();
    first.loaderConfig.scriptResources['loc'] = {
      type: 'localizedPath',
      paths: { l: { 'en-us': 'strings.en-us', default: 'strings' }, p: '', s: '.js' }
    };
    const second = helloManifest({ id: '22222222-2222-4222-8222-222222222222' });
    const debugManifests = installScriptAndEval(
      await generateManifestsJs([first, second], { createdDate: '2026-01-01' })
    );
    expect(debugManifests._metadata).toEqual({ createdDate: '2026-01-01' });
    const manifests = debugManifests.getManifests() as Array<{
      loaderConfig: {
        internalModuleBaseUrls: string[];
        scriptResources: Record<string, Record<string, unknown>>;
      };
    }>;
    const loc = manifests[0]!.loaderConfig.scriptResources['loc']!;
    expect(loc.paths).toEqual({
      'en-us': { path: 'strings.en-us.js' },
      default: { path: 'strings.js' }
    });
    expect(loc.path).toBe('strings.js');
    expect(manifests[1]!.loaderConfig.internalModuleBaseUrls).toEqual([
      'https://localhost:4321/temp/'
    ]);
  });

  it('picks the localized path from the market query param', async () => {
    const manifest = helloManifest();
    manifest.loaderConfig.scriptResources['loc'] = {
      type: 'localizedPath',
      paths: { l: { 'en-us': 'strings.en-us', default: 'strings' }, p: '', s: '.js' }
    };
    window.history.replaceState({}, '', '?market=EN-US');
    const debugManifests = installScriptAndEval(await generateManifestsJs([manifest]));
    const manifests = debugManifests.getManifests() as Array<{
      loaderConfig: { scriptResources: Record<string, Record<string, unknown>> };
    }>;
    expect(manifests[0]!.loaderConfig.scriptResources['loc']!.path).toBe('strings.en-us.js');
    window.history.replaceState({}, '', '/');
  });
});
