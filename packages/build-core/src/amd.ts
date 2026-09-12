import { createHash } from 'node:crypto';

export interface BundleEntryLike {
  componentIds: string[];
  version: string;
  name?: string;
}

/** AMD library name `<componentId>_<version>` for a single entry. */
export function amdName(entry: BundleEntryLike): string {
  return `${entry.componentIds[0]}_${entry.version}`;
}

/** Unique name for webpack chunk loading — single entry uses amdName, multi-entry hashes. */
export function computeUniqueName(entries: BundleEntryLike[]): string {
  if (entries.length === 1) {
    return amdName(entries[0]!);
  }
  const joined = entries.map(amdName).join('');
  return createHash('md5').update(joined).digest('hex');
}

export interface CacheVersionInput {
  framework: string;
  version?: string;
  build: Pick<{ sourcemap?: unknown; minify?: unknown; splitChunks?: unknown; outDir?: unknown }, 'sourcemap' | 'minify' | 'splitChunks' | 'outDir'>;
}

/** Short hash for persistent cache busting (first 8 chars of md5). */
export function cacheVersionHash(input: CacheVersionInput): string {
  return createHash('md5').update(JSON.stringify(input)).digest('hex').slice(0, 8);
}
