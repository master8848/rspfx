import { describe, expect, it } from 'vitest';
import { createReloadController, createReloadClientScript, RSPFX_HOT_PATH } from '../src/index.js';

describe('createReloadController', () => {
  it('starts at build 0 and ticks monotonically', () => {
    const reload = createReloadController();
    expect(reload.current).toBe(0);
    reload.tick();
    reload.tick();
    expect(reload.current).toBe(2);
  });

  it('serves the current build as JSON with no-store and CORS headers', () => {
    const reload = createReloadController();
    reload.tick();
    const headers: Record<string, string> = {};
    let body = '';
    reload.handle(null, {
      setHeader(name, value) {
        headers[name] = value;
      },
      end(value) {
        body = value;
      }
    });
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Cache-Control']).toBe('no-store');
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
    expect(JSON.parse(body)).toEqual({ build: 1 });
  });

  it('exposes the hot path and a client script that polls it', () => {
    const reload = createReloadController();
    expect(reload.path).toBe(RSPFX_HOT_PATH);
    expect(reload.clientScript).toContain(RSPFX_HOT_PATH);
    expect(reload.clientScript).toContain('location.reload');
    expect(reload.clientScript).toContain('cache: \'no-store\'');
  });

  it('client script derives the origin from the manifest script element', () => {
    const script = createReloadClientScript();
    expect(script).toContain('document.currentScript');
    expect(script).toContain('new URL(current.src, window.location.href).origin');
  });
});
