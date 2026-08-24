export type {
  BeforeCompile,
  BeforePackage,
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
  PackageHooks,
  ReleaseHooks,
  RspackContribs,
  RsbuildContribs,
  ViteContribs,
  RspfxExtension,
  Stats
} from './types.js';
export { composeHooks } from './types.js';
export { definePlugin, getPlugins, registerPlugin, __clearRegistryForTests } from './registry.js';
export { createRSPFX } from './instance.js';
export type { HookBus, RspfxInstance } from './instance.js';
