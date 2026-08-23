import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPFX_DEFAULT_TARGET, SPFX_TARGETS } from '../src/versions.js';

describe('versions doc sync guard', () => {
  it('internal-api.md SpfxTarget union matches SPFX_TARGETS', () => {
    const docPath = path.join(process.cwd(), 'docs/internal-api.md');
    if (!fs.existsSync(docPath)) return;
    const content = fs.readFileSync(docPath, 'utf8');
    const union = SPFX_TARGETS.map((t) => `'${t}'`).join(' | ');
    expect(content).toContain(union);
  });

  it('SKILL.md spfx-version values match SPFX_TARGETS', () => {
    const skillPath = path.join(process.cwd(), 'skills/rspfx/SKILL.md');
    if (!fs.existsSync(skillPath)) return;
    const content = fs.readFileSync(skillPath, 'utf8');
    for (const target of SPFX_TARGETS) {
      expect(content).toContain(target);
    }
    expect(content).toContain(`default ${SPFX_DEFAULT_TARGET}`);
  });

  it('migrate script default version matches SPFX_DEFAULT_TARGET', () => {
    const migratePath = path.join(process.cwd(), 'scripts/migrate-to-rspfx.mjs');
    if (!fs.existsSync(migratePath)) return;
    const content = fs.readFileSync(migratePath, 'utf8');
    // migrate script should reference SPFX_DEFAULT_TARGET or contain the actual default value via dynamic read
    const hasDynamicRead = content.includes('SPFX_DEFAULT_TARGET') || content.includes('defaultSpfxVersion');
    expect(hasDynamicRead).toBe(true);
  });

  it('apps/cli README targets include SPFX_DEFAULT_TARGET', () => {
    const readmePath = path.join(process.cwd(), 'apps/cli/README.md');
    if (!fs.existsSync(readmePath)) return;
    const content = fs.readFileSync(readmePath, 'utf8');
    for (const target of SPFX_TARGETS) {
      expect(content).toContain(target);
    }
  });
});
