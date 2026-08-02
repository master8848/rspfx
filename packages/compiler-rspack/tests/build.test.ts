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

function bundleContent(result: { outputFiles: string[] }, fileName: string): string {
  expect(result.outputFiles).toContain(fileName);
  return fs.readFileSync(path.join(FIXTURE, OUT_DIR, fileName), 'utf8');
}

describe('build', () => {
  beforeAll(() => {
    fs.rmSync(path.join(FIXTURE, OUT_DIR), { recursive: true, force: true });
    fs.rmSync(path.join(FIXTURE, '.rspack-cache'), { recursive: true, force: true });
  });

  it('emits dist/testwebpart.js with the exact SPFx AMD wrapper prefix', async () => {
    const result = await build(makeCtx());
    const content = bundleContent(result, 'testwebpart.js');

    expect(content.startsWith(`(function(){window["__rspfx_script_url_testwebpart"]=`)).toBe(true);
    expect(content).toContain(AMD_PREFIX);
  });

  it('replaces the publicPath sentinel with a currentScript-based chunk base URL', async () => {
    const result = await build(makeCtx());
    const content = bundleContent(result, 'testwebpart.js');

    expect(content).not.toContain('__RSPFX_SPFX_PUBLIC_PATH__');
    expect(content).toContain('__rspfx_script_url_testwebpart');
    expect(content).toContain('.replace(/\\/[^/]*$/,"/")');
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

  it('externalizes localized string modules and emits <name>_<locale>.js loc files', async () => {
    const ctx = makeCtx();
    ctx.aliases = {};
    ctx.localizedResources = [
      {
        name: 'XxxWebPartStrings',
        files: [{ locale: 'en-us', path: path.join(FIXTURE, 'src', 'loc', 'en-us.js') }]
      }
    ];
    const result = await build(ctx);
    const content = bundleContent(result, 'testwebpart.js');

    expect(content).toContain('"XxxWebPartStrings"');
    expect(content).not.toContain('Localized title');

    expect(result.outputFiles).toContain('XxxWebPartStrings_en-us.js');
    const locFile = fs.readFileSync(path.join(FIXTURE, OUT_DIR, 'XxxWebPartStrings_en-us.js'), 'utf8');
    expect(locFile).toContain('Localized title');
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
    expect(firstBundle).toContain(AMD_PREFIX);
    expect(firstBundle).toContain('__rspfx_script_url_testwebpart');
    expect(secondBundle).toContain(`define('${secondComponentId}_${VERSION}',`);
    expect(firstBundle).not.toContain(`define('${secondComponentId}_${VERSION}',`);
    expect(secondBundle).not.toContain(AMD_PREFIX.slice(0, AMD_PREFIX.indexOf(',')));
    expect(firstBundle).not.toContain('__rspfx_script_url_secondwebpart');
    expect(secondBundle).not.toContain('__rspfx_script_url_testwebpart');
  });
});
