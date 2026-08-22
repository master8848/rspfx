import { describe, it, expect } from 'vitest';
import * as coreStub from './sp-core-library.js';
import * as webpartStub from './sp-webpart-base.js';

describe('stub contract: sp-core-library', () => {
  it('exports required symbols matching @microsoft/sp-core-library 1.23.2', () => {
    expect(coreStub.DisplayMode).toBeDefined();
    expect(coreStub.DisplayMode.Read).toBe(1);
    expect(coreStub.DisplayMode.Edit).toBe(2);
    expect(coreStub.Environment).toBeDefined();
    expect(typeof coreStub.Environment._initialize).toBe('function');
    expect(coreStub.EnvironmentType).toBeDefined();
    expect(coreStub.EnvironmentType.Local).toBeDefined();
    expect(coreStub.ServiceKey).toBeDefined();
    expect(typeof coreStub.ServiceKey.create).toBe('function');
    expect(typeof coreStub.ServiceKey.createCustom).toBe('function');
    expect(coreStub.Log).toBeDefined();
    expect(typeof coreStub.Log.info).toBe('function');
    expect(typeof coreStub.Log.warn).toBe('function');
    expect(typeof coreStub.Log.error).toBe('function');
    expect(typeof coreStub.Log.verbose).toBe('function');
    expect(coreStub.Guid).toBeDefined();
    expect(typeof coreStub.Guid.parse).toBe('function');
    expect(typeof coreStub.Guid.tryParse).toBe('function');
    expect(typeof coreStub.Guid.isValid).toBe('function');
    expect(typeof coreStub.Guid.newGuid).toBe('function');
    expect(coreStub.Validate).toBeDefined();
    expect(typeof coreStub.Validate.isTrue).toBe('function');
    expect(typeof coreStub.Validate.isNotNullOrUndefined).toBe('function');
    expect(coreStub.SPEvent).toBeDefined();
    expect(coreStub.SPEventArgs).toBeDefined();
    expect(coreStub.ServiceScope).toBeDefined();
    expect(coreStub.Version).toBeDefined();
  });

  it('Guid and Validate behave minimally like real implementation', () => {
    const g = coreStub.Guid.newGuid();
    expect(coreStub.Guid.isValid(g.toString())).toBe(true);
    expect(coreStub.Guid.tryParse(g.toString())?.toString()).toBe(g.toString());
    expect(() => coreStub.Validate.isTrue(false, 'x')).toThrow();
    expect(() => coreStub.Validate.isNotNullOrUndefined(null, 'y')).toThrow();
  });

  it('Environment._initialize updates type', () => {
    coreStub.Environment._initialize({ type: coreStub.EnvironmentType.SharePoint });
    expect(coreStub.Environment.type).toBe(coreStub.EnvironmentType.SharePoint);
    coreStub.Environment._initialize({ type: coreStub.EnvironmentType.Local });
    expect(coreStub.Environment.type).toBe(coreStub.EnvironmentType.Local);
  });

  it('SPEvent add/remove works', () => {
    const ev = new coreStub.SPEvent();
    const observer = { isDisposed: false, dispose() {}, instanceId: '1', componentId: '2' };
    let called = 0;
    const handler = () => { called++; };
    ev.add(observer, handler);
    (ev as unknown as { _raise(a: unknown): void })._raise(new coreStub.SPEventArgs());
    expect(called).toBe(1);
    ev.remove(observer, handler);
    (ev as unknown as { _raise(a: unknown): void })._raise(new coreStub.SPEventArgs());
    expect(called).toBe(1);
  });
});

describe('stub contract: sp-webpart-base', () => {
  it('exports BaseClientSideWebPart', () => {
    expect(webpartStub.BaseClientSideWebPart).toBeDefined();
    const wp = new webpartStub.BaseClientSideWebPart<{ x: number }>();
    expect(typeof wp.render).toBe('function');
    expect(typeof wp.onInit).toBe('function');
  });

  it('canonical stub is re-used by packages/core/tests/setup', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(new URL('../../packages/core/tests/setup.ts', import.meta.url), 'utf8');
    expect(content).toContain('tests/stubs/sp-webpart-base');
    expect(content).not.toContain('class MockBaseClientSideWebPart');
  });
});
