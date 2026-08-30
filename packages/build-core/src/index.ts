export { amdName, computeUniqueName, cacheVersionHash, type BundleEntryLike, type CacheVersionInput } from './amd.js';
export { collectExternals, platformOnlyExternal } from './externals.js';
export { ALLOWED_DEFINE_KEYS, createBaseDefineMap, createBaseDefineMapFromMode, createDefineMap, mergeDefineMap } from './defines.js';
export { POSTCSS_CONFIG_FILES, tryResolve, hasPostcssConfig, hasPostcssConfigFile, inlineStyleCode } from './css.js';
export { SPFX_PUBLIC_PATH_SENTINEL, getDevtool, createSpfxOutput, type SpfxOutputOptions } from './output.js';
