import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveConfig } from '@mbsks/rspfx-core';
import { build, type CompileContext } from '@mbsks/rspfx-compiler-rspack';
import { assembleRelease, readProject, type ReadProjectResult } from '@mbsks/rspfx-dev-runtime';
import { rspfxRsbuild, rspfxVite } from '../src/index.js';

// fixture uses fs.mkdtemp(os.tmpdir() + '/rspfx-parity-') for space-free tmpdir
let FIXTURE: string;

const ENTRY_IDS: Record<string, string> = {
  alpha: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  beta: '11111111-2222-3333-4444-555555555555',
  alphaExt: 'cccccccc-dddd-eeee-ffff-111111111111',
  betaExt: '22222222-3333-4444-5555-666666666666',
  gammaLib: 'dddddddd-4444-4555-8666-777777777777'
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

function writeExtension(name: string, id: string, extensionType: string): void {
  const dir = path.join(FIXTURE, 'src', 'extensions', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${name}.manifest.json`),
    JSON.stringify({
      id,
      alias: `${name[0]!.toUpperCase()}${name.slice(1)}Extension`,
      componentType: 'Extension',
      extensionType,
      version: '1.0.0',
      manifestVersion: 2,
      requiresCustomScript: false
    })
  );
  fs.writeFileSync(
    path.join(dir, `${name}${extensionType}.ts`),
    `export default class ${name[0]!.toUpperCase()}${name.slice(1)}${extensionType} {\n  public onInit(): Promise<void> { return Promise.resolve(); }\n}\n`
  );
}

function writeLibrary(name: string, id: string): void {
  const dir = path.join(FIXTURE, 'src', 'libraries', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${name}.manifest.json`),
    JSON.stringify({
      $schema: 'https://developer.microsoft.com/json-schemas/spfx/client-side-library-manifest.schema.json',
      id,
      alias: `${name[0]!.toUpperCase()}${name.slice(1)}Library`,
      componentType: 'Library',
      version: '1.0.0',
      manifestVersion: 2
    })
  );
  fs.writeFileSync(
    path.join(dir, `${name}Library.ts`),
    `export default class ${name[0]!.toUpperCase()}${name.slice(1)}Library {\n  public getName(): string { return '${name}'; }\n}\n`
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
  FIXTURE = fs.mkdtempSync(os.tmpdir() + '/rspfx-parity-');
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
  // Symlink repo node_modules so importViteFrom / importRsbuild can resolve from temp fixture (avoids VITE_NOT_FOUND)
  try {
    const repoNodeModules = path.join(process.cwd(), 'node_modules');
    if (fs.existsSync(repoNodeModules) && !fs.existsSync(path.join(FIXTURE, 'node_modules'))) {
      fs.symlinkSync(repoNodeModules, path.join(FIXTURE, 'node_modules'), 'dir');
    }
  } catch {}
  writeWebPart('alpha', ENTRY_IDS.alpha!);
  writeWebPart('beta', ENTRY_IDS.beta!);
  writeExtension('alphaExt', ENTRY_IDS.alphaExt!, 'ApplicationCustomizer');
  writeExtension('betaExt', ENTRY_IDS.betaExt!, 'FieldCustomizer');
  writeLibrary('gammaLib', ENTRY_IDS.gammaLib!);
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

    expect(vite).toBeDefined();
    expect(vite.manifests).toEqual(rspack.manifests);
    expect(rsbuild.manifests).toEqual(rspack.manifests);
    expect(Object.keys(vite.manifests).sort()).toEqual(
      Object.values(ENTRY_IDS).sort().map((id) => `${id}.manifest.json`)
    );

    expect(vite.assets).toEqual(rspack.assets);
    expect(rsbuild.assets).toEqual(rspack.assets);
    expect(rspack.assets).toEqual(Object.keys(ENTRY_IDS).sort().map((n) => `${n}.js`));

    const rsbuildStats = results.rsbuild!.stats;
    expect(rsbuildStats).toBeDefined();
    const counts = rsbuildStats!.moduleCounts ?? {};
    expect(Object.keys(counts).sort()).toEqual(Object.keys(ENTRY_IDS).sort());
    for (const value of Object.values(counts)) {
      expect(value).toBeGreaterThan(0);
    }
    expect(results.vite!.stats).toBeDefined();
    const vCounts = results.vite!.stats!.moduleCounts ?? {};
    expect(Object.keys(vCounts).sort()).toEqual(Object.keys(ENTRY_IDS).sort());
    for (const value of Object.values(vCounts)) {
      expect(value).toBeGreaterThan(0);
    }
  });

  it('produces byte-equal release manifests for extensions and libraries', () => {
    const rspack = results.rspack!;
    // Extension manifests retain extensionType; Library retains componentType Library
    const extManifest = JSON.parse(rspack.manifests[`${ENTRY_IDS.alphaExt!}.manifest.json`]!) as Record<string, unknown>;
    expect(extManifest.componentType).toBe('Extension');
    expect(extManifest.extensionType).toBe('ApplicationCustomizer');
    expect((extManifest.loaderConfig as Record<string, unknown>).entryModuleId).toBe('alphaExt');

    const fieldManifest = JSON.parse(rspack.manifests[`${ENTRY_IDS.betaExt!}.manifest.json`]!) as Record<string, unknown>;
    expect(fieldManifest.componentType).toBe('Extension');
    expect(fieldManifest.extensionType).toBe('FieldCustomizer');

    const libManifest = JSON.parse(rspack.manifests[`${ENTRY_IDS.gammaLib!}.manifest.json`]!) as Record<string, unknown>;
    expect(libManifest.componentType).toBe('Library');
    expect(libManifest.manifestVersion).toBe(2);
    expect((libManifest.loaderConfig as Record<string, unknown>).entryModuleId).toBe('gammaLib');
  });
});
