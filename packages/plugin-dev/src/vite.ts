import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RSPFX_PLUGIN_MARKER, RSPFX_PLUGIN_OPTIONS, resolveConfig, type RspfxConfig } from '@mbsks/rspfx-core';
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

export interface RspfxViteDevPlugin {
  name: string;
  config(
    config: unknown,
    env: { command: 'build' | 'serve'; mode: string }
  ): Promise<Record<string, unknown>>;
  configureServer(server: unknown): void | Promise<void>;
  [key: symbol]: unknown;
}

function resolveTsconfigRaw(root: string, explicit?: string): Record<string, unknown> | undefined {
  if (explicit) {
    const explicitPath = path.isAbsolute(explicit) ? explicit : path.join(root, explicit);
    if (fs.existsSync(explicitPath)) {
      try {
        const raw = fs.readFileSync(explicitPath, 'utf8');
        const parsed = JSON.parse(raw) as { extends?: string | string[] };
        const ext = parsed.extends;
        const extendsStr = Array.isArray(ext) ? ext.join(' ') : typeof ext === 'string' ? ext : '';
        if (extendsStr.includes('rush-stack-compiler') || extendsStr.includes('rush-stack')) {
          const basePaths = [
            path.join(root, 'node_modules/@microsoft/rush-stack-compiler-4.1/includes/base.json'),
            path.join(root, 'node_modules/@microsoft/rush-stack-compiler-3.9/includes/base.json'),
            path.join(root, 'node_modules/@microsoft/rush-stack-compiler-4.7/includes/base.json')
          ];
          const hasBase = basePaths.some((p) => fs.existsSync(p));
          if (!hasBase) {
            try {
              const stubPath = path.join(root, 'node_modules/@microsoft/rush-stack-compiler-4.1/includes/base.json');
              if (!fs.existsSync(stubPath)) {
                fs.mkdirSync(path.dirname(stubPath), { recursive: true });
                fs.writeFileSync(stubPath, JSON.stringify({ compilerOptions: { target: 'es2017', module: 'esnext', jsx: 'react', esModuleInterop: true, allowSyntheticDefaultImports: true, moduleResolution: 'node', strict: true } }, null, 2));
              }
            } catch {}
            return { compilerOptions: { jsx: 'react', esModuleInterop: true, allowSyntheticDefaultImports: true, moduleResolution: 'node' } };
          }
        }
      } catch {}
      return undefined;
    }
  }
  const candidates = ['tsconfig.json', 'tsconfig.build.json', 'tsconfig.app.json'];
  try {
    const all = fs.readdirSync(root).filter((f) => f.startsWith('tsconfig') && f.endsWith('.json'));
    for (const f of all) if (!candidates.includes(f)) candidates.push(f);
  } catch {}
  for (const file of candidates) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    try {
      const raw = fs.readFileSync(full, 'utf8');
      const parsed = JSON.parse(raw) as { extends?: string | string[] };
      const ext = parsed.extends;
      const extendsStr = Array.isArray(ext) ? ext.join(' ') : typeof ext === 'string' ? ext : '';
      if (extendsStr.includes('rush-stack-compiler') || extendsStr.includes('rush-stack')) {
        const basePaths = [
          path.join(root, 'node_modules/@microsoft/rush-stack-compiler-4.1/includes/base.json'),
          path.join(root, 'node_modules/@microsoft/rush-stack-compiler-3.9/includes/base.json'),
          path.join(root, 'node_modules/@microsoft/rush-stack-compiler-4.7/includes/base.json')
        ];
        const hasBase = basePaths.some((p) => fs.existsSync(p));
        if (!hasBase) {
          // Ensure stub so builtin:vite-transform (oxc/rolldown) can resolve extends without throwing
          try {
            const stubPath = path.join(root, 'node_modules/@microsoft/rush-stack-compiler-4.1/includes/base.json');
            if (!fs.existsSync(stubPath)) {
              fs.mkdirSync(path.dirname(stubPath), { recursive: true });
              fs.writeFileSync(
                stubPath,
                JSON.stringify({ compilerOptions: { target: 'es2017', module: 'esnext', jsx: 'react', esModuleInterop: true, allowSyntheticDefaultImports: true, moduleResolution: 'node', strict: true } }, null, 2)
              );
              logger.warn(`Created stub ${path.relative(root, stubPath)} to satisfy tsconfig extends — run "rspfx migrate" to rewrite tsconfig to plain config.`);
            }
          } catch {}
          logger.warn(
            `tsconfig ${file} extends "${extendsStr}" but base not found — Vite will use fallback compilerOptions (jsx: react, esModuleInterop). Run "rspfx migrate" to rewrite tsconfig to plain config, or install @microsoft/rush-stack-compiler.`
          );
          return { compilerOptions: { jsx: 'react', esModuleInterop: true, allowSyntheticDefaultImports: true, moduleResolution: 'node' } };
        }
      }
    } catch {}
    break;
  }
  return undefined;
}

