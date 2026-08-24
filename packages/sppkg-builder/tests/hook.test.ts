import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildPackage } from '../src/index.js';
import { createHookBus } from '@mbsks/rspfx-plugin-api';
import { RspfxError, RspfxErrorCode } from '@mbsks/rspfx-diagnostics';

function makeTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rspfx-sppkg-hook-'));
}

function writeManifests(dir: string): void {
  fs.mkdirSync(path.join(dir, 'release', 'manifests'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'release', 'assets'), { recursive: true });
  const manifest = {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    alias: 'TestWebPart',
    componentType: 'WebPart',
    version: '1.0.0',
    manifestVersion: 2,
    loaderConfig: { internalModuleBaseUrls: [], entryModuleId: 'test', scriptResources: { test: { type: 'path', path: 'test.js' } } }
  };
  fs.writeFileSync(path.join(dir, 'release', 'manifests', 'test.manifest.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(dir, 'release', 'assets', 'test.js'), 'console.log("hello");');
  fs.mkdirSync(path.join(dir, 'config'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'config', 'package-solution.json'), JSON.stringify({
    solution: { name: 'test', id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff', version: '1.0.0.0' },
    paths: { zippedPackage: 'sharepoint/solution/test.sppkg' }
  }));
}

describe('buildPackage hooks', () => {
  let tmp: string;
  beforeAll(() => { tmp = makeTmp(); writeManifests(tmp); });
  afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('beforePackage returning new Map adds file to .sppkg', async () => {
    const bus = createHookBus([
      {
        name: 'adder',
        packageHooks: {
          beforePackage: ({ files }) => {
            const next = new Map(files);
            next.set('ClientSideAssets/extra.txt' as never, new Uint8Array(Buffer.from('extra')));
            return next;
          }
        }
      }
    ]);
    const result = await buildPackage({
      projectRoot: tmp,
      solutionConfigPath: 'config/package-solution.json',
      manifestsDir: 'release/manifests',
      assetsDir: 'release/assets',
      production: false,
      hookBus: bus
    });
    expect(result.zipEntries).toContain('ClientSideAssets/extra.txt');
    // Verify file content in debug dir?
    const extraPath = path.join(path.dirname(result.outputPath), 'debug', path.basename(result.outputPath, '.sppkg'), 'ClientSideAssets', 'extra.txt');
    // debug dir may have extra file
    // At least outputPath exists
    expect(fs.existsSync(result.outputPath)).toBe(true);
  });

  it('beforePackage returning Err aborts build', async () => {
    const err = new RspfxError(RspfxErrorCode.PACKAGE_VALIDATION, 'validation failed');
    const bus = createHookBus([
      { name: 'fail', packageHooks: { beforePackage: () => ({ ok: false, error: err } as never) } }
    ]);
    await expect(buildPackage({
      projectRoot: tmp,
      solutionConfigPath: 'config/package-solution.json',
      manifestsDir: 'release/manifests',
      assetsDir: 'release/assets',
      production: false,
      hookBus: bus
    })).rejects.toThrow(err);
  });
});
