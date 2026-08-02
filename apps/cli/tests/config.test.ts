import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveConfig, RSPFX_PLUGIN_OPTIONS } from '@mbsks/rspfx-core';
import { RspfxPlugin, rspfxVite, rspfxRsbuild } from '@mbsks/rspfx-plugin';
import { findRspfxPlugin, loadConfig } from '../src/config.js';
import { version } from '../src/version.js';
import { makeTmpDir, rmRf } from './helpers.js';

describe('findRspfxPlugin', () => {
  it('finds an RspfxPlugin instance and exposes resolved options', () => {
    const plugin = findRspfxPlugin({ plugins: [new RspfxPlugin({ name: 'my-proj', framework: 'react' })] });
    expect(plugin).toBeDefined();
    const config = resolveConfig(plugin![RSPFX_PLUGIN_OPTIONS]);
    expect(config.framework).toBe('react');
    expect(config.language).toBe('typescript');
    expect(config.spfxVersion).toBe('1.23');
    expect(config.dev.port).toBe(4321);
    expect(config.dev.https).toBe(true);
    expect(config.dev.workbench).toBe(true);
    expect(config.build.minify).toBe(true);
    expect(config.build.releaseDir).toBe('release');
  });

  it('passes version through to plugin options', () => {
    const plugin = findRspfxPlugin({ plugins: [new RspfxPlugin({ name: 'x', version: '2.3.4' })] });
    expect(plugin?.[RSPFX_PLUGIN_OPTIONS].version).toBe('2.3.4');
  });

  it('finds a rspfxVite plugin', () => {
    const plugin = findRspfxPlugin({ plugins: [rspfxVite({ name: 'vite-proj', dev: { port: 9999 } })] });
    expect(plugin).toBeDefined();
    expect(resolveConfig(plugin![RSPFX_PLUGIN_OPTIONS]).dev.port).toBe(9999);
  });

  it('finds a rspfxRsbuild plugin', () => {
    const plugin = findRspfxPlugin({ plugins: [rspfxRsbuild({ name: 'rsbuild-proj', build: { sourcemap: true } })] });
    expect(plugin).toBeDefined();
    expect(resolveConfig(plugin![RSPFX_PLUGIN_OPTIONS]).build.sourcemap).toBe(true);
  });

  it('returns undefined without an rspfx plugin', () => {
    expect(findRspfxPlugin({ plugins: [{ name: 'nope' }] })).toBeUndefined();
    expect(findRspfxPlugin({ module: {} })).toBeUndefined();
  });
});

describe('config loading', () => {
  it('loads rspack.config.ts and fills defaults via resolveConfig', async () => {
    const dir = makeTmpDir('config');
    fs.writeFileSync(
      path.join(dir, 'rspack.config.ts'),
      [
        'export default {',
        '  plugins: [{',
        "    [Symbol.for('@mbsks/rspfx/bundler-plugin')]: true,",
        "    [Symbol.for('@mbsks/rspfx/options')]: { name: 'my-proj', framework: 'react', version: '9.9.9' }",
        '  }]',
        '};'
      ].join('\n')
    );
    const loaded = await loadConfig(dir);
    expect(loaded.config.name).toBe('my-proj');
    expect(loaded.bundler).toBe('rspack');
    expect(loaded.configFile).toBe('rspack.config.ts');
    expect(loaded.config.framework).toBe('react');
    expect(loaded.config.language).toBe('typescript');
    expect(loaded.config.spfxVersion).toBe('1.23');
    expect(loaded.config.dev.port).toBe(4321);
    expect(loaded.config.dev.https).toBe(true);
    expect(loaded.config.dev.workbench).toBe(true);
    expect(loaded.config.build.minify).toBe(true);
    expect(loaded.config.build.releaseDir).toBe('release');
    expect(loaded.config.version).toBe('9.9.9');
    rmRf(dir);
  });

  it('loads vite.config.ts with a function default', async () => {
    const dir = makeTmpDir('config-vite');
    fs.writeFileSync(
      path.join(dir, 'vite.config.ts'),
      [
        'export default () => ({',
        "  plugins: [{ [Symbol.for('@mbsks/rspfx/bundler-plugin')]: true, [Symbol.for('@mbsks/rspfx/options')]: { name: 'vite-proj', dev: { port: 8888 }, build: { sourcemap: true } } }]",
        '});'
      ].join('\n')
    );
    const loaded = await loadConfig(dir);
    expect(loaded.bundler).toBe('vite');
    expect(loaded.configFile).toBe('vite.config.ts');
    expect(loaded.config.dev.port).toBe(8888);
    expect(loaded.config.build.sourcemap).toBe(true);
    rmRf(dir);
  });

  it('loads rsbuild.config.ts with a defineConfig-style object', async () => {
    const dir = makeTmpDir('config-rsbuild');
    fs.writeFileSync(
      path.join(dir, 'rsbuild.config.ts'),
      [
        'export default {',
        '  plugins: [{',
        "    [Symbol.for('@mbsks/rspfx/bundler-plugin')]: true,",
        "    [Symbol.for('@mbsks/rspfx/options')]: { name: 'rsbuild-proj', dev: { port: 7777 }, build: { outDir: 'custom-dist' } }",
        '  }]',
        '};'
      ].join('\n')
    );
    const loaded = await loadConfig(dir);
    expect(loaded.bundler).toBe('rsbuild');
    expect(loaded.configFile).toBe('rsbuild.config.ts');
    expect(loaded.config.dev.port).toBe(7777);
    expect(loaded.config.build.outDir).toBe('custom-dist');
    rmRf(dir);
  });

  it('throws when no config file exists', async () => {
    const dir = makeTmpDir('no-config');
    await expect(loadConfig(dir)).rejects.toThrow(/No rspack.config.ts \/ vite.config.ts \/ rsbuild.config.ts found/);
    rmRf(dir);
  });

  it('throws when the config has no rspfx plugin', async () => {
    const dir = makeTmpDir('no-plugin');
    fs.writeFileSync(path.join(dir, 'rspack.config.ts'), 'export default { plugins: [] };\n');
    await expect(loadConfig(dir)).rejects.toThrow(/No rspfx plugin found/);
    rmRf(dir);
  });

  it('prefers rspack.config.ts over vite.config.ts', async () => {
    const dir = makeTmpDir('prefer-rspack');
    fs.writeFileSync(path.join(dir, 'rspack.config.ts'), [
      'export default {',
      '  plugins: [{',
      "    [Symbol.for('@mbsks/rspfx/bundler-plugin')]: true,",
      "    [Symbol.for('@mbsks/rspfx/options')]: { name: 'rspack-proj' }",
      '  }]',
      '};'
    ].join('\n'));
    fs.writeFileSync(path.join(dir, 'vite.config.ts'), [
      'export default {',
      '  plugins: [{',
      "    [Symbol.for('@mbsks/rspfx/bundler-plugin')]: true,",
      "    [Symbol.for('@mbsks/rspfx/options')]: { name: 'vite-proj' }",
      '  }]',
      '};'
    ].join('\n'));
    const loaded = await loadConfig(dir);
    expect(loaded.bundler).toBe('rspack');
    expect(loaded.configFile).toBe('rspack.config.ts');
    rmRf(dir);
  });
});

describe('version', () => {
  it('matches apps/cli/package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    expect(version).toBe(pkg.version);
  });
});
