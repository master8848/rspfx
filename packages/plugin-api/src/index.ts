export type {
  AfterCompile,
  AfterGenerate,
  AfterPackage,
  AfterStart,
  AfterStats,
  BeforeCompile,
  BeforeGenerate,
  BeforePackage,
  BeforeStart,
  CompilerHooks,
  ComponentManifest,
  CompileContext,
  DevHooks,
  FrameworkId,
  FrameworkIdCore,
  FrameworkPreset,
  FrameworkPresetFor,
  FrameworkPresetUnion,
  FrameworkRegistry,
  FrameworkIdFromRegistry,
  FrameworkRspackContributions,
  FrameworkRsbuildContributions,
  FrameworkViteContributions,
  HookPhase,
  HookResult,
  OnHookError,
  PackageHooks,
  ReleaseHooks,
  RspackContribs,
  RsbuildContribs,
  ViteContribs,
  RspfxExtension,
  RspfxPatches,
  PatchRegistry,
  InternalHooks,
  SpfxVersionPatch,
  ComponentIdsPatch,
  ComponentIdEntry,
  SpDependencyEntry,
  SpDependencyMap,
  FindSpDependenciesArgs,
  GenerateComponentManifestsArgs,
  BuildAppManifestXmlArgs,
  Stats,
  WebPartEntry
} from './types.js';
export { definePlugin, HOOK_PHASES } from './types.js';
export { getPlugins, registerPlugin, __clearRegistryForTests } from './registry.js';
export { createRSPFX } from './instance.js';
export type { HookBus, RspfxInstance } from './instance.js';
export {
  createHookBus,
  sortedPlugins,
  composeHooks,
  getMergedSpfxVersions,
  getMergedComponentIds,
  applySpfxVersionPatches,
  createPatchedFunction
} from './hook-bus.js';
export { getPatchedSpfxVersions, getPatchedComponentIds, applyFindSpDependencies, applyGenerateComponentManifests, applyBuildAppManifestXml } from './patches.js';
export { setActivePlugins, getActivePlugins, getComponentIdsOverlay, clearPatchRegistryForTests } from './patch-registry.js';
