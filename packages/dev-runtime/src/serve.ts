import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { resolveConfig, type RspfxConfig } from '@mbsks/rspfx-core';
import { startDevServer, type StartDevServerResult } from '@mbsks/rspfx-compiler-rspack';
import { findSpDependencies } from '@mbsks/rspfx-manifest-generator';
import { ensureCertificates } from '@mbsks/rspfx-manifest-server';
import { createLogger, RspfxError } from '@mbsks/rspfx-diagnostics';
import { readProject, createCompileContext, loadFrameworkPreset, resolveContributionLoaders } from './project.js';
import { createRefreshRuntime } from './refresh.js';
import { createManifestRegenerator } from './manifests.js';
import { watchDependencyScope, fingerprintDependencyScope } from './deps-watch.js';
import type { ProjectServeConfigJson } from './project.js';
import { openBrowser } from './browser.js';
import { createReloadController } from './reload.js';

export interface DevRuntimeOptions {
  projectRoot: string;
  config: RspfxConfig;
  fastRefresh?: boolean;
  noBrowser?: boolean;
  port?: number;
  tenantDomain?: string;
}

export interface DevRuntimeHandle {
  url: string;
  port: number;
  workbenchUrl: string | undefined;
  close(): Promise<void>;
}

export interface ServeSettings {
  port: number;
  hostname: string;
  https: boolean;
  scheme: string;
  origin: string;
  tenantDomain: string | undefined;
  initialPage: string | undefined;
}

const logger = createLogger('rspfx');

/**
 * Resolves the dev server settings (port/hostname/https/tenant) from CLI
 * overrides → legacy config/serve.json → plugin options (`dev` section) →
 * built-in defaults. Shared by the Rspack dev server and the Vite plugin.
 */
export function resolveServeSettings(
  opts: Pick<DevRuntimeOptions, 'port' | 'tenantDomain' | 'config'>,
  serveJson?: ProjectServeConfigJson
): ServeSettings {
  const config = resolveConfig(opts.config);
  const port = opts.port ?? serveJson?.port ?? config.dev.port ?? 4321;
  const hostname = serveJson?.hostname ?? serveJson?.ipAddress ?? config.dev.hostname ?? 'localhost';
  const https = serveJson?.https ?? config.dev.https ?? true;
  const scheme = https ? 'https' : 'http';
  const tenantDomain =
    opts.tenantDomain ?? process.env.SPFX_SERVE_TENANT_DOMAIN ?? stripScheme(config.dev.tenantUrl);
  const initialPage = serveJson?.initialPage ?? config.dev.initialPage;
  return {
    port,
    hostname,
    https,
    scheme,
    origin: `${scheme}://${hostname}:${port}`,
    tenantDomain,
    initialPage
  };
}

/**
 * Builds the workbench URL with `debug=true&noredir=true&debugManifestsFile=…`.
 * Returns `undefined` when no tenant domain is available (SPFx workbench needs
 * one); warns in that case. Shared by the Rspack dev server and the Vite plugin.
 */
export function buildWorkbenchUrl(settings: ServeSettings, config: RspfxConfig): string | undefined {
  if (!(config.dev.workbench ?? true)) {
    return undefined;
  }
  const page =
    settings.initialPage?.replace(/\{tenantdomain\}/gi, settings.tenantDomain ?? '{tenantdomain}') ??
    (settings.tenantDomain ? `https://${settings.tenantDomain}/_layouts/15/workbench.aspx` : undefined);
  if (!page || page.includes('{tenantdomain}')) {
    if (page) {
      logger.warn(
        'No tenant domain configured. Set dev.tenantUrl in the rspfx plugin options, ' +
          'pass --tenant, or set the SPFX_SERVE_TENANT_DOMAIN environment variable.'
      );
    }
    return undefined;
  }
  const url = new URL(page);
  url.searchParams.set('debug', 'true');
  url.searchParams.set('noredir', 'true');
  url.searchParams.set('debugManifestsFile', `${settings.origin}/temp/manifests.js`);
  return url.toString();
}

