import type { DevStore } from './store.js';
import type { ManifestRegenerator } from './manifests.js';
import type { DevStoreSnapshot } from './store.js';

export function attachDevtools(
  store: DevStore,
  regenerator: ManifestRegenerator,
  ctx: { version: string; getCompileContext?: () => unknown }
): { script: string; routePath: string; handler: (req: unknown, res: unknown) => void } | undefined {
  const enabled = store.get().devtools === true || process.env.RSPFX_DEVTOOLS === '1';
  if (!enabled) return undefined;

  const script = `<script>window.__RSPFX__={store:{get:function(){return ${JSON.stringify(store.get())}},subscribe:function(fn){return function(){}}},getManifestsJs:function(){return ${JSON.stringify(regenerator.manifestsJs.slice(0, 200))}},getCompileContext:function(){return ${JSON.stringify(ctx.getCompileContext?.() ?? null)}},version:${JSON.stringify(ctx.version)}};Object.defineProperty(window,'__RSPFX__',{writable:false});</script>`;

  const routePath = '/_rspfx/devtools.json';
  const handler = (_req: unknown, res: unknown) => {
    const response = res as { setHeader(k: string, v: string): void; end(b: string): void };
    const snapshot: DevStoreSnapshot = store.get();
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    response.end(
      JSON.stringify({
        origin: snapshot.origin,
        tick: snapshot.tick,
        status: snapshot.status,
        fingerprint: snapshot.fingerprint,
        version: ctx.version,
        manifestsLength: regenerator.manifestsJs.length
      })
    );
  };

  return { script, routePath, handler };
}

export function getDevtoolsScript(
  store: DevStore,
  regenerator?: ManifestRegenerator,
  version?: string
): string | undefined {
  const enabled = store.get().devtools === true || process.env.RSPFX_DEVTOOLS === '1';
  if (!enabled) return undefined;
  const tick = store.get().tick;
  const origin = store.get().origin;
  const ver = version ?? '0.0.0';
  const manifestsPreview = regenerator ? regenerator.manifestsJs.slice(0, 0) : '';
  void manifestsPreview;
  return `<script>window.__RSPFX__={store:{get:function(){return {origin:${JSON.stringify(origin)},tick:${tick},status:${JSON.stringify(store.get().status)}}},subscribe:function(){return function(){}}},getManifestsJs:function(){return "";},getCompileContext:function(){return null},version:${JSON.stringify(ver)}};try{Object.defineProperty(window,'__RSPFX__',{writable:false,configurable:false});}catch{}</script>`;
}
