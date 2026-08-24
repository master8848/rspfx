import type { RspfxConfig } from '@mbsks/rspfx-core';

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

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
export type HookResult<T> = Result<T, Error>;

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

export type BeforeCompile = (ctx: CompileContext) => HookResult<CompileContext> | void;
export type BeforePackage = (ctx: {
  readonly manifests: readonly ComponentManifest[];
  files: Map<string, Uint8Array>;
}) => Map<string, Uint8Array> | HookResult<Map<string, Uint8Array>> | void;

export interface ComponentManifest {
  id: string;
  version: string;
  alias?: string;
  [key: string]: unknown;
}

export type HookPhase = 'beforeCompile' | 'afterStats' | 'beforePackage' | 'afterPackage';

export interface CompilerHooks {
  beforeCompile?: BeforeCompile;
  afterStats?: (stats: Stats) => void;
}

export interface ReleaseHooks {
  beforeGenerate?(ctx: { production: boolean; webParts: unknown }): void;
  afterGenerate?(ctx: { manifests: Array<Record<string, unknown>>; releaseDir: string }): void;
}

export interface DevHooks {
  beforeStart?(ctx: { mode: 'local' | 'sharepoint'; port?: number }): void;
  afterStart?(ctx: { url: string }): void;
}

export interface PackageHooks {
  beforePackage?: BeforePackage;
  afterPackage?: (ctx: { sppkgPath: string }) => void;
}

export interface RspfxExtension {
  readonly name: string;
  readonly frameworkPreset?: FrameworkPreset;
  readonly compilerHooks?: CompilerHooks;
  readonly releaseHooks?: ReleaseHooks;
  readonly devHooks?: DevHooks;
  readonly packageHooks?: PackageHooks;
  readonly onError?: (err: Error, phase: HookPhase) => 'throw' | 'continue';
}

export function composeHooks(...hs: BeforeCompile[]): BeforeCompile {
  return (ctx: CompileContext) => {
    let current = ctx;
    for (const h of hs) {
      const res = h(current);
      if (res !== undefined && typeof res === 'object' && 'ok' in (res as Record<string, unknown>)) {
        if (!(res as { ok: boolean }).ok) return res;
        current = (res as { ok: true; value: CompileContext }).value;
      } else if (res !== undefined && typeof res === 'object') {
        current = res as unknown as CompileContext;
      }
    }
    if (current !== ctx) return { ok: true, value: current } as HookResult<CompileContext>;
    return undefined;
  };
}
