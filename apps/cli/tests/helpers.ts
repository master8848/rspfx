import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { TemplateVars } from '@mbsks/rspfx-templates';

export function makeTmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rspfx-cli-${prefix}-`));
}

export function baseVars(overrides: Partial<TemplateVars> = {}): TemplateVars {
  return {
    name: 'hello',
    namePascal: 'Hello',
    nameCamel: 'hello',
    framework: 'vanilla',
    spfxVersion: '1.22',
    fluent: false,
    language: 'typescript',
    styling: 'scss',
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
