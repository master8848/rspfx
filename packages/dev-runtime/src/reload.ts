import { isAllowedOrigin } from './cors.js';

export const RSPFX_HOT_PATH = '/__rspfx_hot.json';

interface HotJsonResponse {
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

export interface ReloadController {
  readonly path: string;
  readonly current: number;
  readonly clientScript: string;
  tick(): void;
  handle(req: unknown, res: HotJsonResponse): void;
}

export function createReloadController(): ReloadController {
  let current = 0;
  const handle = (req: unknown, res: HotJsonResponse): void => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    const origin = (req as { headers?: Record<string, string | string[] | undefined> })?.headers?.origin;
    const originValue = Array.isArray(origin) ? origin[0] : origin;
    if (originValue && isAllowedOrigin(originValue)) {
      res.setHeader('Access-Control-Allow-Origin', originValue);
    }
    // Fallback to no ACAO header when origin not allowlisted (not '*') for security.
    res.end(JSON.stringify({ build: current }));
  };
  return {
    path: RSPFX_HOT_PATH,
    get current(): number {
      return current;
    },
    clientScript: createReloadClientScript(),
    tick(): void {
      current += 1;
    },
    handle
  };
}

export function createReloadClientScript(): string {
  return `(() => {
  try {
    var scripts = document.getElementsByTagName('script');
    var current = document.currentScript || (scripts.length ? scripts[scripts.length - 1] : undefined);
    if (!current || !current.src) { return; }
    var origin = new URL(current.src, window.location.href).origin;
    var seen = null;
    var interval = 500;
    var handleData = function (data) {
      if (!data || typeof data.build !== 'number') { return; }
      if (seen !== null && seen !== data.build) {
        window.location.reload();
        return;
      }
      seen = data.build;
    };
    var poll = function () {
      fetch(origin + '${RSPFX_HOT_PATH}', { cache: 'no-store' })
        .then(function (res) {
          if (!res.ok) { return undefined; }
          return res.json();
        })
        .then(handleData)
        .catch(function () {})
        .then(function () {
          setTimeout(poll, interval);
        });
    };
    // Prefer WebSocket push from rspack dev-server when available; fall back to polling.
    try {
      var wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      var wsHost = new URL(origin).host;
      var ws = new WebSocket(wsProtocol + '//' + wsHost + '/ws');
      ws.onmessage = function (event) {
        try {
          var msg = JSON.parse(event.data);
          if (msg && typeof msg.build === 'number') {
            handleData(msg);
          } else if (msg && (msg.type === 'hash' || msg.type === 'ok' || msg.type === 'still-ok')) {
            fetch(origin + '${RSPFX_HOT_PATH}', { cache: 'no-store' })
              .then(function (r) { if (!r.ok) return undefined; return r.json(); })
              .then(handleData)
              .catch(function () {});
          }
        } catch {}
      };
      ws.onerror = function () { try { ws.close(); } catch {} };
    } catch {}
    poll();
  } catch (error) {
    console.warn('[rspfx] auto-reload client failed to start', error);
  }
})();
`;
}
