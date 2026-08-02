import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import {
  resolveConfig,
  RSPFX_PLUGIN_MARKER,
  RSPFX_PLUGIN_OPTIONS,
  type RspfxBundlerPluginLike
} from '@mbsks/rspfx-core';
import { findSpDependencies } from '@mbsks/rspfx-manifest-generator';
import { ensureCertificates } from '@mbsks/rspfx-manifest-server';
import {
  readProject,
  resolveServeSettings,
  buildWorkbenchUrl,
  createManifestRegenerator,
  createReloadController,
  openBrowser,
  type ServeSettings
} from '@mbsks/rspfx-dev-runtime';
import { createLogger, RspfxError } from '@mbsks/rspfx-diagnostics';
import type { BundleEntry } from '@mbsks/rspfx-compiler-rspack';
import type { RspfxPluginOptions } from './types.js';

const logger = createLogger('rspfx');

/**
 * Environment contract between the CLI and the Vite plugin:
 * - `RSPFX_VITE_ENTRY` — the single bundle to build (AMD output is per-entry:
 *   Rollup cannot give each entry its own `define('id', …)` in one config).
 * - `RSPFX_VITE_AMD_ID` — explicit AMD library id (`<componentId>_<version>`).
 * - `RSPFX_VITE_MODE` — `'development'` | `'production'`.
 */
export const VITE_ENV = {
  entry: 'RSPFX_VITE_ENTRY',
  amdId: 'RSPFX_VITE_AMD_ID',
  mode: 'RSPFX_VITE_MODE'
} as const;

export interface ViteRspfxPlugin extends RspfxBundlerPluginLike {
  name: 'rspfx';
  config(): Promise<Record<string, unknown>>;
  configureServer(server: unknown): void;
}

interface ViteBuildApi {
  build(options: Record<string, unknown>): Promise<unknown>;
}

interface ConnectMiddlewareServer {
  middlewares: {
    use(route: string, handler: (req: unknown, res: unknown) => void): void;
  };
  watcher?: { on(event: string, listener: (path: string) => void): unknown };
  httpServer?: { once(event: 'listening', listener: () => void): unknown };
}

interface ConnectResponse {
  setHeader(name: string, value: string): void;
  end(body: string): void;
  statusCode?: number;
}

/**
 * The Vite plugin. Use it in `vite.config.ts` with the same options object as
 * `RspfxPlugin`:
 *
 * ```ts
 * import { rspfxVite } from '@mbsks/rspfx-plugin';
 * export default {
 *   plugins: [rspfxVite({ name: 'my-app', framework: 'react', dev: { ... }, build: { ... } })]
 * };
 * ```
 *
 * - `rspfx build`/`rspfx package` spawn one `vite build` per web part bundle
 *   (env `RSPFX_VITE_ENTRY`/`RSPFX_VITE_AMD_ID`), then assemble manifests and
 *   release output as with Rspack.
 * - `rspfx dev` spawns `vite`; the plugin serves `/temp/manifests.js`, watches
 *   sources and rebuilds the AMD bundles to `dist/`, and opens the workbench.
 * - Running `vite build` directly builds the first discovered web part bundle.
 */
