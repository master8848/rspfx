import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, afterAll, beforeAll } from 'vitest';
import { rspack } from '@rspack/core';
import { RspfxPlugin, rspfxResolve } from '../src/index.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/rspack-proj', import.meta.url));

const MANIFEST_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

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
  const webpartDir = path.join(FIXTURE, 'src', 'webparts', 'hello');
  fs.mkdirSync(path.join(FIXTURE, 'config'), { recursive: true });
  fs.mkdirSync(webpartDir, { recursive: true });
  fs.writeFileSync(
    path.join(FIXTURE, 'package.json'),
    JSON.stringify({ name: 'rspack-proj', version: '1.0.0' }, null, 2)
  );
  fs.writeFileSync(
    path.join(FIXTURE, 'config', 'write-manifests.json'),
    JSON.stringify({ cdnBasePath: 'https://cdn.example.com/rspack-proj' })
  );
  fs.writeFileSync(
    path.join(webpartDir, 'hello.manifest.json'),
    JSON.stringify({
      id: MANIFEST_ID,
      alias: 'HelloWebPart',
      componentType: 'WebPart',
      version: '1.0.0',
      manifestVersion: 2,
      supportedPlatforms: ['Windows'],
      preconfiguredEntries: []
    })
  );
  fs.writeFileSync(
    path.join(webpartDir, 'helloWebPart.ts'),
    "import Hello from './components/Hello';\nexport default class HelloWebPart {\n  public render(): void {\n    console.log('hello from rspack', Hello);\n  }\n}\n"
  );
  fs.mkdirSync(path.join(webpartDir, 'components'), { recursive: true });
  fs.writeFileSync(
    path.join(webpartDir, 'components', 'Hello.tsx'),
    "export default function Hello() { return null; }\n"
  );
});

afterAll(() => {
  rmRetry(FIXTURE);
});

describe('RspfxPlugin native rspack build', () => {
  it('self-configures the compiler and assembles the release output', async () => {
    const compiler = rspack({
      mode: 'production',
      context: FIXTURE,
      resolve: rspfxResolve(FIXTURE),
      plugins: [
        new RspfxPlugin({ projectRoot: FIXTURE, name: 'rspack-proj', framework: 'vanilla', version: '1.0.0' })
      ]
    });

    try {
      const stats = await new Promise<{ hasErrors(): boolean; toString(): string }>((resolve, reject) => {
        compiler.run((error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result!);
          }
        });
      });
      expect(stats.hasErrors()).toBe(false);

      const bundle = fs.readFileSync(path.join(FIXTURE, 'dist', 'hello.js'), 'utf8');
      expect(bundle).toContain(`define("${MANIFEST_ID}_1.0.0"`);
      expect(bundle).toContain('hello from rspack');

      const manifest = JSON.parse(
        fs.readFileSync(
          path.join(FIXTURE, 'release', 'manifests', `${MANIFEST_ID}.manifest.json`),
          'utf8'
        )
      ) as { componentType: string; loaderConfig: { internalModuleBaseUrls: string[] } };
      expect(manifest.componentType).toBe('WebPart');
      expect(manifest.loaderConfig.internalModuleBaseUrls[0]).toBe(
        'https://cdn.example.com/rspack-proj/'
      );
      expect(fs.existsSync(path.join(FIXTURE, 'release', 'assets', 'hello.js'))).toBe(true);
    } finally {
      await new Promise<void>((resolve) => compiler.close(() => resolve()));
    }
  });
});
