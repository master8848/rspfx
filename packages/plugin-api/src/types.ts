import type { FrameworkId } from '@mbsks/rspfx-core';
import type { FrameworkAdapter as FrameworkAdapterType } from '@mbsks/rspfx-core';

export type { FrameworkAdapter } from '@mbsks/rspfx-core';

export interface FrameworkRspackContributions {
  rules?: unknown[];
  plugins?: unknown[];
  resolve?: { alias?: Record<string, string>; extensions?: string[] };
  swc?: { jsc?: Record<string, unknown> };
  define?: Record<string, string>;
  moduleTest?: { test?: RegExp; type?: string };
}

export interface FrameworkPreset {
  name: FrameworkId;
  adapter(): FrameworkAdapterType;
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions;
}

export interface CompilerHooks {
  beforeCompile?(config: unknown): unknown;
  afterStats?(stats: unknown): void;
}

export interface PackageHooks {
  beforePackage?(ctx: { manifests: unknown[]; files: { path: string; content: Uint8Array }[] }): void;
}

export interface RspfxPlugin {
  name: string;
  frameworkPreset?: FrameworkPreset;
  compilerHooks?: CompilerHooks;
  packageHooks?: PackageHooks;
}