export async function startServe(opts: DevRuntimeOptions): Promise<DevRuntimeHandle> {
  const config = resolveConfig(opts.config);
  const project = readProject(opts.projectRoot, config.paths, config.version);

  const settings = resolveServeSettings(opts, project.serveJson);
  const certsDir = path.join(os.homedir(), '.rspfx', 'certs');
  const certs = settings.https ? await ensureCertificates(certsDir) : undefined;

  const fastRefresh = opts.fastRefresh ?? config.dev.fastRefresh ?? false;
  const refreshRuntime = fastRefresh ? createRefreshRuntime(config.framework) : undefined;
  const reload = createReloadController();
  const frameworkPreset = await loadFrameworkPreset(config.framework, opts.projectRoot);
  const contributions = resolveContributionLoaders(
    frameworkPreset.preset.contributions({
      fastRefresh
    }) as Record<string, unknown>,
    frameworkPreset.moduleUrl
  );

  let origin = settings.origin;
  let server: StartDevServerResult | undefined;
  let closing = false;

  const startOnce = async (port?: number): Promise<StartDevServerResult> => {
    const currentProject = readProject(opts.projectRoot, config.paths, config.version);
    const ctx = createCompileContext({
      projectRoot: opts.projectRoot,
      config,
      entries: currentProject.webParts.entries,
      externals: [...findSpDependencies(opts.projectRoot).keys(), ...currentProject.externals],
      localizedAliases: currentProject.localizedAliases,
      localizedResources: currentProject.localizedResources,
      fastRefresh,
      production: false,
      serveMode: true,
      build: config.build
    });

    const entryModuleIds: Record<string, string> = {};
    currentProject.webParts.bundles.forEach((bundle, index) => {
      entryModuleIds[currentProject.webParts.manifestIds[index]!] = bundle.bundleName;
    });

    const regenerator = createManifestRegenerator({
      projectRoot: opts.projectRoot,
      production: false,
      origin: () => origin,
      packageVersion: currentProject.webParts.packageVersion,
      entries: currentProject.webParts.entries,
      externals: ctx.externals,
      localizedResources: currentProject.localizedResources,
      webpartsDir: config.paths?.webpartsDir,
      entryModuleIds,
      refreshRuntime,
      bundleUrlSuffix: () => `?t=${reload.current}`
    });
    await regenerator.regenerate();

    const nextServer = await startDevServer(
      { ...ctx, swcContributions: [contributions as Record<string, unknown>] },
      {
        port: port ?? settings.port,
        hostname: settings.hostname,
        https: settings.https,
        certs,
        hot: true,
        allowedHosts: 'all',
        routes: [
          {
            path: '/temp/manifests.js',
            handler: (req, res) => {
              const response = res as { setHeader(k: string, v: string): void; end(b: string): void };
              response.setHeader('Content-Type', 'application/javascript');
              response.setHeader('Cache-Control', 'no-store');
              response.end(regenerator.manifestsJs + reload.clientScript);
            }
          },
          {
            path: reload.path,
            handler: (req, res) => reload.handle(req, res as Parameters<typeof reload.handle>[1])
          }
        ],
        staticFolders: [{ path: opts.projectRoot, urlPrefix: '/' }]
      }
    );
    origin = `${settings.scheme}://${settings.hostname}:${nextServer.port}`;

    nextServer.onEmit(() => {
      void regenerator
        .regenerate()
        .then(() => reload.tick())
        .catch((error) => {
          logger.error(`Failed to regenerate manifests: ${error instanceof Error ? error.message : String(error)}`);
        });
    });
    await waitForFirstCompile(nextServer);
    await regenerator.regenerate();
    server = nextServer;
    return nextServer;
  };

  const initialServer = await startOnce();

  const workbenchUrl = buildWorkbenchUrl({ ...settings, origin }, config);

  if (workbenchUrl && (opts.noBrowser ?? !(config.dev.openBrowser ?? false)) === false) {
    openBrowser(workbenchUrl);
  }

  logger.success(`Manifest server running at ${origin}/temp/manifests.js`);
  if (workbenchUrl) {
    logger.info(`Workbench: ${workbenchUrl}`);
  }

  let restarting = false;
  let pendingFingerprint: string | undefined;
  const drainRestarts = async (): Promise<void> => {
    if (restarting || closing) {
      return;
    }
    while (pendingFingerprint !== undefined && server) {
      restarting = true;
      const fingerprint = pendingFingerprint;
      pendingFingerprint = undefined;
      const port = server.port;
      logger.info('Dependency scope changed — restarting dev server with updated externals.');
      try {
        await server.close();
        server = undefined;
        const nextServer = await startOnce(port);
        if (closing) {
          await nextServer.close();
          server = undefined;
          return;
        }
        logger.success(`Dev server restarted at ${origin}.`);
        // Changes that landed while restarting must not be missed.
        const current = fingerprintDependencyScope(opts.projectRoot);
        if (current !== fingerprint) {
          pendingFingerprint = current;
        }
      } catch (error) {
        logger.error(
          `Failed to restart dev server: ${error instanceof Error ? error.message : String(error)}. ` +
            'It will retry on the next dependency change.'
        );
      } finally {
        restarting = false;
      }
    }
  };

  const watcher = watchDependencyScope(opts.projectRoot, (fingerprint) => {
    pendingFingerprint = fingerprint;
    void drainRestarts();
  });

  return {
    url: origin,
    port: initialServer.port,
    workbenchUrl,
    close: async () => {
      closing = true;
      watcher.stop();
      refreshRuntime?.dispose();
      await server?.close();
    }
  };
}

