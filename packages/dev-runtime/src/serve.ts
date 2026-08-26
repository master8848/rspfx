import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { resolveConfig, type RspfxConfig } from '@mbsks/rspfx-core';
import { startDevServer, type StartDevServerResult } from '@mbsks/rspfx-compiler-rspack';
import { findSpDependencies } from '@mbsks/rspfx-manifest-generator';
import { ensureCertificates, formatTrustInstructions, getCertStatus, isCertTrusted, validateCustomHostname } from '@mbsks/rspfx-manifest-server';
import { createLogger, RspfxError } from '@mbsks/rspfx-diagnostics';
import type { Logger } from '@mbsks/rspfx-diagnostics';
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
import { createStore } from './store.js';
import { createDevMachine } from './machine.js';
import { getDevtoolsScript } from './devtools.js';

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
  devtools?: boolean;
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

const defaultLogger = createLogger('rspfx');

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

export function resolveServeMode(
  opts: Pick<DevRuntimeOptions, 'mode' | 'config'>,
  tenantDomain: string | undefined
): ServeMode {
  if (opts.mode) {
    return opts.mode;
  }
  return tenantDomain ? 'sharepoint' : 'local';
}

export function buildWorkbenchUrl(settings: ServeSettings, config: RspfxConfig): string | undefined {
  if (!(config.dev.workbench ?? true)) {
    return undefined;
  }
  const page =
    settings.initialPage?.replace(/\{tenantdomain\}/gi, settings.tenantDomain ?? '{tenantdomain}') ??
    (settings.tenantDomain ? `https://${settings.tenantDomain}/_layouts/15/workbench.aspx` : undefined);
  if (!page || page.includes('{tenantdomain}')) {
    if (page) {
      defaultLogger.warn(
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

export async function startServe(
  opts: DevRuntimeOptions,
  deps?: { logger?: Logger; createStore?: typeof createStore; createMachine?: typeof createDevMachine }
): Promise<DevRuntimeHandle> {
  const logger = deps?.logger ?? defaultLogger;
  const config = resolveConfig(opts.config as unknown as Partial<RspfxConfig> & Record<string, unknown>);
  const project = readProject(opts.projectRoot, config.paths, config.version, config);

  const settings = resolveServeSettings(opts, project.serveJson);
  const mode = resolveServeMode(opts, settings.tenantDomain);
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
    validateCustomHostname(settings.hostname);
  }
  const preStatus = https ? await getCertStatus(certsDir, settings.hostname).catch(() => undefined) : undefined;
  const wasMissing = preStatus ? !preStatus.exists || !preStatus.valid : false;
  const certs = https ? await ensureCertificates(certsDir, settings.hostname) : undefined;
  if (https && certs) {
    if (wasMissing) {
      logger.warn(
        `Dev cert was missing or expiring and has been (re)generated in ${certsDir}. ` +
          `Browsers will block https://localhost:4321 until it is trusted — ${formatTrustInstructions(certsDir)}. ` +
          `See ${path.join(certsDir, 'cert.pem.trust.txt')} and run rspfx doctor to verify. ` +
          `Untrusted certs surface as CORS errors, NET::ERR_CERT_AUTHORITY_INVALID, or blank workbench.`
      );
    } else {
      try {
        const trusted = await isCertTrusted(path.join(certsDir, 'cert.pem'));
        if (trusted.trusted === false) {
          logger.warn(
            `Dev cert at ${path.join(certsDir, 'cert.pem')} is not trusted by the OS — ${trusted.detail}. ` +
              `SharePoint workbench will fail with CORS / NET::ERR_CERT_AUTHORITY_INVALID until trusted. ` +
              `${formatTrustInstructions(certsDir)} — then restart browser. Run rspfx doctor for details.`
          );
        } else if (trusted.trusted === 'unknown') {
          logger.info(
            `Dev cert trust status unknown — ${trusted.detail}. If workbench shows CORS or NET::ERR_CERT_AUTHORITY_INVALID, ${formatTrustInstructions(certsDir).toLowerCase()}. Run rspfx doctor.`
          );
        }
      } catch {}
    }
  }

  const fastRefresh = opts.fastRefresh ?? config.dev.fastRefresh ?? false;
  const devtools = opts.devtools ?? process.env.RSPFX_DEVTOOLS === '1' ? true : false;

  const store = (deps?.createStore ?? createStore)({
    mode,
    origin: `${scheme}://${settings.hostname}:${settings.port}`,
    tick: 0,
    status: 'idle',
    fastRefresh,
    framework: config.framework,
    devtools
  });

  const reload = createReloadController();
  reload.subscribe((tick) => {
    store.set({ tick });
  });

  const refreshRuntime = fastRefresh ? createRefreshRuntime(config.framework, { store }) : undefined;
  const frameworkPreset = await loadFrameworkPreset(config.framework, opts.projectRoot);
  const contributions = resolveContributionLoaders(
    ((frameworkPreset.preset.rspack
      ? frameworkPreset.preset.rspack({ fastRefresh })
      : frameworkPreset.preset.contributions?.({ fastRefresh })) ?? {}) as Record<string, unknown>,
    frameworkPreset.moduleUrl
  );

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
      origin: () => store.get().origin,
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
      ? createMockSharePointApi({ projectRoot: opts.projectRoot, origin: () => store.get().origin })
      : undefined;

    const devtoolsScript = getDevtoolsScript(store, regenerator, config.version ?? '0.0.0');

    const routes: NonNullable<Parameters<typeof startDevServer>[1]['routes']> = [
      {
        path: '/temp/manifests.js',
        handler: (req, res) => {
          const response = res as { setHeader(k: string, v: string): void; end(b: string): void };
          response.setHeader('Content-Type', 'application/javascript');
          response.setHeader('Cache-Control', 'no-store');
          let extra = '';
          if (devtools) {
            extra = `\n/* __RSPFX_DEVTOOLS__ ${store.get().tick} */\n`;
          }
          response.end(regenerator.manifestsJs + extra + reload.clientScript);
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
    if (devtools) {
      const { handler } = (() => {
        const dummy = getDevtoolsScript(store);
        void dummy;
        return { handler: (req: unknown, res: unknown) => {
          const response = res as { setHeader(k: string, v: string): void; end(b: string): void };
          response.setHeader('Content-Type', 'application/json');
          response.setHeader('Cache-Control', 'no-store');
          response.end(JSON.stringify({ tick: store.get().tick, origin: store.get().origin, status: store.get().status }));
        }};
      })();
      routes.push({ path: '/_rspfx/devtools.json', handler });
    }
    if (local) {
      const pageHtml = buildLocalPageHtml({
        projectName: config.name,
        origin: store.get().origin,
        components: readLocalPageComponents(currentProject.webParts.bundles, currentProject.webParts.packageVersion),
        reloadClientScript: reload.clientScript,
        devtoolsScript
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
    const nextOrigin = `${scheme}://${settings.hostname}:${nextServer.port}`;
    store.set({ origin: nextOrigin, status: 'running' });

    nextServer.onEmit(() => {
      void regenerator
        .regenerate()
        .then(() => {
          const shouldSuppress = fastRefresh && config.framework !== 'vanilla' && refreshRuntime?.preserved;
          if (!shouldSuppress) {
            reload.tick();
          } else {
            // still bump store tick without reload for HMR
            store.update((s) => ({ tick: s.tick + 1 }));
          }
        })
        .catch((error) => {
          logger.error(`Failed to regenerate manifests: ${error instanceof Error ? error.message : String(error)}`);
        });
    });
    await waitForFirstCompile(nextServer);
    await regenerator.regenerate();
    server = nextServer;
    return nextServer;
  };

  store.set({ status: 'starting' });
  const initialServer = await startOnce();

  const workbenchUrl = local ? undefined : buildWorkbenchUrl({ ...settings, https, scheme, origin: store.get().origin }, config);
  const openTarget = workbenchUrl ?? (local ? `${store.get().origin}/` : undefined);

  let browserOpened = false;
  if (!browserOpened && openTarget && (opts.noBrowser ?? !(config.dev.openBrowser ?? false)) === false) {
    browserOpened = true;
    openBrowser(openTarget);
  }

  {
    const bus = createHookBus(getPlugins(), { logger: logger.child({ service: 'dev', phase: 'afterStart' }) });
    await bus.emitAfterStart({ url: store.get().origin });
  }
  logger.trace('ws reload setup', { origin: store.get().origin });

  if (local) {
    logger.success(`Local preview running at ${store.get().origin}/ — no SharePoint needed.`);
    if (settings.tenantDomain) {
      logger.info(
        `Pass --mode sharepoint (or remove dev.tenantUrl) to debug in the SharePoint workbench instead.`
      );
    }
  } else {
    logger.success(`Manifest server running at ${store.get().origin}/temp/manifests.js`);
    if (workbenchUrl) {
      logger.info(`Workbench: ${workbenchUrl}`);
    }
  }

  let machine: ReturnType<typeof createDevMachine> | undefined;
  // lightweight state machine for dependency scope restarts
  {
    const createMachine = deps?.createMachine ?? createDevMachine;
    // We create machine that handles restart logic internally but also expose for close
    // For serve, we implement restart via manual handler to keep server reference

    // simple inline machine alternative: use createDevMachine but override startOnce to include server close logic
    const machineFingerprintOf = (): string => fingerprintDependencyScope(opts.projectRoot, config.paths?.configDir);
    let restarting = false;
    let pendingFingerprint: string | undefined;

    const drainRestarts = async (): Promise<void> => {
      if (restarting || closing) return;
      while (pendingFingerprint !== undefined && server) {
        restarting = true;
        const fingerprint = pendingFingerprint;
        pendingFingerprint = undefined;
        store.set({ status: 'restarting', fingerprint });
        const port = server.port;
        logger.info('Dependency scope changed — restarting dev server with updated externals.');
        try {
          await server.close();
          server = undefined;
          const nextServer = await startOnce(port);
          if (closing) {
            await nextServer.close();
            server = undefined;
            store.set({ status: 'closed' });
            restarting = false;
            return;
          }
          logger.success(`Dev server restarted at ${store.get().origin}.`);
          const current = machineFingerprintOf();
          if (current !== fingerprint) {
            pendingFingerprint = current;
          } else {
            store.set({ status: 'running' });
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
      if (pendingFingerprint === undefined && !closing) {
        store.set({ status: 'running' });
      }
    };

    machine = createMachine(store, {
      startOnce: async (port?: number) => {
        // not used for dependency restarts (handled via drainRestarts)
        return startOnce(port);
      },
      fingerprintOf: machineFingerprintOf,
      logger
    });

    const watcher = watchDependencyScope(
      opts.projectRoot,
      (fingerprint) => {
        pendingFingerprint = fingerprint;
        store.set({ fingerprint });
        machine?.send({ type: 'DEPENDENCY_CHANGED', fingerprint });
        void drainRestarts();
      },
      undefined,
      config.paths?.configDir
    );

    // attach watcher stop to machine dispose
    const originalClose = async (): Promise<void> => {
      closing = true;
      machine?.send({ type: 'CLOSE' });
      store.set({ status: 'closed' });
      watcher.stop();
      machine?.dispose();
      refreshRuntime?.dispose();
      await server?.close();
    };

    return {
      url: store.get().origin,
      port: initialServer.port,
      workbenchUrl,
      close: originalClose
    };
  }
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
