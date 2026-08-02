import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { version } from '../src/version.js';
import { makeTmpDir, rmRf } from './helpers.js';

describe('config loading', () => {
  it('loads rspfx.config.ts and fills defaults via resolveConfig', async () => {
    const dir = makeTmpDir('config');
    fs.writeFileSync(
      path.join(dir, 'rspfx.config.ts'),
      `export default { name: 'my-proj', framework: 'react' };\n`
    );
    const config = await loadConfig(dir);
    expect(config.name).toBe('my-proj');
    expect(config.framework).toBe('react');
    expect(config.language).toBe('typescript');
    expect(config.styling).toBe('scss');
    expect(config.spfxVersion).toBe('1.22');
    expect(config.dev.port).toBe(4321);
    expect(config.dev.https).toBe(true);
    expect(config.dev.workbench).toBe(true);
    expect(config.build.minify).toBe(true);
    expect(config.build.releaseDir).toBe('release');
    rmRf(dir);
  });

  it('loads rspfx.config.js', async () => {
    const dir = makeTmpDir('config-js');
    fs.writeFileSync(
      path.join(dir, 'rspfx.config.js'),
      `export default { name: 'js-proj', dev: { port: 9999 }, build: { sourcemap: true } };\n`
    );
    const config = await loadConfig(dir);
    expect(config.name).toBe('js-proj');
    expect(config.dev.port).toBe(9999);
    expect(config.build.sourcemap).toBe(true);
    rmRf(dir);
  });

  it('throws when no config file exists', async () => {
    const dir = makeTmpDir('no-config');
    await expect(loadConfig(dir)).rejects.toThrow(/No rspfx.config.ts found/);
    rmRf(dir);
  });
});

describe('version', () => {
  it('reads 0.0.1 from package.json', () => {
    expect(version).toBe('0.0.1');
  });
});
