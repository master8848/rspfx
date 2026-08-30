export const ALLOWED_DEFINE_KEYS = new Set(['DEBUG', 'DEPRECATED_UNIT_TEST', 'process.env.NODE_ENV']);

/**
 * Create the base define map for a production flag.
 * Mirrors config.ts / vite.ts / rsbuild.ts base defines.
 */
export function createBaseDefineMap(production: boolean): Record<string, string> {
  const mode = production ? 'production' : 'development';
  return {
    DEBUG: JSON.stringify(!production),
    DEPRECATED_UNIT_TEST: JSON.stringify(false),
    'process.env.NODE_ENV': JSON.stringify(mode)
  };
}

/**
 * Create the base define map from an explicit mode string (vite path).
 */
export function createBaseDefineMapFromMode(mode: 'development' | 'production'): Record<string, string> {
  return {
    DEBUG: JSON.stringify(mode === 'development'),
    DEPRECATED_UNIT_TEST: JSON.stringify(false),
    'process.env.NODE_ENV': JSON.stringify(mode)
  };
}

/**
 * Merge a contribution define map into base, filtering to ALLOWED_DEFINE_KEYS
 * and blocking RSPFX_ leakage. Optionally warns via `warn`.
 */
export function mergeDefineMap(
  base: Record<string, string>,
  contribDefine: Record<string, string> | undefined,
  warn?: (msg: string) => void
): Record<string, string> {
  if (!contribDefine) return { ...base };
  const out = { ...base };
  for (const [k, v] of Object.entries(contribDefine)) {
    if (k.startsWith('RSPFX_') || k.includes('RSPFx')) {
      warn?.(`Ignoring disallowed define key '${k}' (RSPFx leakage blocked)`);
      continue;
    }
    if (!ALLOWED_DEFINE_KEYS.has(k)) {
      warn?.(`Ignoring disallowed define key '${k}' (allowlist: ${[...ALLOWED_DEFINE_KEYS].join(', ')})`);
      continue;
    }
    out[k] = v;
  }
  return out;
}

/**
 * Convenience: createDefineMap handles both signatures:
 * - createDefineMap(production: boolean, contribDefine?, warn?)
 * - createDefineMap(base: Record<string,string>, contribDefine?, warn?)
 * - createDefineMap({ production, contribDefine, warn })
 */
export function createDefineMap(
  productionOrBase: boolean | Record<string, string> | { production: boolean; contribDefine?: Record<string, string>; warn?: (msg: string) => void },
  contribDefine?: Record<string, string>,
  warn?: (msg: string) => void
): Record<string, string> {
  if (typeof productionOrBase === 'object' && productionOrBase !== null && 'production' in productionOrBase) {
    const opts = productionOrBase as { production: boolean; contribDefine?: Record<string, string>; warn?: (msg: string) => void };
    const base = createBaseDefineMap(opts.production);
    return mergeDefineMap(base, opts.contribDefine, opts.warn);
  }
  if (typeof productionOrBase === 'boolean') {
    const base = createBaseDefineMap(productionOrBase);
    return mergeDefineMap(base, contribDefine, warn);
  }
  // base object
  return mergeDefineMap(productionOrBase as Record<string, string>, contribDefine, warn);
}
