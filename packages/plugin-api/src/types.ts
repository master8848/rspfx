import type { Result } from '@mbsks/rspfx-diagnostics';
import type { RspfxError, AggregateRspfxError } from '@mbsks/rspfx-diagnostics';
import type { RspfxConfig } from '@mbsks/rspfx-core';
import type { ZipPath } from '@mbsks/rspfx-core';

export type { Result } from '@mbsks/rspfx-diagnostics';

// Framework IDs - branded via core but redefined here for augmentation
export type FrameworkIdCore = 'vanilla' | 'react' | 'solid' | 'preact' | 'vue' | 'svelte';
export type FrameworkId = FrameworkIdCore | (string & { __custom?: never });

// Module augmentation point for custom frameworks
export interface FrameworkRegistry {}

export type FrameworkIdFromRegistry = keyof FrameworkRegistry extends never
  ? FrameworkId
  : keyof FrameworkRegistry & FrameworkId;

// Minimal RuleSetRule type without importing @rspack/core (keep build light)
export type RuleSetRule = {
  test?: RegExp;
  use?: unknown;
  loader?: string;
  options?: Record<string, unknown>;
  exclude?: RegExp;
  type?: string;
  [key: string]: unknown;
};

export interface RspackContribs {
  rules?: RuleSetRule[];
  plugins?: Array<unknown>;
  resolve?: { alias?: Record<string, string>; extensions?: string[] };
  swc?: { jsc?: Record<string, unknown> };
  define?: Record<string, string>;
  moduleTest?: { test?: RegExp; type?: string };
}

// Keep old name as alias for backward compat
export type FrameworkRspackContributions = RspackContribs;

export interface FrameworkViteContributions {
  plugins?: Array<unknown>;
  esbuild?: Record<string, unknown>;
  resolveExtensions?: string[];
  define?: Record<string, string>;
}
export type ViteContribs = FrameworkViteContributions;

export interface FrameworkRsbuildContributions {
  rules?: RuleSetRule[];
  plugins?: Array<unknown>;
  resolve?: { alias?: Record<string, string>; extensions?: string[] };
  define?: Record<string, string>;
}
export type RsbuildContribs = FrameworkRsbuildContributions;
export type ViteContribsAlias = FrameworkViteContributions;
export type RsbuildContribsAlias = FrameworkRsbuildContributions;

export interface FrameworkPreset<T extends FrameworkId = FrameworkId> {
  readonly name: T;
  rspack(opts: { fastRefresh: boolean }): RspackContribs;
  vite?(opts: { fastRefresh: boolean }): FrameworkViteContributions;
  rsbuild?(opts: { fastRefresh: boolean }): FrameworkRsbuildContributions;
  /** @deprecated use rspack() */
  contributions?: (opts: { fastRefresh: boolean }) => RspackContribs;
}

/** Discriminated union of framework presets keyed by `name` for exhaustive narrowing. */
export type FrameworkPresetUnion =
  | FrameworkPreset<'react'>
  | FrameworkPreset<'vue'>
  | FrameworkPreset<'svelte'>
  | FrameworkPreset<'solid'>
  | FrameworkPreset<'preact'>
  | FrameworkPreset<'vanilla'>;

/** Generic helper to type a preset for a specific framework. */
export type FrameworkPresetFor<F extends FrameworkId> = FrameworkPreset<F>;

// Hook types with Result
export const HOOK_PHASES = [
  'beforeCompile',
  'afterCompile',
  'afterStats',
  'beforeGenerate',
  'afterGenerate',
  'beforeStart',
  'afterStart',
  'beforePackage',
  'afterPackage'
] as const;

export type HookPhase = (typeof HOOK_PHASES)[number];

export type HookResult<T> = Result<T, RspfxError | AggregateRspfxError>;

export interface CompileContext {
  projectRoot: string;
  config: RspfxConfig;
  entries: Array<Record<string, unknown>>;
  externals: string[];
  localizedAliases: Record<string, string>;
  fastRefresh: boolean;
  production: boolean;
}

export interface Stats {
  hasErrors(): boolean;
  hasWarnings(): boolean;
  toString(opts?: unknown): string;
  [key: string]: unknown;
}

export interface WebPartEntry {
  readonly name: string;
  readonly import: string;
  readonly componentIds: readonly string[];
  readonly version: string;
}

export interface ComponentManifest {
  id: string;
  version: string;
  alias?: string;
  [key: string]: unknown;
}

export type BeforeCompile = (
  ctx: CompileContext
) => HookResult<CompileContext> | void | Promise<HookResult<CompileContext> | void>;

export type AfterStats = (stats: Stats) => void | Promise<void>;
export type AfterCompile = AfterStats;

export type BeforeGenerate = (ctx: {
  readonly production: boolean;
  readonly webParts: readonly WebPartEntry[];
}) => HookResult<typeof ctx> | void | Promise<HookResult<typeof ctx> | void>;

export type AfterGenerate = (ctx: {
  readonly manifests: readonly ComponentManifest[];
  readonly releaseDir: string;
}) => void | Promise<void>;

export type BeforeStart = (ctx: {
  readonly mode: 'local' | 'sharepoint';
  readonly port?: number;
}) => HookResult<typeof ctx> | void | Promise<HookResult<typeof ctx> | void>;

export type AfterStart = (ctx: { readonly url: string }) => void | Promise<void>;

export type BeforePackage = (ctx: {
  readonly manifests: readonly ComponentManifest[];
  readonly files: ReadonlyMap<ZipPath, Uint8Array>;
}) => HookResult<ReadonlyMap<ZipPath, Uint8Array>> | ReadonlyMap<ZipPath, Uint8Array> | void | Promise<HookResult<ReadonlyMap<ZipPath, Uint8Array>> | ReadonlyMap<ZipPath, Uint8Array> | void>;

export type AfterPackage = (ctx: { readonly sppkgPath: ZipPath }) => void | Promise<void>;

export type OnHookError = (err: RspfxError, phase: HookPhase, pluginName: string) => 'throw' | 'continue';

export interface CompilerHooks {
  beforeCompile?: BeforeCompile;
  afterStats?: AfterStats;
  afterCompile?: AfterCompile;
}

export interface ReleaseHooks {
  beforeGenerate?: BeforeGenerate;
  afterGenerate?: AfterGenerate;
}

export interface DevHooks {
  beforeStart?: BeforeStart;
  afterStart?: AfterStart;
}

export interface PackageHooks {
  beforePackage?: BeforePackage;
  afterPackage?: AfterPackage;
}

export interface RspfxExtension {
  readonly name: string;
  readonly frameworkPreset?: FrameworkPreset;
  readonly compilerHooks?: CompilerHooks;
  readonly releaseHooks?: ReleaseHooks;
  readonly devHooks?: DevHooks;
  readonly packageHooks?: PackageHooks;
  readonly onError?: OnHookError;
  readonly priority?: number;
}

export function composeHooks<T>(...hooks: Array<(ctx: T) => HookResult<T> | void | Promise<HookResult<T> | void>>): (ctx: T) => Promise<HookResult<T>> {
  return async (ctx: T): Promise<HookResult<T>> => {
    let current = ctx;
    for (const h of hooks) {
      const res = await h(current);
      if (res !== undefined && typeof res === 'object' && 'ok' in (res as Record<string, unknown>)) {
        const r = res as HookResult<T>;
        if (!r.ok) return r;
        current = (r as { ok: true; value: T }).value ?? current;
      }
    }
    return { ok: true, value: current } as HookResult<T>;
  };
}

export function definePlugin(plugin: RspfxExtension): RspfxExtension {
  return plugin;
}
