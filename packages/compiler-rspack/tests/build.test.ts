import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { build, type CompileContext } from '../src/index.js';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'basic');
const OUT_DIR = 'dist';
const COMPONENT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const VERSION = '1.0.0';

function makeCtx(): CompileContext {
  return {
    projectRoot: FIXTURE,
    framework: 'vanilla',
    fastRefresh: false,
    production: true,
    entries: [
      {
        name: 'testwebpart',
        import: path.join(FIXTURE, 'src', 'index.ts'),
        componentIds: [COMPONENT_ID],
        version: VERSION
      }
    ],
    externals: ['@microsoft/sp-core-library'],
    aliases: { XxxWebPartStrings: path.join(FIXTURE, 'src', 'loc', 'en-us') },
    build: {
      sourcemap: false,
      minify: false,
      splitChunks: false,
      outDir: OUT_DIR,
      releaseDir: 'release'
    }
  };
}

const AMD_PREFIX = `define('${COMPONENT_ID}_${VERSION}', ["@microsoft/sp-core-library"],`;

describe('build', () => {
  beforeAll(() => {
    fs.rmSync(path.join(FIXTURE, OUT_DIR), { recursive: true, force: true });
    fs.rmSync(path.join(FIXTURE, '.rspack-cache'), { recursive: true, force: true });
  });

  it('emits dist/testwebpart.js with the exact SPFx AMD wrapper prefix', async () => {
    const result = await build(makeCtx());
    expect(result.outputFiles).toContain('testwebpart.js');

    const bundlePath = path.join(FIXTURE, OUT_DIR, 'testwebpart.js');
    expect(fs.existsSync(bundlePath)).toBe(true);
    const content = fs.readFileSync(bundlePath, 'utf8');
    expect(content.slice(0, 200).startsWith(AMD_PREFIX)).toBe(true);
  });

  it('inlines SCSS into the JS bundle (no external css files)', async () => {
    const result = await build(makeCtx());
    const bundlePath = path.join(FIXTURE, OUT_DIR, 'testwebpart.js');
    const content = fs.readFileSync(bundlePath, 'utf8');

    expect(result.outputFiles).not.toContain('testwebpart.css');
    expect(content).toContain('title');
    expect(content).toContain('.title{color:red}');
    expect(content).toContain('style-loader');
  });

  it('emits a hidden source map when build.sourcemap is true', async () => {
    const ctx = makeCtx();
    ctx.build.sourcemap = true;
    const result = await build(ctx);

    expect(result.outputFiles).toContain('testwebpart.js.map');
    const bundlePath = path.join(FIXTURE, OUT_DIR, 'testwebpart.js');
    const content = fs.readFileSync(bundlePath, 'utf8');
    expect(content).not.toContain('sourceMappingURL=testwebpart.js.map');
  });

  it('inlines HTML template imports as raw strings (asset/source)', async () => {
    const result = await build(makeCtx());
    const bundlePath = path.join(FIXTURE, OUT_DIR, 'testwebpart.js');
    const content = fs.readFileSync(bundlePath, 'utf8');

    expect(result.outputFiles).not.toContain('testwebpart.html');
    expect(content).toContain('Hello from an HTML template');
  });

  it('resolves localized string modules via config.json localizedResources aliases', async () => {
    const result = await build(makeCtx());
    const bundlePath = path.join(FIXTURE, OUT_DIR, 'testwebpart.js');
    const content = fs.readFileSync(bundlePath, 'utf8');

    expect(result.outputFiles).toContain('testwebpart.js');
    expect(content).toContain('Localized title');
    expect(content).toContain('Localized description');
  });

  it('emits a distinct AMD define name per entry in multi-bundle projects', async () => {
    const secondComponentId = 'bbbbbbbb-0000-0000-0000-000000000002';
    const ctx = makeCtx();
    ctx.entries.push({
      name: 'secondwebpart',
      import: path.join(FIXTURE, 'src', 'second.ts'),
      componentIds: [secondComponentId],
      version: VERSION
    });
    const result = await build(ctx);

    expect(result.outputFiles).toContain('secondwebpart.js');

    const firstBundle = fs.readFileSync(path.join(FIXTURE, OUT_DIR, 'testwebpart.js'), 'utf8');
    const secondBundle = fs.readFileSync(path.join(FIXTURE, OUT_DIR, 'secondwebpart.js'), 'utf8');
    expect(firstBundle.slice(0, 200).startsWith(AMD_PREFIX)).toBe(true);
    expect(secondBundle.slice(0, 200).startsWith(`define('${secondComponentId}_${VERSION}',`)).toBe(true);
    expect(firstBundle).not.toContain(`define('${secondComponentId}_${VERSION}',`);
    expect(secondBundle).not.toContain(AMD_PREFIX.slice(0, AMD_PREFIX.indexOf(',')));
  });
});
