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
  broadcast(): void;
  subscribe(listener: (tick: number) => void): () => void;
  handle(req: unknown, res: HotJsonResponse): void;
  dispose(): void;
}

export function createReloadController(): ReloadController {
  let current = 0;
  const listeners = new Set<(tick: number) => void>();
  const handle = (req: unknown, res: HotJsonResponse): void => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    const origin = (req as { headers?: Record<string, string | string[] | undefined> })?.headers?.origin;
    const originValue = Array.isArray(origin) ? origin[0] : origin;
    if (originValue && isAllowedOrigin(originValue)) {
      res.setHeader('Access-Control-Allow-Origin', originValue);
    }
    res.end(JSON.stringify({ build: current }));
  };
  const broadcast = (): void => {
    for (const l of [...listeners]) {
      try {
        l(current);
      } catch {}
    }
  };
  return {
    path: RSPFX_HOT_PATH,
    get current(): number {
      return current;
    },
    clientScript: createReloadClientScript(),
    tick(): void {
      current += 1;
      broadcast();
    },
    broadcast,
    subscribe(listener: (tick: number) => void): () => void {
      listeners.add(listener);
      let unsubscribed = false;
      return () => {
        if (unsubscribed) return;
        unsubscribed = true;
        listeners.delete(listener);
      };
    },
    handle,
    dispose(): void {
      listeners.clear();
    }
  };
}

export function createReloadClientScript(opts?: { pollMs?: number; wsPath?: string; sse?: boolean }): string {
  const pollMs = opts?.pollMs ?? 250;
  const wsPath = opts?.wsPath ?? '/ws';
  const sseEnabled = opts?.sse ? 'true' : 'false';
  return `(() => {
  try {
    var scripts = document.getElementsByTagName('script');
    var current = document.currentScript || (scripts.length ? scripts[scripts.length - 1] : undefined);
    if (!current || !current.src) { return; }
    var origin = new URL(current.src, window.location.href).origin;
    var seen = null;
    var interval = ${pollMs};
    var pollTimer = null;
    var ws = null;
    var handleData = function (data) {
      if (!data || typeof data.build !== 'number') { return; }
      if (seen !== null && seen !== data.build) {
        window.location.reload();
        return;
      }
      seen = data.build;
    };
    var schedulePoll = function (ms) {
      clearTimeout(pollTimer);
      pollTimer = setTimeout(poll, ms);
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
          if (!ws || ws.readyState !== 1) {
            schedulePoll(interval);
          }
        });
    };
    try {
      var wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      var wsHost = new URL(origin).host;
      ws = new WebSocket(wsProtocol + '//' + wsHost + '${wsPath}');
      ws.onopen = function () {
        clearTimeout(pollTimer);
        pollTimer = null;
      };
      ws.onmessage = function (event) {
        clearTimeout(pollTimer);
        try {
          var msg = JSON.parse(event.data);
          if (msg && typeof msg.build === 'number') {
            handleData(msg);
          } else if (msg && (msg.type === 'hash' || msg.type === 'ok' || msg.type === 'still-ok')) {
            handleData(msg);
          }
        } catch {}
      };
      ws.onclose = function () {
        schedulePoll(interval);
      };
      ws.onerror = function () { try { ws.close(); } catch {} };
    } catch {}
    if (${sseEnabled} && 'ReadableStream' in window) {
      try {
        fetch(origin + '${RSPFX_HOT_PATH}', { headers: { Accept: 'text/event-stream' } }).then(function(r){
          if (!r.body) return;
          var reader = r.body.getReader();
          var decoder = new TextDecoder();
          var buf = '';
          function read(){
            return reader.read().then(function(res){
              if (res.done) return;
              buf += decoder.decode(res.value, {stream:true});
              var parts = buf.split('\\n\\n');
              buf = parts.pop();
              for (var i=0;i<parts.length;i++){
                try { var d = JSON.parse(parts[i].replace(/^data:\\s*/gm,'')); handleData(d); clearTimeout(pollTimer);} catch {}
              }
              return read();
            });
          }
          return read();
        }).catch(function(){});
      } catch {}
    }
    poll();
  } catch (error) {
    console.warn('[rspfx] auto-reload client failed to start', error);
  }
})();
`;
}
