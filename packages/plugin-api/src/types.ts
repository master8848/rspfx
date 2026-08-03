import type { FrameworkId } from '@mbsks/rspfx-core';

export interface FrameworkRspackContributions {
  rules?: unknown[];
  plugins?: unknown[];
  resolve?: { alias?: Record<string, string>; extensions?: string[] };
  swc?: { jsc?: Record<string, unknown> };
  define?: Record<string, string>;
  moduleTest?: { test?: RegExp; type?: string };
}

export interface FrameworkViteContributions {
  /** Vite plugins (e.g. `@vitejs/plugin-react`, `@vitejs/plugin-vue`). */
  plugins?: unknown[];
  /** esbuild transform options (e.g. `{ jsx: 'automatic' }`). */
  esbuild?: Record<string, unknown>;
  resolveExtensions?: string[];
  define?: Record<string, string>;
}

export interface FrameworkRsbuildContributions {
  /** webpack/rspack-shaped rules (loaders are rewritten to absolute paths via the framework module). */
  rules?: unknown[];
  plugins?: unknown[];
  resolve?: { alias?: Record<string, string>; extensions?: string[] };
  define?: Record<string, string>;
}

export interface FrameworkPreset {
  name: FrameworkId;
  contributions(opts: { fastRefresh: boolean }): FrameworkRspackContributions;
  /**
   * Vite-shaped contributions (plugins/esbuild). Absent when the framework has
   * no Vite support — the Vite plugin then falls back with a loud warning.
   */
  vite?(opts: { fastRefresh: boolean }): FrameworkViteContributions;
  /**
   * Rsbuild-shaped contributions. Rsbuild's core is Rspack, so this is the
   * webpack-shaped surface minus the swc `jsc` block (Rsbuild owns its SWC
   * pipeline); fast-refresh frameworks that need a JS transform use
   * babel-loader-based rules here.
   */
  rsbuild?(opts: { fastRefresh: boolean }): FrameworkRsbuildContributions;
}

export interface CompilerHooks {
  beforeCompile?(config: unknown): unknown;
  afterStats?(stats: unknown): void;
}

export interface ReleaseHooks {
  /** Fired before component manifests are generated for a build. */
  beforeGenerate?(ctx: { production: boolean; webParts: unknown }): void;
  /** Fired after component manifests are generated and written to the release dir. */
  afterGenerate?(ctx: { manifests: unknown[]; releaseDir: string }): void;
}

export interface DevHooks {
  /** Fired before the dev server starts. */
  beforeStart?(ctx: { mode: 'local' | 'sharepoint'; port?: number }): void;
  /** Fired once the dev server is listening. */
  afterStart?(ctx: { url: string }): void;
}

export interface PackageHooks {
  beforePackage?(ctx: { manifests: unknown[]; files: { path: string; content: Uint8Array }[] }): void;
  afterPackage?(ctx: { sppkgPath: string }): void;
}

export interface RspfxExtension {
  name: string;
  frameworkPreset?: FrameworkPreset;
  compilerHooks?: CompilerHooks;
  releaseHooks?: ReleaseHooks;
  devHooks?: DevHooks;
  packageHooks?: PackageHooks;
}
