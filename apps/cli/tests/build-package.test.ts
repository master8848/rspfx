import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scaffoldProject } from '@mbsks/rspfx-templates';
import { validateSppkg } from '@mbsks/rspfx-sppkg-builder';
import { runBuild } from '../src/commands/build.js';
import { runPackage } from '../src/commands/package.js';
import { baseVars, makeTmpDir, rmRf } from './helpers.js';

const COMPONENT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

async function makeFixture(): Promise<string> {
  const dir = makeTmpDir('build');
  await scaffoldProject(baseVars(), dir);
  fs.writeFileSync(
    path.join(dir, 'src', 'webparts', 'hello', 'helloWebPart.ts'),
    `export default class HelloWebPart {
  public render(): void {
    document.title = 'hello';
  }
}
`
  );
  return dir;
}

describe('build', () => {
  it('compiles an AMD bundle, emits release manifests and copies assets', async () => {
    const dir = await makeFixture();
    const output = await runBuild(dir, {});

    expect(output.outputFiles).toContain('hello.js');

    const bundlePath = path.join(dir, 'dist', 'hello.js');
    expect(fs.existsSync(bundlePath)).toBe(true);
    const content = fs.readFileSync(bundlePath, 'utf8');
    expect(content).toContain('define(');
    expect(content).toContain(`${COMPONENT_ID}_1.0.0`);

    const manifestPath = path.join(dir, 'release', 'manifests', `${COMPONENT_ID}.manifest.json`);
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      id: string;
      loaderConfig: { internalModuleBaseUrls: string[]; entryModuleId: string; scriptResources: Record<string, unknown> };
    };
    expect(manifest.id).toBe(COMPONENT_ID);
    expect(manifest.loaderConfig.entryModuleId).toBe('hello');
    expect(manifest.loaderConfig.internalModuleBaseUrls).toEqual([]);
    expect(manifest.loaderConfig.scriptResources).toEqual({ hello: { type: 'path', path: 'hello.js' } });

    expect(fs.existsSync(path.join(dir, 'dist', `${COMPONENT_ID}.manifest.json`))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'release', 'assets', 'hello.js'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'release', 'assets', 'hello.js.map'))).toBe(false);
    rmRf(dir);
  });
});

describe('package', () => {
  it('packages a valid .sppkg with release manifests and assets', async () => {
    const dir = await makeFixture();
    await runBuild(dir, {});
    const result = await runPackage(dir, { build: false });

    expect(path.basename(result.outputPath)).toBe('hello.sppkg');
    expect(fs.existsSync(result.outputPath)).toBe(true);
    expect(result.zipEntries).toContain('AppManifest.xml');
    expect(result.zipEntries.some((entry) => /^feature_[0-9a-f-]+\.xml$/.test(entry))).toBe(true);
    expect(result.zipEntries).toContain('ClientSideAssets/hello.js');

    const validation = await validateSppkg(result.outputPath);
    expect(validation.errors).toEqual([]);
    expect(validation.ok).toBe(true);
    rmRf(dir);
  });
});
