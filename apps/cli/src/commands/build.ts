import fs from 'node:fs';
import path from 'node:path';
import { build } from '@mbsks/rspfx-compiler-rspack';
import { generateComponentManifests, findSpDependencies } from '@mbsks/rspfx-manifest-generator';
import type { ComponentManifest } from '@mbsks/rspfx-manifest-generator';
import { createLogger, formatBytes } from '@mbsks/rspfx-diagnostics';
import {
  readProject,
  loadFrameworkPreset,
  resolveContributionLoaders,
  createCompileContext
} from '@mbsks/rspfx-dev-runtime';
import { getPlugins } from '@mbsks/rspfx-plugin-api';
import { loadConfig } from '../config.js';

const logger = createLogger('rspfx');

export interface BuildOptions {
  minify?: boolean;
  sourcemap?: boolean;
}

export interface BuildOutput {
  stats: unknown;
  outputFiles: string[];
  manifests: ComponentManifest[];
  distDir: string;
  releaseDir: string;
  releaseManifestsDir: string;
  releaseAssetsDir: string;
}

export async function runBuild(cwd: string, opts: BuildOptions = {}): Promise<BuildOutput> {
  const config = await loadConfig(cwd);
  const project = readProject(cwd, config.paths);

  const frameworkPreset = await loadFrameworkPreset(config.framework, cwd);
  const contributions = resolveContributionLoaders(
    frameworkPreset.preset.contributions({ fastRefresh: false }) as Record<string, unknown>,
    frameworkPreset.moduleUrl
  );

  const ctx = createCompileContext({
    projectRoot: cwd,
    config,
    entries: project.webParts.entries,
    externals: [...findSpDependencies(cwd).keys(), ...project.externals],
    localizedAliases: project.localizedAliases,
    fastRefresh: false,
    production: true,
    serveMode: false,
    build: {
      ...config.build,
      ...(opts.minify !== undefined ? { minify: opts.minify } : {}),
      ...(opts.sourcemap !== undefined ? { sourcemap: opts.sourcemap } : {})
    }
  });
  ctx.swcContributions = [contributions as Record<string, unknown>];

  for (const plugin of getPlugins()) {
    plugin.compilerHooks?.beforeCompile?.(ctx);
  }

  const result = await build(ctx);

  for (const plugin of getPlugins()) {
    plugin.compilerHooks?.afterStats?.(result.stats);
  }

  const distDir = path.join(cwd, config.build.outDir ?? 'dist');
  const releaseDir = path.join(cwd, config.build.releaseDir ?? 'release');
  const releaseManifestsDir = path.join(releaseDir, 'manifests');
  const releaseAssetsDir = path.join(releaseDir, 'assets');

  const cdnBasePath = readCdnBasePath(cwd);
  const entryModuleIds: Record<string, string> = {};
  project.webParts.bundles.forEach((bundle, index) => {
    entryModuleIds[project.webParts.manifestIds[index]!] = bundle.bundleName;
  });
  const manifests = await generateComponentManifests({
    projectRoot: cwd,
    production: true,
    baseUrls: { debug: '', release: cdnBasePath },
    packageVersion: project.webParts.packageVersion,
    bundleFiles: new Map(project.webParts.entries.map((entry) => [entry.name, `${entry.name}.js`])),
    externals: ctx.externals,
    webpartsDir: config.paths?.webpartsDir,
    entryModuleIds
  });

  fs.mkdirSync(releaseManifestsDir, { recursive: true });
  fs.mkdirSync(releaseAssetsDir, { recursive: true });
  for (const manifest of manifests) {
    const content = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(path.join(releaseManifestsDir, `${manifest.id}.manifest.json`), content);
  }

  const packageFiles: { path: string; content: Uint8Array }[] = [];
  for (const file of fs.readdirSync(distDir)) {
    if (file.endsWith('.map') || file.endsWith('.manifest.json')) {
      continue;
    }
    const source = path.join(distDir, file);
    if (!fs.statSync(source).isFile()) {
      continue;
    }
    fs.copyFileSync(source, path.join(releaseAssetsDir, file));
    packageFiles.push({ path: file, content: fs.readFileSync(source) });
  }

  for (const file of result.outputFiles) {
    const bundlePath = path.join(distDir, file);
    if (fs.existsSync(bundlePath)) {
      logger.info(`${file}: ${formatBytes(fs.statSync(bundlePath).size)}`);
    }
  }

  for (const plugin of getPlugins()) {
    plugin.packageHooks?.beforePackage?.({ manifests, files: packageFiles });
  }

  return {
    stats: result.stats,
    outputFiles: result.outputFiles,
    manifests,
    distDir,
    releaseDir,
    releaseManifestsDir,
    releaseAssetsDir
  };
}

function readCdnBasePath(cwd: string): string[] {
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(cwd, 'config', 'write-manifests.json'), 'utf8')
    ) as { cdnBasePath?: unknown };
    if (typeof raw.cdnBasePath === 'string' && raw.cdnBasePath.trim()) {
      return [raw.cdnBasePath];
    }
  } catch {
    // No write-manifests.json — fall back to empty release base urls.
  }
  return [];
}
