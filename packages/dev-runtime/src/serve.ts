import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { resolveConfig, type RspfxConfig } from '@mbsks/rspfx-core';
import { startDevServer, type StartDevServerResult } from '@mbsks/rspfx-compiler-rspack';
import { findSpDependencies } from '@mbsks/rspfx-manifest-generator';
import { ensureCertificates, validateCustomHostname } from '@mbsks/rspfx-manifest-server';
import { createLogger, RspfxError } from '@mbsks/rspfx-diagnostics';
import { createHookBus, getPlugins } from '@mbsks/rspfx-plugin-api';
import { readProject, createCompileContext, loadFrameworkPreset, resolveContributionLoaders } from './project.js';
import { createRefreshRuntime } from './refresh.js';
import { createManifestRegenerator } from './manifests.js';
import { watchDependencyScope, fingerprintDependencyScope } from './deps-watch.js';
import type { ProjectServeConfigJson } from './project.js';
import { openBrowser } from './browser.js';
import { createReloadController } from './reload.js';
import { createMockSharePointApi } from './mock-api.js';
import { buildLocalPageHtml, readLocalPageComponents } from './local-page.js';
import { isPlatformOnlyModule } from '@mbsks/rspfx-sharepoint-runtime/platform-modules';

const require = createRequire(import.meta.url);

export type ServeMode = 'local' | 'sharepoint';

