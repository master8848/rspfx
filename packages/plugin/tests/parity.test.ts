import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveConfig } from '@mbsks/rspfx-core';
import { build, type CompileContext } from '@mbsks/rspfx-compiler-rspack';
import { assembleRelease, readProject, type ReadProjectResult } from '@mbsks/rspfx-dev-runtime';
import { rspfxRsbuild, rspfxVite } from '../src/index.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/parity-proj', import.meta.url));

const ENTRY_IDS: Record<string, string> = {
  alpha: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  beta: '11111111-2222-3333-4444-555555555555'
};

function rmRetry(target: string): void {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      return;
    } catch {
      // Files may still be flushing; retry briefly.
    }
    const end = Date.now() + 100;
    while (Date.now() < end) {
      // busy-wait
    }
  }
}

function writeWebPart(name: string, id: string): void {
  const dir = path.join(FIXTURE, 'src', 'webparts', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${name}.manifest.json`),
    JSON.stringify({
      id,
      alias: `${name[0]!.toUpperCase()}${name.slice(1)}WebPart`,
      componentType: 'WebPart',
      version: '1.0.0',
      manifestVersion: 2,
      supportedPlatforms: ['Windows'],
      preconfiguredEntries: []
    })
  );
  fs.writeFileSync(
    path.join(dir, `${name}WebPart.ts`),
    `export default class ${name[0]!.toUpperCase()}${name.slice(1)}WebPart {\n  public render(): void {}\n}\n`
  );
}

function cleanOutput(): void {
  for (const dir of ['dist', 'release', '.rspfx', '.rspack-cache']) {
    rmRetry(path.join(FIXTURE, dir));
  }
}

function assertParityOutput(): void {
  const distDir = path.join(FIXTURE, 'dist');
  const distFiles = fs.readdirSync(distDir);
  for (const [name, id] of Object.entries(ENTRY_IDS)) {
    expect(distFiles).toContain(`${name}.js`);
    const content = fs.readFileSync(path.join(distDir, `${name}.js`), 'utf8');
    expect(content.startsWith(`(function(){window["__rspfx_script_url_${name}"]=`)).toBe(true);
    expect(content.includes(`define("${id}_1.0.0"`) || content.includes(`define('${id}_1.0.0'`)).toBe(true);
  }
  expect(distFiles.filter((file) => file.endsWith('.css'))).toEqual([]);
  const manifestFiles = fs.readdirSync(path.join(FIXTURE, 'release', 'manifests')).sort();
  expect(manifestFiles).toEqual(Object.values(ENTRY_IDS).sort().map((id) => `${id}.manifest.json`));
}

interface BundlerResult {
  assets: string[];
  manifests: Record<string, string>;
  stats: { moduleCounts?: Record<string, number> } | undefined;
}

function captureResult(): BundlerResult {
  const assets = fs.readdirSync(path.join(FIXTURE, 'release', 'assets')).sort();
  const manifests: Record<string, string> = {};
  for (const file of fs.readdirSync(path.join(FIXTURE, 'release', 'manifests'))) {
    if (!file.endsWith('.manifest.json')) {
      continue;
    }
    manifests[file] = fs.readFileSync(path.join(FIXTURE, 'release', 'manifests', file), 'utf8');
  }
  const statsPath = path.join(FIXTURE, '.rspfx', 'stats.json');
  let stats: BundlerResult['stats'];
  if (fs.existsSync(statsPath)) {
    stats = JSON.parse(fs.readFileSync(statsPath, 'utf8')) as BundlerResult['stats'];
  }
  return { assets, manifests, stats };
}

beforeAll(() => {
  rmRetry(FIXTURE);
  fs.mkdirSync(path.join(FIXTURE, 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(FIXTURE, 'package.json'),
    JSON.stringify({ name: 'parity-proj', version: '1.0.0' }, null, 2)
  );
  fs.writeFileSync(path.join(FIXTURE, 'config', 'serve.json'), JSON.stringify({ https: false }));
  fs.writeFileSync(
    path.join(FIXTURE, 'config', 'write-manifests.json'),
    JSON.stringify({ cdnBasePath: 'https://cdn.example.com/parity-proj' })
  );
  for (const [name, id] of Object.entries(ENTRY_IDS)) {
    writeWebPart(name, id);
  }
});

afterAll(() => {
  rmRetry(FIXTURE);
});

describe('bundler parity for the same fixture', () => {
  const results: Record<string, BundlerResult> = {};

  it('rspack build produces parity output', async () => {
    cleanOutput();
    const project = readProject(FIXTURE, undefined, '1.0.0');
    const ctx: CompileContext = {
      projectRoot: FIXTURE,
      framework: 'vanilla',
      fastRefresh: false,
      production: true,
      entries: project.webParts.entries,
      externals: [],
      aliases: {},
      build: { sourcemap: false, minify: false, splitChunks: false, outDir: 'dist', releaseDir: 'release' },
      serveMode: false
    };
    await build(ctx);
    await assembleRelease({
      projectRoot: FIXTURE,
      config: resolveConfig({ name: 'parity-proj', version: '1.0.0', framework: 'vanilla' }),
      project,
      externals: [],
      outputFiles: project.webParts.entries.map((entry) => `${entry.name}.js`),
      production: true
    });
    assertParityOutput();
    results.rspack = captureResult();
  });

  it('vite build produces parity output', async () => {
    cleanOutput();
    const vite = await import('vite');
    await vite.build({
      configFile: false,
      root: FIXTURE,
      plugins: [
        rspfxVite({ projectRoot: FIXTURE, name: 'parity-proj', framework: 'vanilla', version: '1.0.0' })
      ],
      mode: 'production',
      logLevel: 'error'
    });
    assertParityOutput();
    results.vite = captureResult();
  });

  it('rsbuild build produces parity output', async () => {
    cleanOutput();
    const { createRsbuild } = await import('@rsbuild/core');
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        root: FIXTURE,
        plugins: [
          rspfxRsbuild({ projectRoot: FIXTURE, name: 'parity-proj', framework: 'vanilla', version: '1.0.0' })
        ]
      }
    });
    const result = await rsbuild.build();
    await result.close();
    assertParityOutput();
    results.rsbuild = captureResult();
  });

  it('bundlers produce identical manifests, asset sets, and stats', () => {
    const rspack = results.rspack!;
    const vite = results.vite!;
    const rsbuild = results.rsbuild!;

    expect(vite.manifests).toEqual(rspack.manifests);
    expect(rsbuild.manifests).toEqual(rspack.manifests);
    expect(Object.keys(vite.manifests).sort()).toEqual(
      Object.values(ENTRY_IDS).sort().map((id) => `${id}.manifest.json`)
    );

    expect(vite.assets).toEqual(rspack.assets);
    expect(rsbuild.assets).toEqual(rspack.assets);
    expect(rspack.assets).toEqual(['alpha.js', 'beta.js']);

    for (const bundler of ['vite', 'rsbuild']) {
      const stats = results[bundler]!.stats;
      expect(stats).toBeDefined();
      const counts = stats!.moduleCounts ?? {};
      expect(Object.keys(counts).sort()).toEqual(['alpha', 'beta']);
      for (const value of Object.values(counts)) {
        expect(value).toBeGreaterThan(0);
      }
    }
  });
});
