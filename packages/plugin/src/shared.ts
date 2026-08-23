import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { findSpDependencies } from '@mbsks/rspfx-manifest-generator';
import type { BundleEntry } from '@mbsks/rspfx-compiler-rspack';

export function amdName(entry: BundleEntry): string {
  return `${entry.componentIds[0]}_${entry.version}`;
}

export function computeUniqueName(entries: BundleEntry[]): string {
  if (entries.length === 1) {
    return amdName(entries[0]!);
  }
  const joined = entries.map(amdName).join('');
  return createHash('md5').update(joined).digest('hex');
}

export function collectExternals(
  root: string,
  projectExternals: string[],
  localizedResources: { name: string }[]
): string[] {
  return [
    ...new Set([
      ...findSpDependencies(root).keys(),
      ...projectExternals,
      ...localizedResources.map((resource) => resource.name)
    ])
  ];
}

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
}
