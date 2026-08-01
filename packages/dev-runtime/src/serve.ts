import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { resolveConfig, type RspfxConfig } from '@mbsks/rspfx-core';
import { startDevServer } from '@mbsks/rspfx-compiler-rspack';
import {
  collectDebugManifests,
  findSpDependencies,
  generateComponentManifests,
  generateManifestsJs
} from '@mbsks/rspfx-manifest-generator';
import { ensureCertificates } from '@mbsks/rspfx-manifest-server';
import { createLogger, RspfxError } from '@mbsks/rspfx-diagnostics';
import { readProject, createCompileContext, loadFrameworkPreset } from './project.js';
import { openBrowser } from './browser.js';

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

const logger = createLogger('rspfx');

export async function startServe(opts: DevRuntimeOptions): Promise<DevRuntimeHandle> {
  const config = resolveConfig(opts.config);
  const project = readProject(opts.projectRoot);

  const serveJson = project.serveJson;
  const port = opts.port ?? serveJson?.port ?? config.dev.port ?? 4321;
  const hostname = serveJson?.hostname ?? serveJson?.ipAddress ?? config.dev.hostname ?? 'localhost';
  const https = serveJson?.https ?? config.dev.https ?? true;
  const certsDir = path.join(os.homedir(), '.rspfx', 'certs');
  const certs = https ? await ensureCertificates(certsDir) : undefined;

  const scheme = https ? 'https' : 'http';
  let origin = `${scheme}://${hostname}:${port}`;
  const frameworkPreset = await loadFrameworkPreset(config.framework);
  const contributions = (
    frameworkPreset as { contributions(opts: { fastRefresh: boolean }): unknown }
  ).contributions({ fastRefresh: opts.fastRefresh ?? config.dev.fastRefresh ?? false });

  const ctx = createCompileContext({
    projectRoot: opts.projectRoot,
    config,
    entries: project.webParts.entries,
    externals: [...findSpDependencies(opts.projectRoot).keys(), ...project.externals],
    fastRefresh: opts.fastRefresh ?? config.dev.fastRefresh ?? false,
    production: false,
    serveMode: true,
    build: config.build
  });

  let manifestsJs = '';
  const regenerateManifests = async (): Promise<void> => {
    const manifests = await generateComponentManifests({
      projectRoot: opts.projectRoot,
      production: false,
      baseUrls: { debug: `${origin}/dist/`, release: [] },
      packageVersion: project.webParts.packageVersion,
      bundleFiles: new Map(project.webParts.entries.map((entry) => [entry.name, `${entry.name}.js`])),
      externals: ctx.externals
    });
    const debugManifests = await collectDebugManifests({
      projectRoot: opts.projectRoot,
      componentManifests: manifests,
      serverOrigin: origin
    });
    manifestsJs = await generateManifestsJs(debugManifests);
  };
  await regenerateManifests();

  const server = await startDevServer(
    { ...ctx, swcContributions: [contributions as Record<string, unknown>] },
    {
      port,
      hostname,
      https,
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
            response.end(manifestsJs);
          }
        }
      ],
      staticFolders: [{ path: opts.projectRoot, urlPrefix: '/' }]
    }
  );
  origin = `${scheme}://${hostname}:${server.port}`;

  const firstCompile = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new RspfxError('DEV_COMPILE_TIMEOUT', 'Initial compilation timed out after 120s')),
      120000
    );
    server.onEmit(() => {
      clearTimeout(timer);
      resolve();
    });
  });
  server.onEmit(() => {
    void regenerateManifests().catch((error) => {
      logger.error(`Failed to regenerate manifests: ${error instanceof Error ? error.message : String(error)}`);
    });
  });
  await firstCompile;
  await regenerateManifests();

  const tenantDomain =
    opts.tenantDomain ?? process.env.SPFX_SERVE_TENANT_DOMAIN ?? stripScheme(config.dev.tenantUrl);
  const initialPage = serveJson?.initialPage ?? config.dev.initialPage;
  let workbenchUrl: string | undefined;
  if (config.dev.workbench ?? true) {
    const page =
      initialPage?.replace(/\{tenantdomain\}/gi, tenantDomain ?? '{tenantdomain}') ??
      (tenantDomain ? `https://${tenantDomain}/_layouts/15/workbench.aspx` : undefined);
    if (page && !page.includes('{tenantdomain}')) {
      const url = new URL(page);
      url.searchParams.set('debug', 'true');
      url.searchParams.set('noredir', 'true');
      url.searchParams.set('debugManifestsFile', `${origin}/temp/manifests.js`);
      workbenchUrl = url.toString();
    } else if (page) {
      logger.warn(
        'No tenant domain configured. Set tenantUrl in rspfx.config.ts (dev section), ' +
          'pass --tenant, or set the SPFX_SERVE_TENANT_DOMAIN environment variable.'
      );
    }
  }

  if (workbenchUrl && (opts.noBrowser ?? !(config.dev.openBrowser ?? true)) === false) {
    openBrowser(workbenchUrl);
  }

  logger.success(`Manifest server running at ${origin}/temp/manifests.js`);
  if (workbenchUrl) {
    logger.info(`Workbench: ${workbenchUrl}`);
  }

  return {
    url: origin,
    port: server.port,
    workbenchUrl,
    close: async () => {
      await server.close();
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
  const project = readProject(projectRoot);
  const port = opts.port ?? config.playground?.port ?? 3000;
  const scheme = 'http';
  const hostname = config.dev.hostname ?? 'localhost';
  let origin = `${scheme}://${hostname}:${port}`;
  const frameworkPreset = await loadFrameworkPreset(config.framework);
  const contributions = (
    frameworkPreset as { contributions(opts: { fastRefresh: boolean }): unknown }
  ).contributions({ fastRefresh: true });

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

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new RspfxError('DEV_COMPILE_TIMEOUT', 'Initial compilation timed out after 120s')),
      120000
    );
    server.onEmit(() => {
      clearTimeout(timer);
      resolve();
    });
  });

  const url = fsExists(playgroundHtml) ? `${origin}/playground/index.html` : origin;
  if (opts.noBrowser ?? false === false) {
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

function stripScheme(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  return url.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function fsExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}
