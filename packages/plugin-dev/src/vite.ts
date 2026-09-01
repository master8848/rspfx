import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RSPFX_PLUGIN_MARKER, RSPFX_PLUGIN_OPTIONS, resolveConfig, type RspfxConfig } from '@mbsks/rspfx-core';
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
  loadFrameworkPreset,
  createMockSharePointApi,
  buildLocalPageHtml,
  readLocalPageComponents
} from '@mbsks/rspfx-dev-runtime';
import {
  resolveTsconfigRaw,
  checkNodeVersion,
  checkViteConfigEsm,
  updateOriginWithActualPort,
  contentTypeFor,
  safeDecodeURIComponent,
  hasDotSegment,
  corsMiddleware,
  tryResolveFromRoot,
  isSassInstalled,
  hasScssFiles,
  hasPostcssConfig,
  hasTailwindConfig,
  getTailwindVersion,
  detectSassAndWarn,
  detectTailwindAndWarn,
  tryLoadTailwindVitePlugin,
  ensureAndTrustCerts,
  ensureCertificates
} from '@mbsks/rspfx-dev-runtime/vite-shared';
import '@mbsks/rspfx-dev-runtime/vite-shared';
import { findSpDependencies } from '@mbsks/rspfx-manifest-generator';
import { createLogger } from '@mbsks/rspfx-diagnostics';
import type { RspfxPluginOptions } from './types.js';

const logger = createLogger('rspfx');

export interface ViteDevPluginOptions extends RspfxPluginOptions {}

export interface RspfxViteDevPlugin {
  name: string;
  config(
    config: unknown,
    env: { command: 'build' | 'serve'; mode: string }
  ): Promise<Record<string, unknown>>;
  configureServer(server: unknown): void | Promise<void>;
  [key: symbol]: unknown;
}



