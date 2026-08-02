import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fingerprintDependencyScope, watchDependencyScope } from '../src/deps-watch.js';

function makeProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rspfx-deps-watch-'));
  fs.mkdirSync(path.join(root, 'node_modules', '@microsoft'), { recursive: true });
  fs.mkdirSync(path.join(root, 'config'), { recursive: true });
  fs.writeFileSync(path.join(root, 'config', 'config.json'), '{}');
  return root;
}

function addSpPackage(root: string, name: string, mtimeMs?: number): void {
  const pkgDir = path.join(root, 'node_modules', '@microsoft', name);
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: `@microsoft/${name}` }));
  if (mtimeMs !== undefined) {
    const stamp = Math.floor(mtimeMs / 1000);
    fs.utimesSync(pkgDir, stamp, stamp);
  }
}

describe('fingerprintDependencyScope', () => {
  it('tracks @microsoft entries and config.json', () => {
    const root = makeProject();
    addSpPackage(root, 'sp-core-library', 1_000_000_000);
    addSpPackage(root, 'sp-webpart-base', 1_100_000_000);

    const fingerprint = fingerprintDependencyScope(root);
    expect(fingerprint).toContain('sp-core-library@');
    expect(fingerprint).toContain('sp-webpart-base@');
    expect(fingerprint).toContain('config.json@');
  });

  it('changes when a new sp package is installed', () => {
    const root = makeProject();
    addSpPackage(root, 'sp-core-library', 1_000_000_000);
    const before = fingerprintDependencyScope(root);

    addSpPackage(root, 'sp-component-base', 1_200_000_000);
    expect(fingerprintDependencyScope(root)).not.toBe(before);
  });

  it('changes when an sp package is upgraded (mtime) or removed', () => {
    const root = makeProject();
    addSpPackage(root, 'sp-core-library', 1_000_000_000);
    const before = fingerprintDependencyScope(root);

    addSpPackage(root, 'sp-core-library', 1_300_000_000);
    expect(fingerprintDependencyScope(root)).not.toBe(before);

    fs.rmSync(path.join(root, 'node_modules', '@microsoft', 'sp-core-library'), { recursive: true });
    expect(fingerprintDependencyScope(root)).not.toBe(before);
  });

  it('changes when config/config.json is edited', () => {
    const root = makeProject();
    const before = fingerprintDependencyScope(root);

    const configPath = path.join(root, 'config', 'config.json');
    fs.writeFileSync(configPath, '{"externals":{}}');
    const stamp = 1_500_000_000;
    fs.utimesSync(configPath, stamp, stamp);
    expect(fingerprintDependencyScope(root)).not.toBe(before);
  });

  it('handles a missing node_modules/@microsoft', () => {
    const root = makeProject();
    fs.rmSync(path.join(root, 'node_modules', '@microsoft'), { recursive: true, force: true });
    expect(fingerprintDependencyScope(root)).toContain('@microsoft@<missing>');

    addSpPackage(root, 'sp-core-library', 1_000_000_000);
    expect(fingerprintDependencyScope(root)).not.toContain('@microsoft@<missing>');
  });
});

describe('watchDependencyScope', () => {
  it('fires onChange when the scope changes and stays silent otherwise', async () => {
    const root = makeProject();
    addSpPackage(root, 'sp-core-library', 1_000_000_000);
    let changes = 0;
    const watcher = watchDependencyScope(root, () => changes++, 50);

    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 150));
      expect(changes).toBe(0);

      const changeFired = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('onChange not fired')), 3000);
        const poll = (): void => {
          if (changes > 0) {
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(poll, 10);
          }
        };
        poll();
      });
      addSpPackage(root, 'sp-component-base', 1_200_000_000);
      await changeFired;
      expect(changes).toBe(1);
    } finally {
      watcher.stop();
    }
  });

  it('stops firing after stop()', async () => {
    const root = makeProject();
    let changes = 0;
    const watcher = watchDependencyScope(root, () => changes++, 20);
    watcher.stop();

    addSpPackage(root, 'sp-core-library', 1_000_000_000);
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
    expect(changes).toBe(0);
  });
});
