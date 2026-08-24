import fs from 'node:fs';
import path from 'node:path';
import { generateComponentManifests, type ComponentManifest } from '@mbsks/rspfx-manifest-generator';
import { createLogger, formatBytes } from '@mbsks/rspfx-diagnostics';
import { createHookBus, getPlugins } from '@mbsks/rspfx-plugin-api';
import type { RspfxConfig } from '@mbsks/rspfx-core';
import type { ReadProjectResult } from './project.js';

const logger = createLogger('rspfx');

export interface AssembleReleaseOptions {
  projectRoot: string;
  config: RspfxConfig;
  project: ReadProjectResult;
  externals: string[];
  outputFiles: string[];
  production: boolean;
  hookBus?: ReturnType<typeof createHookBus>;
}

export interface ReleaseOutput {
  manifests: ComponentManifest[];
  distDir: string;
  releaseDir: string;
  releaseManifestsDir: string;
  releaseAssetsDir: string;
  outputFiles: string[];
}

/**
 * Generates the production component manifests and assembles the release
 * output (`release/manifests/*.manifest.json` + `release/assets/*`) from the
 * compiled bundles in `dist/`.
 *
 * Shared by every entry point — `rspfx build` (CLI) and the native bundler
 * commands (`vite build` / `rspack build` / `rsbuild build` via the plugins)
 * — so all paths produce identical release output and fire the same
 * `releaseHooks`.
 */
export async function assembleRelease(opts: AssembleReleaseOptions): Promise<ReleaseOutput> {
  const config = opts.config;
  const project = opts.project;
  const distDir = path.join(opts.projectRoot, config.build.outDir ?? 'dist');
  const releaseDir = path.join(opts.projectRoot, config.build.releaseDir ?? 'release');
  const releaseManifestsDir = path.join(releaseDir, 'manifests');
  const releaseAssetsDir = path.join(releaseDir, 'assets');

  const cdnBasePath = readCdnBasePath(opts.projectRoot, config.paths?.configDir);
  const entryModuleIds: Record<string, string> = {};
  project.webParts.bundles.forEach((bundle, index) => {
    entryModuleIds[project.webParts.manifestIds[index]!] = bundle.bundleName;
  });

  {
    const bus = opts.hookBus ?? createHookBus(getPlugins(), { logger });
    const result = await bus.emitBeforeGenerate({ production: opts.production, webParts: project.webParts.entries as unknown as import('@mbsks/rspfx-plugin-api').WebPartEntry[] });
    if (!result.ok) throw result.error;
  }

  const manifests = await generateComponentManifests({
    projectRoot: opts.projectRoot,
    production: opts.production,
    baseUrls: { debug: '', release: cdnBasePath },
    packageVersion: project.webParts.packageVersion,
    bundleFiles: new Map(project.webParts.entries.map((entry) => [entry.name, `${entry.name}.js`])),
    externals: opts.externals,
    localizedResources: project.localizedResources.map((resource) => ({
      name: resource.name,
      locales: resource.files.map((file) => file.locale)
    })),
    webpartsDir: config.paths?.webpartsDir,
    extensionsDir: config.paths?.extensionsDir,
    librariesDir: config.paths?.librariesDir,
    entryModuleIds
  });

  fs.mkdirSync(releaseManifestsDir, { recursive: true });
  fs.mkdirSync(releaseAssetsDir, { recursive: true });
  for (const manifest of manifests) {
    const content = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(path.join(releaseManifestsDir, `${manifest.id}.manifest.json`), content);
  }

  for (const file of fs.readdirSync(distDir)) {
    if (file.endsWith('.map') || file.endsWith('.manifest.json')) {
      continue;
    }
    const source = path.join(distDir, file);
    if (!fs.statSync(source).isFile()) {
      continue;
    }
    fs.copyFileSync(source, path.join(releaseAssetsDir, file));
  }

  for (const file of opts.outputFiles) {
    const bundlePath = path.join(distDir, file);
    if (fs.existsSync(bundlePath)) {
      logger.info(`${file}: ${formatBytes(fs.statSync(bundlePath).size)}`);
    }
  }

  {
    const bus = opts.hookBus ?? createHookBus(getPlugins(), { logger });
    await bus.emitAfterGenerate({ manifests: manifests as unknown as import('@mbsks/rspfx-plugin-api').ComponentManifest[], releaseDir });
  }

  return {
    manifests,
    distDir,
    releaseDir,
    releaseManifestsDir,
    releaseAssetsDir,
    outputFiles: opts.outputFiles
  };
}

function readCdnBasePath(cwd: string, configDir = 'config'): string[] {
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(cwd, configDir, 'write-manifests.json'), 'utf8')
    ) as { cdnBasePath?: unknown };
    if (typeof raw.cdnBasePath === 'string' && raw.cdnBasePath.trim()) {
      let base = raw.cdnBasePath.trim();
      if (!base.endsWith('/')) base += '/';
      return [base];
    }
  } catch {
    // No write-manifests.json — fall back to empty release base urls.
  }
  return [];
}
