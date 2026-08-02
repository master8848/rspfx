import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scaffoldProject } from '@mbsks/rspfx-templates';
import { runDoctor } from '../src/commands/doctor.js';
import { runClean } from '../src/commands/clean.js';
import { baseVars, linkPluginPackage, makeTmpDir, rmRf } from './helpers.js';

describe('doctor', () => {
  it('passes all checks on a healthy fixture project', async () => {
    const dir = makeTmpDir('doctor');
    await scaffoldProject(baseVars(), dir);
    linkPluginPackage(dir);
    const result = await runDoctor(dir);
    const failed = result.checks.filter((check) => !check.ok);
    expect(failed).toEqual([]);
    expect(result.ok).toBe(true);
    rmRf(dir);
  });

  it('reports failures for a broken project', async () => {
    const dir = makeTmpDir('doctor-bad');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'bad', version: '1.0.0' }));
    const result = await runDoctor(dir);
    expect(result.ok).toBe(false);
    expect(result.checks.some((check) => check.name === 'project config loads (rspack.config.ts / vite.config.ts)' && !check.ok)).toBe(true);
    expect(result.checks.some((check) => check.name === 'web part bundles discovered' && !check.ok)).toBe(true);
    rmRf(dir);
  });
});

describe('clean', () => {
  it('removes build output directories but keeps sources', async () => {
    const dir = makeTmpDir('clean');
    await scaffoldProject(baseVars(), dir);
    fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'dist', 'hello.js'), 'define([]);');
    fs.mkdirSync(path.join(dir, 'release'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.rspfx'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'node_modules', '.cache'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'sharepoint', 'solution'), { recursive: true });

    const removed = await runClean(dir);
    expect(removed).toContain('dist');
    expect(removed).toContain('release');
    expect(removed).toContain('.rspfx');
    expect(removed).toContain('node_modules/.cache');
    expect(removed).toContain('sharepoint/solution');

    expect(fs.existsSync(path.join(dir, 'dist'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'release'))).toBe(false);
    expect(fs.existsSync(path.join(dir, '.rspfx'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'sharepoint', 'solution'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'src'))).toBe(true);
    rmRf(dir);
  });
});