interface ConnectMiddlewareServer {
  middlewares: {
    use(handler: (req: unknown, res: unknown, next: () => void) => void): void;
    use(route: string, handler: (req: unknown, res: unknown, next?: () => void) => void): void;
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
    [RSPFX_PLUGIN_MARKER]: true as unknown as boolean,
    [RSPFX_PLUGIN_OPTIONS]: resolved as unknown as boolean,

    async config(_config, env) {
      checkNodeVersion();
      checkViteConfigEsm(root);
      const explicit = (resolved as unknown as { tsconfigPath?: string }).tsconfigPath ?? (resolved.build as unknown as { tsconfigPath?: string })?.tsconfigPath;
      const project = readProject(root, resolved.paths, resolved.version, resolved);
      const settings = resolveServeSettings({ config: resolved }, project.serveJson);
      const mode = resolveServeMode({ mode: undefined, config: resolved }, settings.tenantDomain);
      const isServe = env.command === 'serve';
      const useHttps = mode === 'sharepoint' ? settings.https : false;
      const tsconfigRaw = resolveTsconfigRaw(root, explicit);

      const VITE_BASE_EXTENSIONS = ['.mjs', '.js', '.mts', '.jsx', '.ts', '.tsx', '.json'];
      let viteContribs: { plugins?: unknown[]; esbuild?: Record<string, unknown>; define?: Record<string, string>; resolveExtensions?: string[] } | undefined;
      let fastRefresh = isServe && (process.env.RSPFX_FAST_REFRESH === '1' || (resolved.dev as unknown as { fastRefresh?: boolean })?.fastRefresh === true);
      if (fastRefresh) {
        try {
          const presetMod = await loadFrameworkPreset(resolved.framework, root);
          const preset = (presetMod as unknown as { preset: { vite?: (opts: { fastRefresh: boolean }) => { plugins?: unknown[]; esbuild?: Record<string, unknown>; define?: Record<string, string>; resolveExtensions?: string[] } } }).preset;
          if (preset?.vite) {
            viteContribs = preset.vite({ fastRefresh });
          }
        } catch (error) {
          logger.warn(
            `Framework preset for '${resolved.framework}' not available — fastRefresh disabled: ${error instanceof Error ? error.message : String(error)}`
          );
          viteContribs = undefined;
          fastRefresh = false;
        }
      }
      const viteMode: 'development' | 'production' =
        (process.env.RSPFX_VITE_MODE as 'development' | 'production' | undefined) ??
        (env.mode === 'development' || env.mode === 'production' ? (env.mode as 'development' | 'production') : isServe ? 'development' : 'production');
      const define: Record<string, string> = {
        DEBUG: JSON.stringify(viteMode === 'development'),
        DEPRECATED_UNIT_TEST: JSON.stringify(false),
        'process.env.NODE_ENV': JSON.stringify(viteMode)
      };
      if (viteContribs?.define) {
        const allowed = new Set(['DEBUG', 'DEPRECATED_UNIT_TEST', 'process.env.NODE_ENV']);
        for (const [k, v] of Object.entries(viteContribs.define)) {
          if (k.startsWith('RSPFX_') || k.includes('RSPFx')) {
            logger.warn(`Ignoring disallowed define key '${k}' from vite contributions (RSPFx leakage blocked)`);
            continue;
          }
          if (!allowed.has(k)) {
            logger.warn(`Ignoring disallowed define key '${k}' from vite contributions (allowlist: ${[...allowed].join(', ')})`);
            continue;
          }
          define[k] = v;
        }
      }
      const esbuild: Record<string, unknown> | undefined = tsconfigRaw
        ? { ...(viteContribs?.esbuild as Record<string, unknown> | undefined), tsconfigRaw: JSON.stringify(tsconfigRaw) }
        : (viteContribs?.esbuild as Record<string, unknown> | undefined);
      // CSS / SCSS / Tailwind detection — parity with plugin full + compiler-rspack
      const sassInstalled = detectSassAndWarn(root);
      const tailwindInfo = detectTailwindAndWarn(root);

      // Build plugin list — auto-inject @tailwindcss/vite for Tailwind v4 when needed
      const plugins: unknown[] = viteContribs?.plugins ? [...viteContribs.plugins] : [];
      if (tailwindInfo.hasTailwind && !tailwindInfo.hasPostcss && (tailwindInfo.major ?? 0) >= 4) {
        const hasExistingTailwindPlugin = plugins.some((p) => {
          try {
            const name = (p as { name?: string })?.name ?? '';
            return typeof name === 'string' && name.toLowerCase().includes('tailwind');
          } catch { return false; }
        });
        if (!hasExistingTailwindPlugin) {
          const tw = tryLoadTailwindVitePlugin(root);
          if (tw) {
            try {
              const instance = typeof tw === 'function' ? (tw as () => unknown)() : tw;
              if (instance) {
                plugins.unshift(instance);
                logger.info('Auto-injected @tailwindcss/vite plugin for Tailwind v4 (no postcss.config.* found).');
              }
            } catch (e) {
              logger.warn(`Failed to initialize @tailwindcss/vite plugin: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        }
      }

      const resolve =
        viteContribs?.resolveExtensions && viteContribs.resolveExtensions.length > 0
          ? { extensions: [...new Set([...VITE_BASE_EXTENSIONS, ...viteContribs.resolveExtensions])] }
          : undefined;

      // CSS modules: keep localsConvention:'asIs', scopeBehaviour:'local' — Vite applies
      // this only to *.module.* files (consistent with css-loader auto: /\.module\.\w+$/).
      // Regular .scss / .css remains global, .module.scss becomes local scoped.
      // preprocessorOptions.scss.api='modern' required for Dart Sass modern API (sass-loader parity).
      const css: Record<string, unknown> = {
        modules: { localsConvention: 'asIs' as const, scopeBehaviour: 'local' as const },
        ...(sassInstalled
          ? {
              preprocessorOptions: {
                scss: { api: 'modern' as const },
                sass: { api: 'modern' as const }
              }
            }
          : {})
      };
      if (isServe && useHttps) {
        const autoTrust = (resolved.dev as { autoTrust?: boolean | 'prompt' }).autoTrust;
        const certs = await ensureAndTrustCerts({ hostname: settings.hostname, autoTrust });
        return {
          css,
          define,
          ...(esbuild ? { esbuild } : {}),
          ...(plugins.length > 0 ? { plugins } : {}),
          ...(resolve ? { resolve } : {}),
          server: {
            host: settings.hostname,
            port: settings.port,
            https: { key: certs.key, cert: certs.cert },
            open: false
          }
        } as Record<string, unknown>;
      }

      return {
        css,
        define,
        ...(esbuild ? { esbuild } : {}),
        ...(plugins.length > 0 ? { plugins } : {}),
        ...(resolve ? { resolve } : {}),
        server: {
          host: settings.hostname,
          port: settings.port,
          https: false as unknown as boolean,
          open: false
        }
      } as Record<string, unknown>;
    },

    async configureServer(server) {
      const project = readProject(root, resolved.paths, resolved.version, resolved);
      const settings = resolveServeSettings({ config: resolved }, project.serveJson);
      const mode = resolveServeMode({ mode: undefined, config: resolved }, settings.tenantDomain);
      const reload = createReloadController();
      const originRef: { value: string } = { value: settings.origin };

      // Dist staleness warning — dev-only plugin does not build dist itself
      {
        const missing: string[] = [];
        for (const entry of project.webParts.entries) {
          const distFile = path.join(root, resolved.build?.outDir ?? 'dist', `${entry.name}.js`);
          if (!fs.existsSync(distFile)) missing.push(`${entry.name}.js`);
        }
        if (missing.length > 0) {
          logger.warn(
            `dist/*.js not found - run 'heft build' or 'rspfx build' to generate initial bundles, or use full plugin @mbsks/rspfx-plugin for integrated build (missing: ${missing.join(', ')})`
          );
        }
      }

      // Certs are already ensured in config() for sharepoint/https; this is best-effort refresh for configureServer-only consumers
      if (mode === 'sharepoint' && settings.https) {
        try {
          await ensureCertificates(path.join(os.homedir(), '.rspfx', 'certs'), settings.hostname);
        } catch {
          // config() already surfaced; best-effort
        }
      }

      // Framework preset — dynamic, peer optional (e.g. react may not be installed)
      let refreshRuntime: ReturnType<typeof createRefreshRuntime> | undefined;
      try {
        const fastRefresh = process.env.RSPFX_FAST_REFRESH === '1' || (resolved.dev as unknown as { fastRefresh?: boolean })?.fastRefresh === true;
        if (fastRefresh) {
          // loadFrameworkPreset handles missing package gracefully (returns empty preset with warn)
          await loadFrameworkPreset(resolved.framework, root);
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
        bundleUrlSuffix: () => `?t=${reload.current}`,
        syntheticManifests: project.webParts.syntheticManifests
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
      // CORS before all other handlers — SharePoint workbench iframe needs ACAO + private network.
      // Mirrors compiler-rspack/src/dev-server.ts allowlist logic via isAllowedOrigin.
      devServer.middlewares.use(corsMiddleware as unknown as (req: unknown, res: unknown, next: () => void) => void);
      devServer.watcher?.on('change', debounced);
      devServer.watcher?.on('add', debounced);
      devServer.watcher?.on('unlink', debounced);

      // Local preview mode (tenantDomain missing): serve / as local page + mock /_api
      if (mode === 'local') {
        try {
          const mockApi = createMockSharePointApi({ projectRoot: root, origin: () => originRef.value });
          devServer.middlewares.use(mockApi.path, mockApi.handle as unknown as (req: unknown, res: unknown, next?: () => void) => void);
        } catch (error) {
          logger.warn(`Failed to create mock API: ${error instanceof Error ? error.message : String(error)}`);
        }
        try {
          const getComponents = (): ReturnType<typeof readLocalPageComponents> => {
            const hasSynthetic = Boolean(project.webParts.syntheticManifests && project.webParts.syntheticManifests.length > 0);
            if (hasSynthetic) {
              return (project.webParts.syntheticManifests ?? []).map((meta) => ({
                id: meta.id,
                alias: meta.bundleName,
                bundleName: meta.bundleName,
                amdId: `${meta.id}_${project.webParts.packageVersion}`,
                componentType: 'WebPart' as const
              }));
            }
            try {
              return readLocalPageComponents(project.webParts.bundles, project.webParts.packageVersion);
            } catch {
              return [];
            }
          };
          devServer.middlewares.use('/', (req, res, next) => {
            const pathname = ((req as { url?: string }).url ?? '').split('?')[0] ?? '';
            if (pathname !== '/' && pathname !== '') {
              next?.();
              return;
            }
            // Build html per-request so origin reflects actual bound port
            const components = getComponents();
            const pageHtml = buildLocalPageHtml({
              projectName: resolved.name,
              origin: originRef.value,
              components,
              reloadClientScript: reload.clientScript
            });
            (res as ConnectResponse).setHeader('Content-Type', 'text/html; charset=utf-8');
            (res as ConnectResponse).setHeader('Cache-Control', 'no-store');
            (res as ConnectResponse).end(pageHtml);
          });
        } catch (error) {
          logger.warn(`Failed to create local preview page: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const localizedMap = new Map<string, string>();
      for (const resource of project.localizedResources) {
        for (const file of resource.files) {
          localizedMap.set(`${resource.name}_${file.locale}.js`, file.path);
        }
      }
      const distRoot = path.resolve(path.join(root, resolved.build?.outDir ?? 'dist'));
      const urlPrefix = '/dist';
      (devServer.middlewares as unknown as { use(route: string, handler: (req: unknown, res: unknown, next?: () => void) => void): void }).use(
        urlPrefix,
        (req, res, next) => {
          const { originalUrl, url } = req as { originalUrl?: string; url?: string };
          const requestUrl = originalUrl ?? url ?? '';
          if (!requestUrl.startsWith(urlPrefix)) {
            next?.();
            return;
          }
          const rawRelative = requestUrl.slice(urlPrefix.length).replace(/^\/+/, '').split('?')[0] ?? '';
          let effectiveRelative: string | null = safeDecodeURIComponent(rawRelative);
          if (effectiveRelative === null) {
            next?.();
            return;
          }
          if (hasDotSegment(effectiveRelative)) {
            next?.();
            return;
          }
          let current = effectiveRelative;
          for (let i = 0; i < 4; i++) {
            const nextDecoded = safeDecodeURIComponent(current);
            if (nextDecoded === null || nextDecoded === current) break;
            if (hasDotSegment(nextDecoded)) {
              next?.();
              return;
            }
            current = nextDecoded;
            effectiveRelative = current;
          }
          const localizedPath = localizedMap.get(effectiveRelative);
          if (localizedPath) {
            try {
              const content = fs.readFileSync(localizedPath, 'utf8');
              (res as ConnectResponse).setHeader('Content-Type', 'application/javascript');
              (res as ConnectResponse).setHeader('Cache-Control', 'no-store');
              (res as ConnectResponse).end(content);
              return;
            } catch {
              next?.();
              return;
            }
          }
          const file = path.resolve(distRoot, effectiveRelative);
          if (file !== distRoot && !file.startsWith(distRoot + path.sep)) {
            next?.();
            return;
          }
          fs.lstat(file, (err, stat) => {
            if (err || stat.isSymbolicLink() || !stat.isFile()) {
              next?.();
              return;
            }
            (res as ConnectResponse).setHeader('Content-Type', contentTypeFor(file));
            (res as ConnectResponse).setHeader('Cache-Control', 'no-store');
            fs.createReadStream(file).pipe(res as unknown as NodeJS.WritableStream);
          });
        }
      );

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
        const openTarget = workbenchUrl ?? (mode === 'local' ? `${originRef.value}/` : undefined);
        const shouldOpenBrowser =
          process.env.RSPFX_OPEN_BROWSER === '1'
            ? true
            : process.env.RSPFX_OPEN_BROWSER === '0'
              ? false
              : (resolved.dev.openBrowser ?? false);
        if (!browserOpened && openTarget && shouldOpenBrowser) {
          browserOpened = true;
          openBrowser(openTarget);
          if (workbenchUrl) logger.info(`Workbench: ${workbenchUrl}`);
          else logger.info(`Local preview: ${openTarget}`);
        }
        {
          const bus = createHookBus(getPlugins(), { logger: logger.child({ phase: 'afterStart' }) });
          void bus.emitAfterStart({ url: originRef.value }).catch((e) => logger.warn(`afterStart hook failed: ${e instanceof Error ? e.message : String(e)}`));
        }
      });

      if (mode === 'local') {
        logger.success(`Local preview running at ${settings.origin}/ — no SharePoint needed.`);
      } else {
        logger.success(`Manifest server running at ${settings.origin}/temp/manifests.js`);
        const wb = buildWorkbenchUrl(settings, resolved);
        if (wb) logger.info(`Workbench: ${wb}`);
      }
    }
  };
}

// Alias for vite.config usage: import { rspfxViteDev } from '@mbsks/rspfx-plugin-dev/vite'
export const rspfxViteDev = rspfxDevPlugin;
// Generic alias
export const rspfxViteDevPlugin = rspfxDevPlugin;
