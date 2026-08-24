import { buildLocalPageHtml, readLocalPageComponents } from './local-page.js';
import { createMockSharePointApi } from './mock-api.js';
import type { ManifestRegenerator } from './manifests.js';
import type { ReloadController } from './reload.js';

export interface Route {
  path: string;
  handler: (req: unknown, res: unknown, next?: (e?: unknown) => void) => void;
}

export function createManifestRoute(
  regenerator: ManifestRegenerator,
  reload: ReloadController
): Route {
  return {
    path: '/temp/manifests.js',
    handler: (_req, res) => {
      const response = res as { setHeader(k: string, v: string): void; end(b: string): void };
      response.setHeader('Content-Type', 'application/javascript');
      response.setHeader('Cache-Control', 'no-store');
      response.end(regenerator.manifestsJs + reload.clientScript);
    }
  };
}

export function createHotRoute(reload: ReloadController): Route {
  return {
    path: reload.path,
    handler: (req, res) => reload.handle(req, res as Parameters<typeof reload.handle>[1])
  };
}

export function createMockApiRoute(projectRoot: string, origin: () => string): Route {
  const mockApi = createMockSharePointApi({ projectRoot, origin });
  return { path: mockApi.path, handler: mockApi.handle };
}

export function createLocalPageRoute(opts: {
  projectName: string;
  origin: string;
  components: ReturnType<typeof readLocalPageComponents>;
  reloadClientScript: string;
  devtoolsScript?: string;
}): Route {
  const pageHtml = buildLocalPageHtml({
    projectName: opts.projectName,
    origin: opts.origin,
    components: opts.components,
    reloadClientScript: opts.reloadClientScript,
    devtoolsScript: opts.devtoolsScript
  } as Parameters<typeof buildLocalPageHtml>[0]);
  return {
    path: '/',
    handler: (req, res, next) => {
      const pathname = ((req as { url?: string }).url ?? '').split('?')[0];
      if (pathname !== '/') {
        next?.();
        return;
      }
      const response = res as { setHeader(k: string, v: string): void; end(b: string): void };
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.end(pageHtml);
    }
  };
}

export function createReloadRoutes(reload: ReloadController): Route[] {
  return [createHotRoute(reload)];
}
