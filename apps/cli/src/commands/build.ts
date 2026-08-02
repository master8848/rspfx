import fs from 'node:fs';
import path from 'node:path';
import { build } from '@mbsks/rspfx-compiler-rspack';
import { generateComponentManifests, findSpDependencies } from '@mbsks/rspfx-manifest-generator';
import type { ComponentManifest } from '@mbsks/rspfx-manifest-generator';
import { createLogger, formatBytes } from '@mbsks/rspfx-diagnostics';
import { readProject, loadFrameworkPreset, resolveContributionLoaders } from '@mbsks/rspfx-dev-runtime';
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
  const project = readProject(cwd);
  const externals = [...findSpDependencies(cwd).keys(), ...project.externals];

  const frameworkPreset = await loadFrameworkPreset(config.framework, cwd);
  const contributions = resolveContributionLoaders(
    frameworkPreset.preset.contributions({ fastRefresh: false }) as Record<string, unknown>,
    frameworkPreset.moduleUrl
  );

  const result = await build({
    projectRoot: cwd,
    framework: config.framework,
    fastRefresh: false,
    production: true,
    entries: project.webParts.entries,
    externals,
    aliases: project.localizedAliases,
    build: { ...config.build, minify: opts.minify, sourcemap: opts.sourcemap },
    swcContributions: [contributions as Record<string, unknown>]
  });

  const distDir = path.join(cwd, config.build.outDir ?? 'dist');
  const releaseDir = path.join(cwd, config.build.releaseDir ?? 'release');
  const releaseManifestsDir = path.join(releaseDir, 'manifests');
  const releaseAssetsDir = path.join(releaseDir, 'assets');

  const cdnBasePath = readCdnBasePath(cwd);
  const manifests = await generateComponentManifests({
    projectRoot: cwd,
    production: true,
    baseUrls: { debug: '', release: cdnBasePath },
    packageVersion: project.webParts.packageVersion,
    bundleFiles: new Map(project.webParts.entries.map((entry) => [entry.name, `${entry.name}.js`])),
    externals
  });

  fs.mkdirSync(releaseManifestsDir, { recursive: true });
  fs.mkdirSync(releaseAssetsDir, { recursive: true });
  for (const manifest of manifests) {
    const content = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(path.join(releaseManifestsDir, `${manifest.id}.manifest.json`), content);
  }

  fs.mkdirSync(releaseAssetsDir, { recursive: true });
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

  for (const file of result.outputFiles) {
    const bundlePath = path.join(distDir, file);
    if (fs.existsSync(bundlePath)) {
      logger.info(`${file}: ${formatBytes(fs.statSync(bundlePath).size)}`);
    }
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
