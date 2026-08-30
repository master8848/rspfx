import os from 'node:os';
import path from 'node:path';
import { resolveConfig, type RspfxConfig } from '@mbsks/rspfx-core';
import { ensureCertificates } from '@mbsks/rspfx-manifest-server';
import { createHookBus, getPlugins } from '@mbsks/rspfx-plugin-api';
import {
  readProject,
  resolveServeSettings,
  resolveServeMode,
  buildWorkbenchUrl,
  createManifestRegenerator,
  createRefreshRuntime,
  createReloadController,
  openBrowser,
  loadFrameworkPreset
} from '@mbsks/rspfx-dev-runtime';
import { findSpDependencies } from '@mbsks/rspfx-manifest-generator';
import { createLogger } from '@mbsks/rspfx-diagnostics';
import type { RspfxPluginOptions } from './types.js';

const logger = createLogger('rspfx');

export interface ViteDevPluginOptions extends RspfxPluginOptions {}

// Minimal Vite plugin shape — we only need configureServer, but keep compatible with vite's Plugin interface
export interface RspfxViteDevPlugin {
  name: string;
  configureServer(server: unknown): void | Promise<void>;
}

interface ConnectMiddlewareServer {
  middlewares: {
    use(route: string, handler: (req: unknown, res: unknown) => void): void;
  };
  watcher?: { on(event: string, listener: (path: string) => void): unknown };
  httpServer?: { once(event: 'listening', listener: () => void): unknown; address(): unknown };
}

interface ConnectResponse {
  setHeader(name: string, value: string): void;
  end(body: string): void;
  statusCode?: number;
}

function collectExternals(root: string, projectExternals: string[], localizedResources: { name: string }[]): string[] {
  return [
    ...new Set([
      ...findSpDependencies(root).keys(),
      ...projectExternals,
      ...localizedResources.map((r) => r.name)
    ])
  ];
}

function updateOriginWithActualPort(
  settings: { scheme: string; hostname: string; origin: string },
  devServer: ConnectMiddlewareServer
): string {
  try {
    const address = (devServer.httpServer as { address(): unknown } | undefined)?.address();
    if (address && typeof address === 'object' && 'port' in address) {
      return `${settings.scheme}://${settings.hostname}:${(address as { port: number }).port}`;
    }
  } catch {
    // fall back to configured origin
  }
  return settings.origin;
}

/**
 * Lean vite-first dev-only plugin.
 * Only hooks `configureServer` — reuses dev-runtime serve/manifest logic, no bundler build.
 * Framework preset is loaded dynamically; missing `react` etc is gracefully ignored (peer optional).
 */