export async function startPlayground(opts: DevRuntimeOptions): Promise<DevRuntimeHandle> {
  const config = resolveConfig(opts.config);
  const projectRoot = opts.projectRoot;
  const playgroundMain = path.join(projectRoot, 'playground', 'main.ts');
  const playgroundHtml = path.join(projectRoot, 'playground', 'index.html');
  if (!fsExists(playgroundMain)) {
    throw new RspfxError(
      'PLAYGROUND_MISSING',
      `Playground entry not found at ${playgroundMain}. Run "rspfx new" or add a playground/ folder.`
    );
  }
  const project = readProject(projectRoot, config.paths, config.version);
  const port = opts.port ?? config.playground?.port ?? 3000;
  const scheme = 'http';
  const hostname = config.dev.hostname ?? 'localhost';
  let origin = `${scheme}://${hostname}:${port}`;
  const frameworkPreset = await loadFrameworkPreset(config.framework, projectRoot);
  const contributions = resolveContributionLoaders(
    frameworkPreset.preset.contributions({ fastRefresh: true }) as Record<string, unknown>,
    frameworkPreset.moduleUrl
  );

  const ctx = createCompileContext({
    projectRoot,
    config,
    entries: [
      {
        name: 'playground',
        import: playgroundMain,
        componentIds: ['playground'],
        version: project.webParts.packageVersion
      }
    ],
    externals: [...findSpDependencies(projectRoot).keys(), ...project.externals],
    localizedAliases: project.localizedAliases,
    localizedResources: project.localizedResources,
    fastRefresh: true,
    production: false,
    serveMode: true,
    build: config.build
  });

  const server = await startDevServer(
    { ...ctx, swcContributions: [contributions as Record<string, unknown>] },
    {
      port,
      hostname,
      https: false,
      hot: true,
      allowedHosts: 'all',
      staticFolders: [{ path: projectRoot, urlPrefix: '/' }]
    }
  );
  origin = `${scheme}://${hostname}:${server.port}`;

  await waitForFirstCompile(server);

  const url = fsExists(playgroundHtml) ? `${origin}/playground/index.html` : origin;
  if ((opts.noBrowser ?? !(config.dev.openBrowser ?? false)) === false) {
    openBrowser(url);
  }
  logger.success(`Playground running at ${url}`);

  return {
    url,
    port: server.port,
    workbenchUrl: undefined,
    close: async () => {
      await server.close();
    }
  };
}

export function stripScheme(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  return url.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function waitForFirstCompile(server: StartDevServerResult): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new RspfxError('DEV_COMPILE_TIMEOUT', 'Initial compilation timed out after 120s')),
      120000
    );
    const unsubscribe = server.onEmit(() => {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    });
  });
}

function fsExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}
