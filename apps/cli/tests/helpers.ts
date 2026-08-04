import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TemplateVars } from '@mbsks/rspfx-templates';

export function linkPluginPackage(dir: string): void {
  const nmDir = path.join(dir, 'node_modules', '@mbsks');
  fs.mkdirSync(nmDir, { recursive: true });
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  fs.symlinkSync(path.join(repoRoot, 'packages', 'plugin'), path.join(nmDir, 'rspfx-plugin'), 'dir');
}

export function makeTmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rspfx-cli-${prefix}-`));
}

export function baseVars(overrides: Partial<TemplateVars> = {}): TemplateVars {
  return {
    name: 'hello',
    namePascal: 'Hello',
    nameCamel: 'hello',
    componentType: 'webpart',
    framework: 'vanilla',
    spfxVersion: '1.23',
    fluent: false,
    language: 'typescript',
    componentId: 'aaaaaaaa-0000-0000-0000-000000000001',
    solutionId: 'bbbbbbbb-0000-0000-0000-000000000002',
    featureId: 'cccccccc-0000-0000-0000-000000000003',
    packageName: 'hello',
    packageVersion: '1.0.0',
    ...overrides
  };
}

export function rmRf(target: string): void {
  fs.rmSync(target, { recursive: true, force: true });
}
