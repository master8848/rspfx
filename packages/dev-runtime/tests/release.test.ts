import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, afterAll, beforeAll } from 'vitest';
import { resolveConfig, type RspfxConfig } from '@mbsks/rspfx-core';
import { readProject } from '../src/project.js';
import { assembleRelease } from '../src/release.js';

const FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'release-proj');

function makeConfig(overrides: Partial<RspfxConfig> = {}): RspfxConfig {
  return resolveConfig({
    name: 'release-proj',
    framework: 'vanilla',
    language: 'typescript',
    ...overrides
  });
}

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

beforeAll(() => {
  rmRetry(FIXTURE);
  fs.mkdirSync(path.join(FIXTURE, 'src', 'webparts', 'hello'), { recursive: true });
  fs.mkdirSync(path.join(FIXTURE, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(FIXTURE, 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(FIXTURE, 'package.json'),
    JSON.stringify({ name: 'release-proj', version: '2.3.0' }, null, 2)
  );
  fs.writeFileSync(
    path.join(FIXTURE, 'src', 'webparts', 'hello', 'hello.manifest.json'),
    JSON.stringify({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      alias: 'HelloWebPart',
      componentType: 'WebPart',
      version: '1.0.0',
      manifestVersion: 2,
      supportedPlatforms: ['Windows'],
      preconfiguredEntries: []
    })
  );
  fs.writeFileSync(
    path.join(FIXTURE, 'src', 'webparts', 'hello', 'helloWebPart.ts'),
    'export default class HelloWebPart {}\n'
  );
  fs.writeFileSync(path.join(FIXTURE, 'dist', 'hello.js'), 'define([], () => {});\n');
  fs.writeFileSync(path.join(FIXTURE, 'dist', 'hello.js.map'), '{}');
  fs.writeFileSync(
    path.join(FIXTURE, 'config', 'write-manifests.json'),
    JSON.stringify({ cdnBasePath: 'https://cdn.example.com/hello-proj' })
  );
});

afterAll(() => {
  rmRetry(FIXTURE);
});

describe('assembleRelease', () => {
  it('generates component manifests and copies bundles to release/assets', async () => {
    const config = makeConfig();
    const project = readProject(FIXTURE, config.paths, config.version);
    const output = await assembleRelease({
      projectRoot: FIXTURE,
      config,
      project,
      externals: [],
      outputFiles: ['hello.js'],
      production: true
    });

    const manifestPath = path.join(
      output.releaseManifestsDir,
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.manifest.json'
    );
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    expect(manifest.componentType).toBe('WebPart');
    expect(manifest.alias).toBe('HelloWebPart');

    expect(fs.readFileSync(path.join(output.releaseAssetsDir, 'hello.js'), 'utf8')).toContain(
      'define([], () => {});'
    );
    expect(fs.existsSync(path.join(output.releaseAssetsDir, 'hello.js.map'))).toBe(false);
  });

  it('uses the cdnBasePath from config/write-manifests.json as the release base url', async () => {
    const config = makeConfig();
    const project = readProject(FIXTURE, config.paths, config.version);
    const output = await assembleRelease({
      projectRoot: FIXTURE,
      config,
      project,
      externals: [],
      outputFiles: ['hello.js'],
      production: true
    });

    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(output.releaseManifestsDir, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.manifest.json'),
        'utf8'
      )
    ) as {
      loaderConfig: { internalModuleBaseUrls: string[] };
    };
    expect(manifest.loaderConfig.internalModuleBaseUrls[0]).toBe(
      'https://cdn.example.com/hello-proj'
    );
  });
});