export interface DevRuntimeOptions {
  projectRoot: string;
  config: RspfxConfig;
  fastRefresh?: boolean;
  noBrowser?: boolean;
  port?: number;
  tenantDomain?: string;
  /** 'local' → local preview page at `/` (no SharePoint); 'sharepoint' → workbench. */
  mode?: ServeMode;
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
  const config = resolveConfig(opts.config as unknown as Partial<RspfxConfig> & Record<string, unknown>);
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
 * Resolves the serve mode: an explicit `--mode` wins; otherwise the presence
 * of a tenant domain (flag/env/config) selects the SharePoint workbench, and
 * everything else gets the local preview.
 */
export function resolveServeMode(
  opts: Pick<DevRuntimeOptions, 'mode' | 'config'>,
  tenantDomain: string | undefined
): ServeMode {
  if (opts.mode) {
    return opts.mode;
  }
  return tenantDomain ? 'sharepoint' : 'local';
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
  const config = resolveConfig(opts.config as unknown as Partial<RspfxConfig> & Record<string, unknown>);
  const project = readProject(opts.projectRoot, config.paths, config.version, config);

  const settings = resolveServeSettings(opts, project.serveJson);
  const mode = resolveServeMode(opts, settings.tenantDomain);
  // HookBus: beforeStart
  {
    const bus = createHookBus(getPlugins(), { logger: logger.child({ service: 'dev', phase: 'beforeStart' }) });
    const result = await bus.emitBeforeStart({ mode, port: settings.port });
    if (!result.ok) throw result.error;
  }
  const local = mode === 'local';
  const https = local ? false : settings.https;
  const scheme = https ? 'https' : 'http';
  const certsDir = path.join(os.homedir(), '.rspfx', 'certs');
  if (https && settings.hostname) {
    // Validate custom hostname before it reaches cert generation / SAN allowlist.
    // validateCustomHostname is the same allowlist used inside manifest-server
    // (localhost/127.0.0.1/::1 + single DNS/IP validated via ^[a-z0-9.-]+$,
    // rejects .. ; & " ' space : and .sharepoint suffix).
    validateCustomHostname(settings.hostname);
  }
  const certs = https ? await ensureCertificates(certsDir, settings.hostname) : undefined;

  const fastRefresh = opts.fastRefresh ?? config.dev.fastRefresh ?? false;
  const refreshRuntime = fastRefresh ? createRefreshRuntime(config.framework) : undefined;
  const reload = createReloadController();
  const frameworkPreset = await loadFrameworkPreset(config.framework, opts.projectRoot);
  const contributions = resolveContributionLoaders(
    ((frameworkPreset.preset.rspack
      ? frameworkPreset.preset.rspack({ fastRefresh })
      : frameworkPreset.preset.contributions?.({ fastRefresh })) ?? {}) as Record<string, unknown>,
    frameworkPreset.moduleUrl
  );

  let origin = `${scheme}://${settings.hostname}:${settings.port}`;
  let server: StartDevServerResult | undefined;
  let closing = false;

  const startOnce = async (port?: number): Promise<StartDevServerResult> => {
    const currentProject = readProject(opts.projectRoot, config.paths, config.version, config);
    const entries = local
      ? [...currentProject.webParts.entries, localRuntimeEntry(currentProject.webParts.packageVersion)]
      : currentProject.webParts.entries;
    const ctx = createCompileContext({
      projectRoot: opts.projectRoot,
      config,
      entries,
      externals: local
        ? [platformOnlyExternal]
        : [...findSpDependencies(opts.projectRoot).keys(), ...currentProject.externals, platformOnlyExternal],
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
      externals: ctx.externals.filter((external): external is string => typeof external === 'string'),
      localizedResources: currentProject.localizedResources,
      webpartsDir: config.paths?.webpartsDir,
      extensionsDir: config.paths?.extensionsDir,
      librariesDir: config.paths?.librariesDir,
      entryModuleIds,
      refreshRuntime,
      bundleUrlSuffix: () => `?t=${reload.current}`
    });
    await regenerator.regenerate();

    const mockApi = local
      ? createMockSharePointApi({ projectRoot: opts.projectRoot, origin: () => origin })
      : undefined;

    const routes: NonNullable<Parameters<typeof startDevServer>[1]['routes']> = [
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
    ];
    if (mockApi) {
      routes.push({ path: mockApi.path, handler: mockApi.handle });
    }
    if (local) {
      const pageHtml = buildLocalPageHtml({
        projectName: config.name,
        origin,
        components: readLocalPageComponents(currentProject.webParts.bundles, currentProject.webParts.packageVersion),
        reloadClientScript: reload.clientScript
      });
      routes.push({
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
      });
    }

    const nextServer = await startDevServer(
      { ...ctx, swcContributions: [contributions as Record<string, unknown>] },
      {
        port: port ?? settings.port,
        hostname: settings.hostname,
        https,
        certs,
        hot: true,
        allowedHosts: Array.from(
          new Set(
            ['.sharepoint.com', '.sharepoint-df.com', 'localhost', '127.0.0.1', '::1', settings.hostname].filter(
              Boolean
            ) as string[]
          )
        ),
        routes,
        staticFolders: [
          { path: path.join(opts.projectRoot, 'dist'), urlPrefix: '/dist' },
          { path: path.join(opts.projectRoot, 'temp'), urlPrefix: '/temp' },
          { path: path.join(opts.projectRoot, 'node_modules/@microsoft'), urlPrefix: '/node_modules/@microsoft' },
          { path: path.join(opts.projectRoot, 'assets'), urlPrefix: '/assets' }
        ]
      }
    );
    origin = `${scheme}://${settings.hostname}:${nextServer.port}`;

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

  const workbenchUrl = local ? undefined : buildWorkbenchUrl({ ...settings, https, scheme, origin }, config);
  const openTarget = workbenchUrl ?? (local ? `${origin}/` : undefined);

  // Browser open is once-only: initial dev server start only.
  // Never re-open on HMR, rebuild, or dependency-scope restart. `drainRestarts`
  // intentionally does NOT call `openBrowser`. `browserOpened` guards against
  // double-open if the server restarts or the `listening` event fires more than once.
  let browserOpened = false;
  if (!browserOpened && openTarget && (opts.noBrowser ?? !(config.dev.openBrowser ?? false)) === false) {
    browserOpened = true;
    openBrowser(openTarget);
  }

  // HookBus: afterStart
  {
    const bus = createHookBus(getPlugins(), { logger: logger.child({ service: 'dev', phase: 'afterStart' }) });
    await bus.emitAfterStart({ url: origin });
  }
  logger.trace('ws reload setup', { origin });

  if (local) {
    logger.success(`Local preview running at ${origin}/ — no SharePoint needed.`);
    if (settings.tenantDomain) {
      logger.info(
        `Pass --mode sharepoint (or remove dev.tenantUrl) to debug in the SharePoint workbench instead.`
      );
    }
  } else {
    logger.success(`Manifest server running at ${origin}/temp/manifests.js`);
    if (workbenchUrl) {
      logger.info(`Workbench: ${workbenchUrl}`);
    }
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
        // Intentionally no browser re-open here — once-only guarantee.
        // Changes that landed while restarting must not be missed.
        const current = fingerprintDependencyScope(opts.projectRoot, config.paths?.configDir);
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

  const watcher = watchDependencyScope(
    opts.projectRoot,
    (fingerprint) => {
      pendingFingerprint = fingerprint;
      void drainRestarts();
    },
    undefined,
    config.paths?.configDir,
  );

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

function localRuntimeEntry(packageVersion: string): {
  name: string;
  import: string;
  componentIds: string[];
  version: string;
} {
  return {
    name: 'local-runtime',
    import: require.resolve('@mbsks/rspfx-sharepoint-runtime/local-bootstrap'),
    componentIds: ['local-runtime'],
    version: packageVersion
  };
}

/**
 * The bundled `@microsoft/sp-*` packages reference internal modules that are
 * never published to npm — `@msinternal/*` (telemetry, feature flags,
 * safe-html) and the first-party MSAL builds used by sp-http-base's token
 * provider. sp-loader provides them on real tenants; the local preview
 * externalizes them as AMD dependencies that the preview bootstrap satisfies
 * with a no-op stand-in (see `PLATFORM_ONLY_PREFIXES` in sharepoint-runtime).
 */
function platformOnlyExternal(data: { request?: string }): string | undefined {
  return typeof data.request === 'string' && isPlatformOnlyModule(data.request)
    ? `amd ${data.request}`
    : undefined;
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