export function rspfxDevPlugin(options: ViteDevPluginOptions): RspfxViteDevPlugin {
  const { projectRoot, ...rest } = options;
  const root = projectRoot ?? process.cwd();
  const resolved: RspfxConfig = resolveConfig(rest as Partial<RspfxConfig> & Record<string, unknown>);

  return {
    name: 'rspfx:dev',

    async configureServer(server) {
      const project = readProject(root, resolved.paths, resolved.version, resolved);
      const settings = resolveServeSettings({ config: resolved }, project.serveJson);
      const mode = resolveServeMode({ mode: undefined, config: resolved }, settings.tenantDomain);
      const reload = createReloadController();
      const originRef: { value: string } = { value: settings.origin };

      // Ensure certs lazily for https (dev-runtime/manifest-server shared impl)
      if (settings.https) {
        try {
          await ensureCertificates(path.join(os.homedir(), '.rspfx', 'certs'), settings.hostname);
        } catch {
          // best-effort: vite will surface https errors
        }
      }

      // Framework preset — dynamic, peer optional (e.g. react may not be installed)
      let refreshRuntime: ReturnType<typeof createRefreshRuntime> | undefined;
      try {
        const fastRefresh = resolved.dev?.fastRefresh ?? false;
        if (fastRefresh) {
          // loadFrameworkPreset handles missing package gracefully (returns empty preset with warn)
          const presetMod = await loadFrameworkPreset(resolved.framework, root);
          void presetMod;
          refreshRuntime = createRefreshRuntime(resolved.framework);
        }
      } catch (error) {
        logger.warn(
          `Framework preset for '${resolved.framework}' not available — fastRefresh disabled: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      const entryModuleIds: Record<string, string> = {};
      project.webParts.bundles.forEach((bundle, index) => {
        const id = project.webParts.manifestIds[index];
        if (id) entryModuleIds[id] = bundle.bundleName;
      });

      const regenerator = createManifestRegenerator({
        projectRoot: root,
        production: false,
        origin: () => originRef.value,
        packageVersion: project.webParts.packageVersion,
        entries: project.webParts.entries,
        externals: collectExternals(root, project.externals, project.localizedResources),
        localizedResources: project.localizedResources,
        webpartsDir: resolved.paths?.webpartsDir,
        extensionsDir: resolved.paths?.extensionsDir,
        librariesDir: resolved.paths?.librariesDir,
        entryModuleIds,
        refreshRuntime,
        bundleUrlSuffix: () => `?t=${reload.current}`
      });

      await regenerator.regenerate().catch((error) => {
        logger.warn(`Initial manifest regeneration failed: ${error instanceof Error ? error.message : String(error)}`);
      });

      void createHookBus(getPlugins(), { logger: logger.child({ phase: 'beforeStart' }) })
        .emitBeforeStart({ mode, port: settings.port })
        .then((result) => {
          if (!result.ok) logger.warn(`beforeStart hook failed: ${result.error.message}`);
        });

      const scheduleRegenerate = (): void => {
        void regenerator
          .regenerate()
          .then(() => {
            const shouldSuppress = Boolean(refreshRuntime?.preserved) && resolved.framework !== 'vanilla';
            if (!shouldSuppress) reload.tick();
          })
          .catch((error) => {
            logger.error(`Manifest regeneration failed: ${error instanceof Error ? error.message : String(error)}`);
          });
      };

      let debounce: ReturnType<typeof setTimeout> | undefined;
      const debounced = (): void => {
        clearTimeout(debounce);
        debounce = setTimeout(scheduleRegenerate, 250);
      };

      const devServer = server as ConnectMiddlewareServer;
      devServer.watcher?.on('change', debounced);
      devServer.watcher?.on('add', debounced);
      devServer.watcher?.on('unlink', debounced);

      devServer.middlewares.use('/temp/manifests.js', (_req, res) => {
        const response = res as ConnectResponse;
        void regenerator
          .regenerate()
          .then(() => {
            response.setHeader('Content-Type', 'application/javascript');
            response.setHeader('Cache-Control', 'no-store');
            response.end(regenerator.manifestsJs + reload.clientScript);
          })
          .catch((error: unknown) => {
            response.statusCode = 500;
            response.end(error instanceof Error ? error.message : String(error));
          });
      });

      devServer.middlewares.use(reload.path, (_req, res) => {
        reload.handle(_req, res as ConnectResponse);
      });

      let browserOpened = false;
      devServer.httpServer?.once('listening', () => {
        originRef.value = updateOriginWithActualPort(settings, devServer);
        const workbenchUrl = buildWorkbenchUrl({ ...settings, origin: originRef.value }, resolved);
        const shouldOpenBrowser =
          process.env.RSPFX_OPEN_BROWSER === '1'
            ? true
            : process.env.RSPFX_OPEN_BROWSER === '0'
              ? false
              : (resolved.dev.openBrowser ?? false);
        if (!browserOpened && workbenchUrl && shouldOpenBrowser) {
          browserOpened = true;
          openBrowser(workbenchUrl);
          logger.info(`Workbench: ${workbenchUrl}`);
        }
        {
          const bus = createHookBus(getPlugins(), { logger: logger.child({ phase: 'afterStart' }) });
          void bus.emitAfterStart({ url: originRef.value }).catch((e) => logger.warn(`afterStart hook failed: ${e instanceof Error ? e.message : String(e)}`));
        }
      });

      logger.success(`Manifest server running at ${settings.origin}/temp/manifests.js`);
    }
  };
}

// Alias for vite.config usage: import { rspfxViteDev } from '@mbsks/rspfx-plugin-dev/vite'
export const rspfxViteDev = rspfxDevPlugin;
// Generic alias
export const rspfxViteDevPlugin = rspfxDevPlugin;