function checkNodeVersion(): void {
  const major = Number(process.versions.node.split('.')[0] ?? '0');
  if (major < 20) {
    logger.warn(`Node ${process.versions.node} is below RSPFx required >=20 (and Vite 8 requires >=20.19). Upgrade to Node 20+ or 22 LTS — see docs/compatibility.md. Vite may fail with syntax or ESM errors on Node 14.`);
  }
  const viteNote = 'Vite 8 (Rolldown) requires Node >=20.19 (ideally 22+). RSPFx supports Vite 5/7 on Node 20+, but Node 14 is unsupported.';
  if (major < 18) logger.warn(viteNote);
}

function checkViteConfigEsm(root: string): void {
  try {
    const pkgPath = path.join(root, 'package.json');
    const pkg = fs.existsSync(pkgPath) ? (JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { type?: string }) : {};
    const isEsmPkg = pkg.type === 'module';
    const candidates = ['vite.config.ts', 'vite.config.js'];
    for (const file of candidates) {
      const full = path.join(root, file);
      if (!fs.existsSync(full)) continue;
      const content = fs.readFileSync(full, 'utf8').slice(0, 2000);
      const hasEsm = /\bimport\s+.*from\b|\bexport\s+default\b/.test(content);
      if (hasEsm && !isEsmPkg) {
        logger.warn(
          `Vite config ${file} uses ESM syntax but package.json type is not "module" — Vite 8 with configLoader: 'native' will warn "ESM syntax in a file loaded as CommonJS". Rename to ${file.replace(/\.ts$|\.js$/, '.mjs')} or vite.config.mts, or add "type": "module" to package.json, or set VITE_CONFIG_NATIVE_IGNORE_WARNING=true. RSPFx CLI uses jiti so "rspfx dev" is unaffected, but direct "vite" may warn.`
        );
      }
    }
  } catch {}
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

      if (isServe && useHttps) {
        try {
          const certs = await ensureCertificates(path.join(os.homedir(), '.rspfx', 'certs'), settings.hostname);
          return {
            server: {
              host: settings.hostname,
              port: settings.port,
              https: { key: certs.key, cert: certs.cert },
              open: false
            },
            ...(tsconfigRaw ? { esbuild: { tsconfigRaw: JSON.stringify(tsconfigRaw) } } : {})
          } as Record<string, unknown>;
        } catch {
          return {
            server: {
              host: settings.hostname,
              port: settings.port,
              https: true as unknown as boolean,
              open: false
            },
            ...(tsconfigRaw ? { esbuild: { tsconfigRaw: JSON.stringify(tsconfigRaw) } } : {})
          } as Record<string, unknown>;
        }
      }

      return {
        server: {
          host: settings.hostname,
          port: settings.port,
          https: false as unknown as boolean,
          open: false
        },
        ...(tsconfigRaw ? { esbuild: { tsconfigRaw: JSON.stringify(tsconfigRaw) } } : {})
      } as Record<string, unknown>;
    },

    async configureServer(server) {
      const project = readProject(root, resolved.paths, resolved.version, resolved);
      const settings = resolveServeSettings({ config: resolved }, project.serveJson);
      const mode = resolveServeMode({ mode: undefined, config: resolved }, settings.tenantDomain);
      const reload = createReloadController();
      const originRef: { value: string } = { value: settings.origin };

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
