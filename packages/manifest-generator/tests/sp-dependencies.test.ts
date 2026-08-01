import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { findSpDependencies } from '../src/index.js';

const fixtureRoot = fileURLToPath(new URL('./fixtures/proj', import.meta.url));

describe('findSpDependencies', () => {
  it('reads id, version and manifest path from node_modules dist manifests', () => {
    const dependencies = findSpDependencies(fixtureRoot);
    const core = dependencies.get('@microsoft/sp-core-library');
    expect(core).toBeDefined();
    expect(core!.id).toBe('7263c7d0-1d6a-45ec-8d85-d4d1d234171b');
    expect(core!.version).toBe('1.23.2');
    expect(core!.manifestPath).toMatch(
      /dist[\\/]7263c7d0-1d6a-45ec-8d85-d4d1d234171b\.manifest\.json$/
    );
  });

  it('falls back to the component ids table when a package has no dist manifest', () => {
    const dependencies = findSpDependencies(fixtureRoot);
    expect(dependencies.get('@microsoft/sp-loader')).toEqual({
      id: '1c6c9123-7aac-41f3-a376-3caea41ed83f',
      version: '1.23.2',
      manifestPath: ''
    });
  });

  it('derives the package name from the package.json name field', () => {
    const dependencies = findSpDependencies(fixtureRoot);
    const renamed = dependencies.get('@microsoft/sp-renamed-package');
    expect(renamed).toBeDefined();
    expect(renamed!.id).toBe('33333333-3333-4333-8333-333333333333');
    expect(renamed!.version).toBe('0.5.0');
  });

  it('skips packages without a dist manifest and without a table entry', () => {
    const dependencies = findSpDependencies(fixtureRoot);
    expect(dependencies.has('@microsoft/sp-odata-types')).toBe(false);
  });

  it('ignores dotfiles when scanning dist manifests', () => {
    const dependencies = findSpDependencies(fixtureRoot);
    expect(dependencies.get('@microsoft/sp-core-library')!.id).toBe(
      '7263c7d0-1d6a-45ec-8d85-d4d1d234171b'
    );
  });

  it('returns an empty map for a project without node_modules', () => {
    const missingRoot = fileURLToPath(new URL('./fixtures/nonexistent', import.meta.url));
    expect(findSpDependencies(missingRoot).size).toBe(0);
  });
});
