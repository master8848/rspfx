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
  const handle = (_req: unknown, res: HotJsonResponse): void => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
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
    var poll = function () {
      fetch(origin + '${RSPFX_HOT_PATH}', { cache: 'no-store' })
        .then(function (res) {
          if (!res.ok) { return undefined; }
          return res.json();
        })
        .then(function (data) {
          if (!data || typeof data.build !== 'number') { return; }
          if (seen !== null && seen !== data.build) {
            window.location.reload();
            return;
          }
          seen = data.build;
        })
        .catch(function () {})
        .then(function () {
          setTimeout(poll, 1000);
        });
    };
    poll();
  } catch (error) {
    console.warn('[rspfx] auto-reload client failed to start', error);
  }
})();
`;
}
