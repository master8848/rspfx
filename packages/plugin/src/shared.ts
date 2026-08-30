import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '@mbsks/rspfx-diagnostics';
// Re-export from build-core for backward compat — original logic moved to @mbsks/rspfx-build-core
export { amdName, computeUniqueName, cacheVersionHash } from '@mbsks/rspfx-build-core';
export { collectExternals, platformOnlyExternal } from '@mbsks/rspfx-build-core';
export { ALLOWED_DEFINE_KEYS, createDefineMap, createBaseDefineMap } from '@mbsks/rspfx-build-core';
export { hasPostcssConfig, tryResolve, inlineStyleCode } from '@mbsks/rspfx-build-core';
export { getDevtool, createSpfxOutput, SPFX_PUBLIC_PATH_SENTINEL } from '@mbsks/rspfx-build-core';

const logger = createLogger('rspfx');

export function writeStatsJson(root: string, moduleCounts: Record<string, number>): void {
  const file = path.join(root, '.rspfx', 'stats.json');
  let existing: Record<string, number> = {};
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as {
        moduleCounts?: Record<string, number>;
      };
      existing = parsed.moduleCounts ?? {};
    } catch {
      existing = {};
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ moduleCounts: { ...existing, ...moduleCounts } }));
  logger.child({ phase: 'afterStats' }).trace('writeStatsJson', { root, ...moduleCounts });
}
