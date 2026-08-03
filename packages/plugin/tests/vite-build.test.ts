import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, afterAll, beforeAll } from 'vitest';
import { registerPlugin } from '@mbsks/rspfx-plugin-api';
import { rspfxVite } from '../src/vite.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/vite-proj', import.meta.url));

const MANIFEST_IDS = ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', '11111111-2222-3333-4444-555555555555'];

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

beforeAll(() => {
  rmRetry(FIXTURE);
  fs.mkdirSync(path.join(FIXTURE, 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(FIXTURE, 'package.json'),
    JSON.stringify({ name: 'vite-proj', version: '1.0.0' }, null, 2)
  );
  fs.writeFileSync(
    path.join(FIXTURE, 'config', 'serve.json'),
    JSON.stringify({ https: false })
  );
  fs.writeFileSync(
    path.join(FIXTURE, 'config', 'write-manifests.json'),
    JSON.stringify({ cdnBasePath: 'https://cdn.example.com/vite-proj' })
  );
  writeWebPart('hello', MANIFEST_IDS[0]);
  writeWebPart('goodbye', MANIFEST_IDS[1]);
});

afterAll(() => {
  rmRetry(FIXTURE);
});

describe('rspfxVite native build', () => {
  it('builds every bundle and assembles the release output via closeBundle', async () => {
    const captured: { before: boolean; after: { manifests: unknown[]; releaseDir: string } | null } =
      { before: false, after: null };
    registerPlugin({
      name: 'vite-hooks-test',
      releaseHooks: {
        beforeGenerate() {
          captured.before = true;
        },
        afterGenerate(ctx) {
          captured.after = { manifests: ctx.manifests, releaseDir: ctx.releaseDir };
        }
      }
    });

    const vite = await import('vite');
    await vite.build({
      configFile: false,
      root: FIXTURE,
      plugins: [
        rspfxVite({ projectRoot: FIXTURE, name: 'vite-proj', framework: 'vanilla', version: '1.0.0' })
      ],
      mode: 'production',
      logLevel: 'error'
    });

    const distDir = path.join(FIXTURE, 'dist');
    expect(fs.existsSync(path.join(distDir, 'hello.js'))).toBe(true);
    expect(fs.existsSync(path.join(distDir, 'goodbye.js'))).toBe(true);
    expect(fs.readFileSync(path.join(distDir, 'hello.js'), 'utf8')).toContain('define(');
    expect(fs.readFileSync(path.join(distDir, 'goodbye.js'), 'utf8')).toContain('define(');

    const releaseManifestsDir = path.join(FIXTURE, 'release', 'manifests');
    const manifestFiles = fs.readdirSync(releaseManifestsDir).sort();
    expect(manifestFiles).toEqual([
      `${MANIFEST_IDS[1]}.manifest.json`,
      `${MANIFEST_IDS[0]}.manifest.json`
    ]);
    for (const file of manifestFiles) {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(releaseManifestsDir, file), 'utf8')
      ) as { componentType: string; loaderConfig: { internalModuleBaseUrls: string[] } };
      expect(manifest.componentType).toBe('WebPart');
      expect(manifest.loaderConfig.internalModuleBaseUrls[0]).toBe(
        'https://cdn.example.com/vite-proj'
      );
    }

    expect(fs.existsSync(path.join(FIXTURE, 'release', 'assets', 'hello.js'))).toBe(true);
    expect(fs.existsSync(path.join(FIXTURE, 'release', 'assets', 'goodbye.js'))).toBe(true);

    expect(captured.before).toBe(true);
    expect(captured.after).not.toBeNull();
    expect(captured.after!.manifests).toHaveLength(2);
    expect(captured.after!.releaseDir).toBe(path.join(FIXTURE, 'release'));
  });
});