export function rspfxVite(options: RspfxPluginOptions): ViteRspfxPlugin {
  const { projectRoot, ...rest } = options;
  const root = projectRoot ?? process.cwd();
  const resolved = resolveConfig(rest);

  return {
    name: 'rspfx',
    [RSPFX_PLUGIN_MARKER]: true,
    [RSPFX_PLUGIN_OPTIONS]: resolved,

    async config() {
      const project = readProject(root, resolved.paths, resolved.version);
      const settings = resolveServeSettings({ config: resolved }, project.serveJson);
      const mode = process.env[VITE_ENV.mode] === 'development' ? 'development' : 'production';
      const entry = selectEntry(project.webParts.entries, process.env[VITE_ENV.entry]);
      const amdId = process.env[VITE_ENV.amdId] ?? `${entry.componentIds[0]}_${entry.version}`;
      const externals = collectExternals(root, project.externals, project.localizedResources);

      const certs = settings.https
        ? await ensureCertificates(path.join(os.homedir(), '.rspfx', 'certs'))
        : undefined;

      return {
        root,
        base: './',
        define: {
          DEBUG: JSON.stringify(mode === 'development'),
          DEPRECATED_UNIT_TEST: JSON.stringify(false),
          'process.env.NODE_ENV': JSON.stringify(mode)
        },
        server: {
          host: settings.hostname,
          port: settings.port,
          https: certs ? { key: certs.key, cert: certs.cert } : settings.https ? true : false,
          open: false
        },
        build: {
          outDir: resolved.build.outDir,
          emptyOutDir: false,
          rollupOptions: {
            input: { [entry.name]: entry.import },
            external: externals,
            output: {
              format: 'amd',
              amd: { id: amdId },
              entryFileNames: '[name].js',
              chunkFileNames: 'chunk.[name].js',
              assetFileNames: 'assets/[name][extname]',
              exports: 'named'
            }
          }
        }
      };
    },

    configureServer(server) {
      const project = readProject(root, resolved.paths, resolved.version);
      const settings = resolveServeSettings({ config: resolved }, project.serveJson);
      const reload = createReloadController();
      const originRef: { value: string } = { value: settings.origin };
      const entryModuleIds: Record<string, string> = {};
      project.webParts.bundles.forEach((bundle, index) => {
        entryModuleIds[project.webParts.manifestIds[index]!] = bundle.bundleName;
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
        entryModuleIds
      });

      const rebuildAll = async (): Promise<void> => {
        const vite = await importViteFrom(root);
        for (const entry of project.webParts.entries) {
          await withEnv(entry, async () => {
            await (vite as unknown as ViteBuildApi).build({
              configFile: false,
              root,
              logLevel: 'error',
              mode: 'development',
              minify: false,
              sourcemap: true
            });
          });
        }
        await regenerator.regenerate();
      };

      let timer: ReturnType<typeof setTimeout> | undefined;
      const scheduleRebuild = (): void => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          void rebuildAll().catch((error) => {
            logger.error(
              `Vite rebuild failed: ${error instanceof Error ? error.message : String(error)}`
            );
          });
        }, 300);
      };

      void rebuildAll().catch((error) => {
        logger.error(`Initial Vite build failed: ${error instanceof Error ? error.message : String(error)}`);
      });

      const devServer = server as ConnectMiddlewareServer;
      devServer.watcher?.on('change', scheduleRebuild);
      devServer.watcher?.on('add', scheduleRebuild);
      devServer.watcher?.on('unlink', scheduleRebuild);

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

      const workbenchUrl = buildWorkbenchUrl(settings, resolved);
      if (workbenchUrl && (resolved.dev.openBrowser ?? false)) {
        devServer.httpServer?.once('listening', () => {
          originRef.value = updateOriginWithActualPort(settings, devServer);
          openBrowser(workbenchUrl);
          logger.info(`Workbench: ${workbenchUrl}`);
        });
      }
      logger.success(`Manifest server running at ${settings.origin}/temp/manifests.js`);
    }
  };
}

function updateOriginWithActualPort(
  settings: ServeSettings,
  devServer: ConnectMiddlewareServer
): string {
  try {
    const address = (devServer.httpServer as { address(): unknown } | undefined)?.address();
    if (address && typeof address === 'object' && 'port' in address) {
      return `${settings.scheme}://${settings.hostname}:${(address as { port: number }).port}`;
    }
  } catch {
    // Fall back to the configured origin.
  }
  return settings.origin;
}

function selectEntry(
  entries: BundleEntry[],
  entryName: string | undefined
): BundleEntry {
  const entry = entryName
    ? entries.find((candidate) => candidate.name === entryName)
    : entries[0];
  if (!entry) {
    throw new RspfxError(
      'VITE_NO_ENTRY',
      entryName
        ? `No web part bundle "${entryName}" found. Discovered: ${entries.map((e) => e.name).join(', ') || 'none'}`
        : 'No web part bundles found. Check config/config.json or src/webparts/.'
    );
  }
  return entry;
}

function collectExternals(
  root: string,
  projectExternals: string[],
  localizedResources: { name: string }[]
): string[] {
  return [
    ...new Set([
      ...findSpDependencies(root).keys(),
      ...projectExternals,
      ...localizedResources.map((resource) => resource.name)
    ])
  ];
}

async function withEnv(entry: BundleEntry, fn: () => Promise<void>): Promise<void> {
  const previousEntry = process.env[VITE_ENV.entry];
  const previousAmdId = process.env[VITE_ENV.amdId];
  process.env[VITE_ENV.entry] = entry.name;
  process.env[VITE_ENV.amdId] = `${entry.componentIds[0]}_${entry.version}`;
  try {
    await fn();
  } finally {
    if (previousEntry === undefined) {
      delete process.env[VITE_ENV.entry];
    } else {
      process.env[VITE_ENV.entry] = previousEntry;
    }
    if (previousAmdId === undefined) {
      delete process.env[VITE_ENV.amdId];
    } else {
      process.env[VITE_ENV.amdId] = previousAmdId;
    }
  }
}

function importViteFrom(root: string): Promise<unknown> {
  let resolved: string;
  try {
    const requireFromProject = createRequire(pathToFileURL(path.join(root, 'package.json')).href);
    resolved = requireFromProject.resolve('vite');
  } catch (error) {
    throw new RspfxError(
      'VITE_NOT_FOUND',
      'Vite is not installed in this project. Add "vite" to devDependencies (rspfx dev/build use the project-local Vite).',
      error
    );
  }
  return import(pathToFileURL(resolved).href);
}
